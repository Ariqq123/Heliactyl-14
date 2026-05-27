/**
 * Heliactyl 14 - AFK WebSocket
 * Gives the user coins every x seconds.
 * Protected by Cloudflare Turnstile if enabled in settings.
 *
 * Cluster-safe: uses a shared Keyv lock so a user can only earn from one
 * worker at a time. Each connection holds a unique token; the worker
 * re-checks ownership before every credit, so a connect-time race can
 * at worst grant one duplicate tick rather than NUMCPUS x credit.
 */

const settings = require("../settings.json");
const indexjs = require("../app.js");
const ejs = require("ejs");
const chalk = require("chalk");
const fetch = require("node-fetch");
const Keyv = require("keyv");
const crypto = require("crypto");
const logger = require("../misc/logger").child({ module: "afk" });

const afkLock = new Keyv(settings.database, { namespace: "afklock" });
afkLock.on("error", () => {});

async function verifyTurnstile(token, remoteip) {
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: settings.turnstile.secretKey,
      response: token,
      remoteip: remoteip
    })
  });
  const data = await res.json();
  return data.success === true;
}

module.exports.load = async function(app, db) {
  app.ws("/" + settings.api.afk.path, async (ws, req) => {
    let newsettings = JSON.parse(require("fs").readFileSync("./settings.json"));

    // Must be logged in
    if (!req.session.pterodactyl || !req.session.userinfo) return ws.close();

    const userId = req.session.userinfo.id;
    const intervalMs = newsettings.api.afk.every * 1000;
    const lockTtlMs = Math.max(intervalMs * 3, 30 * 1000);
    const myToken = crypto.randomBytes(16).toString("hex");

    // Cluster-wide single-session check
    const existing = await afkLock.get(userId);
    if (existing) {
      ws.send(JSON.stringify({ type: "error", message: "AFK session already active." }));
      return ws.close();
    }
    await afkLock.set(userId, myToken, lockTtlMs);
    // Read back: if another worker won the race, bail.
    const after = await afkLock.get(userId);
    if (after !== myToken) return ws.close();

    // Turnstile verification
    if (newsettings.turnstile && newsettings.turnstile.enabled) {
      const token = req.query.turnstile;
      if (!token) {
        ws.send(JSON.stringify({ type: "error", message: "Captcha token missing." }));
        await afkLock.delete(userId);
        return ws.close();
      }
      try {
        const remoteip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
        const valid = await verifyTurnstile(token, remoteip);
        if (!valid) {
          ws.send(JSON.stringify({ type: "error", message: "Captcha verification failed." }));
          await afkLock.delete(userId);
          return ws.close();
        }
      } catch (e) {
        logger.error({ error: e.message }, "Turnstile verification error");
        ws.send(JSON.stringify({ type: "error", message: "Captcha verification error." }));
        await afkLock.delete(userId);
        return ws.close();
      }
    }

    let stopped = false;
    let coinloop = setInterval(async function() {
      try {
        const owner = await afkLock.get(userId);
        if (owner !== myToken) {
          stopped = true;
          clearInterval(coinloop);
          try { ws.close(); } catch (_) {}
          return;
        }
        // Refresh TTL so the lock doesn't expire mid-session.
        await afkLock.set(userId, myToken, lockTtlMs);

        let usercoins = parseFloat(await db.get("coins-" + userId)) || 0;
        usercoins = usercoins + newsettings.api.afk.coins;
        if (Number.isFinite(usercoins)) {
          await db.set("coins-" + userId, usercoins);
        }
      } catch (e) {
        logger.error({ error: e.message }, "AFK tick error");
      }
    }, intervalMs);

    ws.onclose = async () => {
      clearInterval(coinloop);
      if (stopped) return;
      try {
        const owner = await afkLock.get(userId);
        if (owner === myToken) await afkLock.delete(userId);
      } catch (_) {}
    };
  });
};
