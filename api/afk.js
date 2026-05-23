/**
 * Heliactyl 14 - AFK WebSocket
 * Gives the user coins every x seconds.
 * Protected by Cloudflare Turnstile if enabled in settings.
 */

const settings = require("../settings.json");
const indexjs = require("../app.js");
const ejs = require("ejs");
const chalk = require("chalk");
const fetch = require("node-fetch");

let currentlyonpage = {};

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
    if (!req.session.pterodactyl) return ws.close();

    // One active session per user
    if (currentlyonpage[req.session.userinfo.id]) return ws.close();

    // Turnstile verification
    if (newsettings.turnstile && newsettings.turnstile.enabled) {
      const token = req.query.turnstile;
      if (!token) {
        ws.send(JSON.stringify({ type: "error", message: "Captcha token missing." }));
        return ws.close();
      }
      try {
        const remoteip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
        const valid = await verifyTurnstile(token, remoteip);
        if (!valid) {
          ws.send(JSON.stringify({ type: "error", message: "Captcha verification failed." }));
          return ws.close();
        }
      } catch (e) {
        console.error("[AFK] Turnstile verification error:", e.message);
        ws.send(JSON.stringify({ type: "error", message: "Captcha verification error." }));
        return ws.close();
      }
    }

    currentlyonpage[req.session.userinfo.id] = true;

    let coinloop = setInterval(
      async function() {
        let usercoins = await db.get("coins-" + req.session.userinfo.id);
        usercoins = usercoins ? usercoins : 0;
        usercoins = usercoins + newsettings.api.afk.coins;
        await db.set("coins-" + req.session.userinfo.id, usercoins);
      }, newsettings.api.afk.every * 1000
    );

    ws.onclose = async() => {
      clearInterval(coinloop);
      delete currentlyonpage[req.session.userinfo.id];
    };
  });
};
