/**
 * |-| [- |_ | /\ ( ~|~ `/ |_
 *
 * Heliactyl 14.11.0 ― Cascade Ridge
 *
 * This file acts as the API for the Heliactyl application.
 * @module api
*/

const indexjs = require("../app.js");
const adminjs = require("./admin.js");
const fs = require("fs");
const ejs = require("ejs");
const fetch = require("node-fetch");
const NodeCache = require("node-cache");
const Queue = require("../managers/Queue.js");
const log = require("../misc/log");
const { getClientKey } = require("../misc/clientKey");
const logger = require("../misc/logger").child({ module: "api" });
const arciotext = require("../misc/afk");

const myCache = new NodeCache({ deleteOnExpire: true, stdTTL: 59 });

module.exports.load = async function (app, db) {
  /**
   * GET /api/server-status/:identifier
   * Returns the power state of a server using the user's client API key.
   */
  app.get("/api/server-status/:identifier", async (req, res) => {
    if (!req.session.pterodactyl || !req.session.userinfo) {
      return res.send('<span class="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-slate-700 px-2 py-0.5 text-gray-500 dark:text-slate-400 text-xs"><span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>Unknown</span>');
    }

    const clientKey = getClientKey(req.session.userinfo.id);
    if (!clientKey) {
      return res.send('<span class="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-slate-700 px-2 py-0.5 text-gray-500 dark:text-slate-400 text-xs"><span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>Unknown</span>');
    }

    const settings = indexjs.getSettings();
    const identifier = req.params.identifier;

    const cacheKey = `serverstatus-${identifier}`;
    const cached = myCache.get(cacheKey);
    if (cached) return res.send(cached);

    try {
      const response = await fetch(
        settings.pterodactyl.domain + "/api/client/servers/" + identifier + "/resources",
        {
          method: "get",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${clientKey}`,
            "Accept": "application/json",
          },
        }
      );

      if (!response.ok) {
        const html = '<span class="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-slate-700 px-2 py-0.5 text-gray-500 dark:text-slate-400 text-xs"><span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>Unknown</span>';
        return res.send(html);
      }

      const data = await response.json();
      const state = data.attributes?.current_state || "unknown";

      const badges = {
        running: '<span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 text-emerald-700 dark:text-emerald-300 text-xs"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Online</span>',
        starting: '<span class="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950 px-2 py-0.5 text-amber-700 dark:text-amber-300 text-xs"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>Starting</span>',
        stopping: '<span class="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950 px-2 py-0.5 text-amber-700 dark:text-amber-300 text-xs"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>Stopping</span>',
        offline: '<span class="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-950 px-2 py-0.5 text-rose-700 dark:text-rose-300 text-xs"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>Offline</span>',
      };

      const html = badges[state] || '<span class="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-slate-700 px-2 py-0.5 text-gray-500 dark:text-slate-400 text-xs"><span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>' + state + '</span>';

      myCache.set(cacheKey, html, 15);
      return res.send(html);
    } catch (e) {
      logger.error(e, "Failed to fetch server status");
      return res.send('<span class="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-slate-700 px-2 py-0.5 text-gray-500 dark:text-slate-400 text-xs"><span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>Unknown</span>');
    }
  });

  /**
   * GET /api
   * Returns the status of the API.
   */
  app.get("/api", async (req, res) => {
    /* Check that the API key is valid */
    let authentication = await check(req, res);
    if (!authentication ) return;
    res.send({
      status: true,
    });
  });

  /**
   * GET /api/v2/userinfo
   * Returns the user information.
   */
  app.get("/api/v2/userinfo", async (req, res) => {
    /* Check that the API key is valid */
    let authentication = await check(req, res);
    if (!authentication ) return;

    if (!req.query.id) return res.send({ status: "missing id" });

    if (!(await db.get("users-" + req.query.id)))
      return res.send({ status: "invalid id" });

    let newsettings = JSON.parse(fs.readFileSync("./settings.json").toString());

    if (newsettings.api.client.oauth2.link.slice(-1) == "/")
      newsettings.api.client.oauth2.link =
        newsettings.api.client.oauth2.link.slice(0, -1);

    if (newsettings.api.client.oauth2.callbackpath.slice(0, 1) !== "/")
      newsettings.api.client.oauth2.callbackpath =
        "/" + newsettings.api.client.oauth2.callbackpath;

    if (newsettings.pterodactyl.domain.slice(-1) == "/")
      newsettings.pterodactyl.domain = newsettings.pterodactyl.domain.slice(
        0,
        -1
      );

    let packagename = await db.get("package-" + req.query.id);
    const packageKey = packagename ? packagename : newsettings.api.client.packages.default;
    let package =
      newsettings.api.client.packages.list[packageKey];
    if (!package)
      package = {
        ram: 0,
        disk: 0,
        cpu: 0,
        servers: 0,
      };
    package = {
      ...package,
      name: packageKey,
      displayName: package.displayName || (packageKey.charAt(0).toUpperCase() + packageKey.slice(1)),
    };

    let pterodactylid = await db.get("users-" + req.query.id);
    let userinforeq = await fetch(
      newsettings.pterodactyl.domain +
        "/api/application/users/" +
        pterodactylid +
        "?include=servers",
      {
        method: "get",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${newsettings.pterodactyl.key}`,
        },
      }
    );
    if ((await userinforeq.statusText) == "Not Found") {
      logger.error({ discordId: req.query.id, pteroId: pterodactylid }, "Failed to get user information");
      return res.send({ status: "could not find user on panel" });
    }
    let userinfo = await userinforeq.json();

    res.send({
      status: "success",
      package: package,
      extra: (await db.get("extra-" + req.query.id))
        ? await db.get("extra-" + req.query.id)
        : {
            ram: 0,
            disk: 0,
            cpu: 0,
            servers: 0,
          },
      userinfo: userinfo,
      coins:
        newsettings.api.client.coins.enabled == true
          ? (await db.get("coins-" + req.query.id))
            ? await db.get("coins-" + req.query.id)
            : 0
          : null,
    });
  });

  /**
   * POST /api/v2/setcoins
   * Sets the number of coins for a user.
   */
  app.post("/api/v2/setcoins", async (req, res) => {
    /* Check that the API key is valid */
    let authentication = await check(req, res);
    if (!authentication ) return;

    if (typeof req.body !== "object")
      return res.send({ status: "body must be an object" });
    if (Array.isArray(req.body))
      return res.send({ status: "body cannot be an array" });
    let id = req.body.id;
    let coins = req.body.coins;
    if (typeof id !== "string")
      return res.send({ status: "id must be a string" });
    if (!(await db.get("users-" + id)))
      return res.send({ status: "invalid id" });
    if (typeof coins !== "number")
      return res.send({ status: "coins must be number" });
    if (coins < 0 || coins > 999999999999999)
      return res.send({ status: "too small or big coins" });
    if (coins == 0) {
      await db.delete("coins-" + id);
    } else {
      await db.set("coins-" + id, coins);
    }
    res.send({ status: "success" });
  });

  /**
   * POST /api/v2/setplan
   * Sets the plan for a user.
   */
  app.post("/api/v2/setplan", async (req, res) => {
    /* Check that the API key is valid */
    let authentication = await check(req, res);
    if (!authentication ) return;

    if (!req.body) return res.send({ status: "missing body" });

    if (typeof req.body.id !== "string")
      return res.send({ status: "missing id" });

    if (!(await db.get("users-" + req.body.id)))
      return res.send({ status: "invalid id" });

    if (typeof req.body.package !== "string") {
      await db.delete("package-" + req.body.id);
      adminjs.suspend(req.body.id);
      return res.send({ status: "success" });
    } else {
      let newsettings = JSON.parse(
        fs.readFileSync("./settings.json").toString()
      );
      if (!newsettings.api.client.packages.list[req.body.package])
        return res.send({ status: "invalid package" });
      await db.set("package-" + req.body.id, req.body.package);
      adminjs.suspend(req.body.id);
      return res.send({ status: "success" });
    }
  });

  /**
   * POST /api/v2/setresources
   * Sets the resources for a user.
   */
  app.post("/api/v2/setresources", async (req, res) => {
    /* Check that the API key is valid */
    let authentication = await check(req, res);
    if (!authentication ) return;

    if (!req.body) return res.send({ status: "missing body" });

    if (typeof req.body.id !== "string")
      return res.send({ status: "missing id" });

    if (!(await db.get("users-" + req.body.id)))
      res.send({ status: "invalid id" });

    if (
      typeof req.body.ram == "number" ||
      typeof req.body.disk == "number" ||
      typeof req.body.cpu == "number" ||
      typeof req.body.servers == "number"
    ) {
      let ram = req.body.ram;
      let disk = req.body.disk;
      let cpu = req.body.cpu;
      let servers = req.body.servers;

      let currentextra = await db.get("extra-" + req.body.id);
      let extra;

      if (typeof currentextra == "object") {
        extra = currentextra;
      } else {
        extra = {
          ram: 0,
          disk: 0,
          cpu: 0,
          servers: 0,
        };
      }

      if (typeof ram == "number") {
        if (ram < 0 || ram > 999999999999999) {
          return res.send({ status: "ram size" });
        }
        extra.ram = ram;
      }

      if (typeof disk == "number") {
        if (disk < 0 || disk > 999999999999999) {
          return res.send({ status: "disk size" });
        }
        extra.disk = disk;
      }

      if (typeof cpu == "number") {
        if (cpu < 0 || cpu > 999999999999999) {
          return res.send({ status: "cpu size" });
        }
        extra.cpu = cpu;
      }

      if (typeof servers == "number") {
        if (servers < 0 || servers > 999999999999999) {
          return res.send({ status: "server size" });
        }
        extra.servers = servers;
      }

      if (
        extra.ram == 0 &&
        extra.disk == 0 &&
        extra.cpu == 0 &&
        extra.servers == 0
      ) {
        await db.delete("extra-" + req.body.id);
      } else {
        await db.set("extra-" + req.body.id, extra);
      }

      adminjs.suspend(req.body.id);
      return res.send({ status: "success" });
    } else {
      res.send({ status: "missing variables" });
    }
  });

  /**
   * Checks the authorization and returns the settings if authorized.
   * Renders the file based on the theme and sends the response.
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @returns {Object|null} - The settings object if authorized, otherwise null.
   */
  async function check(req, res) {
    let settings = JSON.parse(fs.readFileSync("./settings.json").toString());
    if (settings.api.client.api.enabled == true) {
      let auth = req.headers["authorization"];
      if (auth) {
        if (auth == "Bearer " + settings.api.client.api.code) {
          return settings;
        }
      }
    }
    let theme = indexjs.get(req);
    ejs.renderFile(
      `./views/${theme.settings.notfound}`,
      req.renderData,
      null,
      function (err, str) {
        delete req.session.newaccount;
        if (err) {
          logger.error(err, `Render error on ${req._parsedUrl.pathname}`);
          return res.send(
            "Internal Server Error"
          );
        }
        res.status(200);
        res.send(str);
      }
    );
    return null;
  }
};
