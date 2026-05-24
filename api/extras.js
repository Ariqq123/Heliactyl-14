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

module.exports.load = async function (app, db) {
  app.get("/panel", async (req, res) => {
    res.redirect(settings.pterodactyl.domain);
  });

  app.get("/regen", async (req, res) => {
    if (!req.session.pterodactyl) return res.redirect("/login");

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
    if (!req.session.pterodactyl) return res.redirect("/");

    const coins = parseInt(req.query.coins);
    if (!req.query.id || isNaN(coins))
      return res.redirect("/transfer?err=MISSINGFIELDS");
      
    if (req.query.id === req.session.userinfo.id)
      return res.redirect("/transfer?err=CANNOTGIFTYOURSELF");

    if (coins < 1) return res.redirect("/transfer?err=TOOLOWCOINS");

    queue.addJob(async (cb) => {
      const usercoins = parseInt(await db.get("coins-" + req.session.userinfo.id)) || 0;
      const othercoins = parseInt(await db.get("coins-" + req.query.id)) || 0;
      
      const targetUser = await db.get("users-" + req.query.id);
      if (!targetUser) {
        cb();
        return res.redirect("/transfer?err=USERDOESNTEXIST");
      }
      
      if (usercoins < coins) {
        cb();
        return res.redirect("/transfer?err=CANTAFFORD");
      }

      await db.set("coins-" + req.query.id, othercoins + coins);
      await db.set("coins-" + req.session.userinfo.id, usercoins - coins);

      log(
        "Gifted Coins",
        `${req.session.userinfo.username}#${req.session.userinfo.discriminator} sent ${coins} coins to the user with the ID \`${req.query.id}\`.`,
        req.cid
      );
      cb();
      return res.redirect("/transfer?err=none");
    });
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
