const indexjs = require("../app.js");
const adminjs = require("./admin.js");
const settings = require("../settings.json");
const fs = require("fs");
const ejs = require("ejs");
const log = require("../misc/log");
const Queue = require("../managers/Queue.js");
const csrf = require("../misc/csrf");
const { isHtmx, sendAlert } = require("../misc/htmx");
const logger = require("../misc/logger").child({ module: "store" });

const storeQueue = new Queue();

module.exports.load = async function (app, db) {
  app.get("/buy", async (req, res) => {
    if (!req.session.pterodactyl) return res.redirect("/login");
    if (!csrf.verify(req)) return res.redirect("/store?err=CSRF");

    let newsettings = await enabledCheck(req, res);
    if (!newsettings) return;

    const { type, amount } = req.query;
    if (!type || !amount) return res.send("Missing type or amount");

    const validTypes = ["ram", "disk", "cpu", "servers"];
    if (!validTypes.includes(type)) return res.send("Invalid type");

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 1 || parsedAmount > 10)
      return res.send("Amount must be a number between 1 and 10");

    const theme = indexjs.get(req);
    const failedCallbackPath =
      theme.settings.redirect[`failedpurchase${type}`] || "/";

    storeQueue.addJob(async (cb) => {
      try {
        const userCoins = parseFloat(await db.get(`coins-${req.session.userinfo.id}`)) || 0;
        const resourceCap = parseFloat(await db.get(`${type}-${req.session.userinfo.id}`)) || 0;

        const { per, cost } = newsettings.api.client.coins.store[type];
        const purchaseCost = cost * parsedAmount;

        if (!Number.isFinite(purchaseCost) || purchaseCost < 0) {
          cb();
          return res.redirect(`${failedCallbackPath}?err=CANNOTAFFORD`);
        }

        if (userCoins < purchaseCost) {
          cb();
          if (isHtmx(req)) return sendAlert(res, "error", "Purchase failed", "You cannot afford this purchase.");
          return res.redirect(`${failedCallbackPath}?err=CANNOTAFFORD`);
        }

        const newUserCoins = userCoins - purchaseCost;
        const newResourceCap = resourceCap + parsedAmount;
        const extraResource = per * parsedAmount;

        if (
          !Number.isFinite(newUserCoins) ||
          newUserCoins < 0 ||
          !Number.isFinite(newResourceCap)
        ) {
          cb();
          return res.redirect(`${failedCallbackPath}?err=CANNOTAFFORD`);
        }

        if (newUserCoins === 0) {
          await db.delete(`coins-${req.session.userinfo.id}`);
        } else {
          await db.set(`coins-${req.session.userinfo.id}`, newUserCoins);
        }
        await db.set(`${type}-${req.session.userinfo.id}`, newResourceCap);

        let extra = (await db.get(`extra-${req.session.userinfo.id}`)) || {
          ram: 0,
          disk: 0,
          cpu: 0,
          servers: 0,
        };

        extra[type] += extraResource;

        if (Object.values(extra).every((v) => v === 0)) {
          await db.delete(`extra-${req.session.userinfo.id}`);
        } else {
          await db.set(`extra-${req.session.userinfo.id}`, extra);
        }

        adminjs.suspend(req.session.userinfo.id);

        log(
          `Resources Purchased`,
          `${req.session.userinfo.username}#${req.session.userinfo.discriminator} bought ${extraResource} ${type} from the store for \`${purchaseCost}\` coins.`,
          req.cid
        );

        cb();
        if (isHtmx(req)) return sendAlert(res, "success", "Resources purchased", "You can now edit one of your servers and add the extra resources.");
        res.redirect(
          (theme.settings.redirect[`purchase${type}`]
            ? theme.settings.redirect[`purchase${type}`]
            : "/") + "?err=none"
        );
      } catch (err) {
        cb();
        logger.error(err, "Purchase error");
        if (isHtmx(req)) return sendAlert(res, "error", "Purchase failed", "An error occurred during purchase.");
        res.send("An error occurred during purchase");
      }
    });
  });

  async function enabledCheck(req, res) {
    const newsettings = JSON.parse(
      fs.readFileSync("./settings.json").toString()
    );
    if (newsettings.api.client.coins.store.enabled) return newsettings;

    const theme = indexjs.get(req);
    ejs.renderFile(
      `./views/${theme.settings.notfound}`,
      req.renderData,
      null,
      function (err, str) {
        delete req.session.newaccount;
        if (err) {
          logger.error(err, `Render error on ${req._parsedUrl.pathname}`);
          return res.send(
            "An error has occurred while attempting to load this page. Please contact an administrator to fix this."
          );
        }
        res.status(200);
        res.send(str);
      }
    );
    return null;
  }
};
