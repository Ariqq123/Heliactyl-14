/**
 * |-| [- |_ | /\ ( ~|~ `/ |_
 *
 * Heliactyl 14.11.0 ― Cascade Ridge
 *
 * This is for miscellaneous extra endpoints.
 * @module extras
 */

const settings = require("../settings.json");
const fs = require("fs");
const indexjs = require("../app.js");
const fetch = require("node-fetch");
const Queue = require("../managers/Queue");
const log = require("../misc/log");
const csrf = require("../misc/csrf");
const { getSsoUrl } = require("../misc/sso");

module.exports.load = async function (app, db) {
  app.get("/panel", async (req, res) => {
    if (!req.session.pterodactyl || !req.session.userinfo) {
      return res.redirect("/login?redirect=panel");
    }

    const newsettings = JSON.parse(fs.readFileSync("./settings.json"));
    const pteroid = await db.get("users-" + req.session.userinfo.id);
    if (!pteroid || pteroid !== req.session.pterodactyl.id) {
      return res.redirect("/login?prompt=none");
    }

    let ssoUrl = null;
    try {
      ssoUrl = getSsoUrl(
        req.session.pterodactyl.id,
        req.session.pterodactyl.email,
        newsettings
      );
    } catch (err) {
      console.error("SSO URL generation failed:", err);
    }

    if (ssoUrl) {
      return res.redirect(ssoUrl);
    }

    res.redirect(newsettings.pterodactyl.domain);
  });

  app.get("/settheme", async (req, res) => {
    if (!req.session.pterodactyl) return res.redirect("/login");
    if (!csrf.verify(req)) return res.redirect("/security?err=CSRF");

    const theme = req.query.theme;
    if (!["light", "dark"].includes(theme)) return res.redirect("/security?err=INVALIDTHEME");

    await db.set("theme-" + req.session.userinfo.id, theme);
    res.redirect(req.query.redirect || "/dashboard");
  });

  app.get("/regen", async (req, res) => {
    if (!req.session.pterodactyl) return res.redirect("/login");
    if (!csrf.verify(req)) return res.redirect("/security?err=CSRF");

    let newsettings = JSON.parse(fs.readFileSync("./settings.json"));

    if (newsettings.api.client.allow.regen !== true)
      return res.send("You cannot regenerate your password currently.");

    let newpassword = makeid(
      newsettings.api.client.passwordgenerator["length"]
    );
    req.session.password = newpassword;

    await fetch(
      settings.pterodactyl.domain +
        "/api/application/users/" +
        req.session.pterodactyl.id,
      {
        method: "patch",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.pterodactyl.key}`,
        },
        body: JSON.stringify({
          username: req.session.pterodactyl.username,
          email: req.session.pterodactyl.email,
          first_name: req.session.pterodactyl.first_name,
          last_name: req.session.pterodactyl.last_name,
          password: newpassword,
        }),
      }
    );

    let theme = indexjs.get(req);
    res.redirect("/security");
  });

  app.get("/delete_my_account", async (req, res) => {
    if (!req.session.pterodactyl || !req.session.userinfo) return res.redirect("/login");
    if (!csrf.verify(req)) return res.redirect("/security?err=CSRF");

    const discordid = req.session.userinfo.id;
    const pteroid = await db.get("users-" + discordid);

    if (!pteroid) return res.redirect("/security?err=ACCOUNTNOTFOUND");

    let selected_ip = await db.get("ip-" + discordid);

    if (selected_ip) {
      let allips = (await db.get("ips")) || [];
      allips = allips.filter((ip) => ip !== selected_ip);

      if (allips.length == 0) {
        await db.delete("ips");
      } else {
        await db.set("ips", allips);
      }

      await db.delete("ip-" + discordid);
      await db.delete("ipuser-" + selected_ip);
    }

    let userids = (await db.get("users")) || [];
    userids = userids.filter((user) => user !== pteroid);

    if (userids.length == 0) {
      await db.delete("users");
    } else {
      await db.set("users", userids);
    }

    await db.delete("users-" + discordid);
    await db.delete("coins-" + discordid);
    await db.delete("extra-" + discordid);
    await db.delete("package-" + discordid);

    log(
      "Self Delete Account",
      `${req.session.userinfo.username}#${req.session.userinfo.discriminator} removed their own account with the ID \`${discordid}\`.`,
      req.cid
    );

    req.session.destroy(() => {
      return res.redirect("/?success=ACCOUNTDELETED");
    });
  });

  /* Create a Queue */
  const queue = new Queue();

  app.get("/transfercoins", async (req, res) => {
    if (!req.session.pterodactyl || !req.session.userinfo)
      return res.redirect("/");
    if (!csrf.verify(req)) return res.redirect("/transfer?err=CSRF");

    const coins = parseFloat(req.query.coins);
    if (!req.query.id || !Number.isFinite(coins))
      return res.redirect("/transfer?err=MISSINGFIELDS");

    const targetId = String(req.query.id);
    if (targetId === String(req.session.userinfo.id))
      return res.redirect("/transfer?err=CANNOTGIFTYOURSELF");

    if (coins < 1) return res.redirect("/transfer?err=TOOLOWCOINS");
    if (coins > 999999999999999)
      return res.redirect("/transfer?err=TOOLOWCOINS");

    queue.addJob(async (cb) => {
      try {
        const usercoins = parseFloat(await db.get("coins-" + req.session.userinfo.id)) || 0;
        const othercoins = parseFloat(await db.get("coins-" + targetId)) || 0;

        const targetUser = await db.get("users-" + targetId);
        if (!targetUser) {
          cb();
          return res.redirect("/transfer?err=USERDOESNTEXIST");
        }

        if (usercoins < coins) {
          cb();
          return res.redirect("/transfer?err=CANTAFFORD");
        }

        const newSender = usercoins - coins;
        const newRecipient = othercoins + coins;
        if (
          !Number.isFinite(newSender) ||
          !Number.isFinite(newRecipient) ||
          newSender < 0 ||
          newRecipient > 999999999999999
        ) {
          cb();
          return res.redirect("/transfer?err=TOOLOWCOINS");
        }

        await db.set("coins-" + targetId, newRecipient);
        if (newSender === 0) {
          await db.delete("coins-" + req.session.userinfo.id);
        } else {
          await db.set("coins-" + req.session.userinfo.id, newSender);
        }

        log(
          "Gifted Coins",
          `${req.session.userinfo.username}#${req.session.userinfo.discriminator} sent ${coins} coins to the user with the ID \`${targetId}\`.`,
          req.cid
        );
        cb();
        return res.redirect("/transfer?err=none");
      } catch (e) {
        console.error("transfercoins error", e);
        cb();
        if (!res.headersSent) res.redirect("/transfer?err=INTERNAL");
      }
    });
  });
};

function makeid(length) {
  let result = "";
  let characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}
