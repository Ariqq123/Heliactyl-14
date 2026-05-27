/**
 * |-| [- |_ | /\ ( ~|~ `/ |_
 *
 * Heliactyl 14.11.1 ― Cascade Ridge 
 *
 * This file represents the main entry point of the Heliactyl application.
 * It loads the necessary packages, settings, and databases.
 * It also handles the routing and rendering of web pages.
 * @module index
 */

"use strict";

// Load logging.
const logger = require("./misc/logger");

// Load packages.
const path = require("path");
const fs = require("fs");
const fetch = require("node-fetch");
const chalk = require("chalk");
const axios = require("axios");
const arciotext = require("./misc/afk.js");
const cluster = require("cluster");
const os = require("os");
const ejs = require("ejs")
global.Buffer = global.Buffer || require("buffer").Buffer;

if (typeof btoa === "undefined") {
  global.btoa = function (str) {
    return new Buffer(str, "binary").toString("base64");
  };
}
if (typeof atob === "undefined") {
  global.atob = function (b64Encoded) {
    return new Buffer(b64Encoded, "base64").toString("binary");
  };
}

// Load settings.
const settings = require("./settings.json");

const settingsPath = path.join(__dirname, "settings.json");
const themeSettingsPath = path.join(__dirname, "views", "pages.json");

settings.api.client.eggs = fs.existsSync(path.join(__dirname, "eggs.json"))
  ? JSON.parse(fs.readFileSync(path.join(__dirname, "eggs.json")).toString())
  : JSON.parse(fs.readFileSync(path.join(__dirname, "eggs.example.json")).toString());
let cachedSettings = settings;
let cachedSettingsMtimeMs = fs.statSync(settingsPath).mtimeMs;
let nextSettingsCheckAt = 0;
let cachedThemeSettings = fs.existsSync(themeSettingsPath)
  ? JSON.parse(fs.readFileSync(themeSettingsPath).toString())
  : null;
let cachedThemeSettingsMtimeMs = fs.existsSync(themeSettingsPath)
  ? fs.statSync(themeSettingsPath).mtimeMs
  : 0;
let nextThemeSettingsCheckAt = 0;

function getCachedSettings() {
  if (Date.now() >= nextSettingsCheckAt) {
    nextSettingsCheckAt = Date.now() + 1000;
    const currentMtimeMs = fs.statSync(settingsPath).mtimeMs;
    if (currentMtimeMs !== cachedSettingsMtimeMs) {
      cachedSettings = JSON.parse(fs.readFileSync(settingsPath).toString());
      cachedSettings.api.client.eggs = fs.existsSync(path.join(__dirname, "eggs.json"))
        ? JSON.parse(fs.readFileSync(path.join(__dirname, "eggs.json")).toString())
        : JSON.parse(fs.readFileSync(path.join(__dirname, "eggs.example.json")).toString());
      cachedSettingsMtimeMs = currentMtimeMs;
    }
  }
  return cachedSettings;
}

function getCachedThemeSettings() {
  if (Date.now() >= nextThemeSettingsCheckAt) {
    nextThemeSettingsCheckAt = Date.now() + 1000;
    if (fs.existsSync(themeSettingsPath)) {
      const currentMtimeMs = fs.statSync(themeSettingsPath).mtimeMs;
      if (currentMtimeMs !== cachedThemeSettingsMtimeMs) {
        cachedThemeSettings = JSON.parse(fs.readFileSync(themeSettingsPath).toString());
        cachedThemeSettingsMtimeMs = currentMtimeMs;
      }
    } else {
      cachedThemeSettings = null;
      cachedThemeSettingsMtimeMs = 0;
    }
  }
  return cachedThemeSettings;
}

module.exports.getSettings = getCachedSettings;
module.exports.getThemeSettings = getCachedThemeSettings;

const defaultthemesettings = {
  index: "index.ejs",
  notfound: "index.ejs",
  redirect: {},
  pages: {},
  mustbeloggedin: [],
  mustbeadmin: [],
  variables: {},
};

module.exports.renderdataeval = `(async () => {
   const { buildRenderData } = require('./misc/renderdata');
   return await buildRenderData(req, db, theme);
  })();`;

// Load database
const Keyv = require("keyv");
const db = new Keyv(settings.database);

db.on("error", (err) => {
  logger.error(err, "Database connection error");
});

module.exports.db = db;

if (cluster.isMaster) {
  const numCPUs = 8;
  logger.info('Starting workers on Heliactyl 14 (Cascade Ridge)');
  logger.info({ pid: process.pid }, 'Master is running');
  logger.info({ workers: numCPUs }, 'Forking workers');

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    logger.warn({ pid: worker.process.pid, code, signal }, 'Worker died, forking replacement');
    cluster.fork();
  });

} else {
  // Load websites.
  const express = require("express");
  const app = express();
  app.set('view engine', 'ejs');
  require("express-ws")(app);

  // Load express addons.
  const ejs = require("ejs");
  const session = require("express-session");
  const KeyvStore = require("./session");
  const indexjs = require("./app.js");

  // Load the website.
  module.exports.app = app;
  const { buildRenderData } = require("./misc/renderdata");

  app.use((req, res, next) => {
    res.setHeader("X-Powered-By", "14th Gen Heliactyl (Cascade Ridge)");
    req.cid = Math.random().toString(36).substring(2, 10);
    res.setHeader("X-Correlation-ID", req.cid);
    next();
  });

  app.set('trust proxy', 1); // Trust X-Forwarded-* headers from Nginx

  app.use(
    session({
      store: new KeyvStore({ uri: settings.database }),
      secret: settings.website.secret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: true,      // Require HTTPS
        httpOnly: true,    // Prevent XSS access
        sameSite: 'lax',   // CSRF protection
        maxAge: 1000 * 60 * 60 * 24 * 7  // 7 days
      },
    })
  );

  app.use(
    express.json({
      inflate: true,
      limit: "500kb",
      reviver: null,
      strict: true,
      type: "application/json",
      verify: undefined,
    })
  );

  // Per-request render data: build once after the session middleware, expose
  // on req for handlers and on res.locals so templates can read variables
  // without each route building its own data object. Static asset requests
  // skip this to avoid a DB hit and a settings.json read on every image.
  app.use(async (req, res, next) => {
    if (req.path.startsWith("/assets/") || req.path.startsWith("/api")) return next();
    try {
      const theme = indexjs.get(req);
      const data = await buildRenderData(req, db, theme);
      req.renderData = data;
      Object.assign(res.locals, data);
      next();
    } catch (err) {
      next(err);
    }
  });

  const listener = app.listen(settings.website.port, function () {
    logger.info({ port: settings.website.port, pid: process.pid }, 'Worker online');
  });

  var cache = false;
  app.use(function (req, res, next) {
    let manager = indexjs.getSettings().api.client.ratelimits;
    if (manager[req._parsedUrl.pathname]) {
      if (cache == true) {
        setTimeout(async () => {
          let allqueries = Object.entries(req.query);
          let querystring = "";
          for (let query of allqueries) {
            querystring = querystring + "&" + query[0] + "=" + query[1];
          }
          querystring = "?" + querystring.slice(1);
          res.redirect(
            (req._parsedUrl.pathname.slice(0, 1) == "/"
              ? req._parsedUrl.pathname
              : "/" + req._parsedUrl.pathname) + querystring
          );
        }, 1000);
        return;
      } else {
        cache = true;
        setTimeout(async () => {
          cache = false;
        }, 1000 * manager[req._parsedUrl.pathname]);
      }
    }
    next();
  });

  // Load the API files.
  let apifiles = fs.readdirSync("./api").filter((file) => file.endsWith(".js")); //UzJsdVoxUnBibTg9IHdhcyByaWdodA==

  apifiles.forEach((file) => {
    let apifile = require(`./api/${file}`);
    apifile.load(app, db);
  });


  app.all(/.*/, async (req, res) => {
    if (req._parsedUrl.pathname === '/' && req.session.userinfo && req.session.pterodactyl)
      return res.redirect('/dashboard');
    if (req.session.pterodactyl)
      if (
        req.session.pterodactyl.id !==
        (await db.get("users-" + req.session.userinfo.id))
      )
        return res.redirect("/login?prompt=none");
    let theme = indexjs.get(req);
    let newsettings = indexjs.getSettings();
    if (newsettings.api.afk.enabled == true)
      req.session.arcsessiontoken = Math.random().toString(36).substring(2, 15);
    if (theme.settings.mustbeloggedin.includes(req._parsedUrl.pathname))
      if (!req.session.userinfo || !req.session.pterodactyl)
        return res.redirect(
          "/login" +
            (req._parsedUrl.pathname.slice(0, 1) == "/"
              ? "?redirect=" + req._parsedUrl.pathname.slice(1)
              : "")
        );
    if (theme.settings.mustbeadmin.includes(req._parsedUrl.pathname)) {
      ejs.renderFile(
        `./views/${theme.settings.notfound}`,
        req.renderData,
        null,
        async function (err, str) {
          delete req.session.newaccount;
          delete req.session.password;
          if (!req.session.userinfo || !req.session.pterodactyl) {
            if (err) {
              logger.error(err, "Render error");
              return res.render("500.ejs", { err });
            }
            res.status(200);
            return res.send(str);
          }
  
          let cacheaccount = await fetch(
            settings.pterodactyl.domain +
              "/api/application/users/" +
              (await db.get("users-" + req.session.userinfo.id)) +
              "?include=servers",
            {
              method: "get",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${settings.pterodactyl.key}`,
              },
            }
          );
          if ((await cacheaccount.statusText) == "Not Found") {
            if (err) {
              logger.error(err, "Render error");
              return res.render("500.ejs", { err });
            }
            return res.send(str);
          }
          let cacheaccountinfo = JSON.parse(await cacheaccount.text());
  
          req.session.pterodactyl = cacheaccountinfo.attributes;
          if (cacheaccountinfo.attributes.root_admin !== true) {
            if (err) {
              logger.error(err, "Render error");
              return res.render("500.ejs", { err });
            }
            return res.send(str);
          }
  
          ejs.renderFile(
            `./views/${
              theme.settings.pages[req._parsedUrl.pathname.slice(1)]
                ? theme.settings.pages[req._parsedUrl.pathname.slice(1)]
                : theme.settings.notfound
            }`,
            req.renderData,
            null,
            function (err, str) {
              delete req.session.newaccount;
              delete req.session.password;
              if (err) {
                logger.error(err, "Render error");
                return res.render("500.ejs", { err });
              }
              res.status(200);
              res.send(str);
            }
          );
        }
      );
      return;
    }
    const data = req.renderData;
    ejs.renderFile(
      `./views/${
        theme.settings.pages[req._parsedUrl.pathname.slice(1)]
          ? theme.settings.pages[req._parsedUrl.pathname.slice(1)]
          : theme.settings.notfound
      }`,
      data,
      null,
      function (err, str) {
        delete req.session.newaccount;
        delete req.session.password;
        if (err) {
          logger.error(err, "Render error");
          return res.render("500.ejs", { err });
        }
        res.status(200);
        res.send(str);
      }
    );
  });

  module.exports.get = function (req) {
    return {
      settings: indexjs.getThemeSettings() || defaultthemesettings
    };
  };

  module.exports.islimited = async function () {
    return cache == true ? false : true;
  };

  module.exports.ratelimits = async function (length) {
    if (cache == true) return setTimeout(indexjs.ratelimits, 1);
    cache = true;
    setTimeout(async function () {
      cache = false;
    }, length * 1000);
  };

  process.on('uncaughtException', (error) => {
    logger.fatal(error, 'Uncaught Exception');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason }, 'Unhandled Rejection');
  });
}

async function renderTemplate(theme, renderdataeval, req, res, db) {
  return new Promise(async (resolve, reject) => {
    ejs.renderFile(
      `./views/${theme.settings.index}`,
      req.renderData || (await require("./misc/renderdata").buildRenderData(req, db, theme)),
      null,
      async function (err, str) {
        if (err) {
          reject(err);
          return;
        }

        delete req.session.newaccount;
        resolve(str);
      }
    );
  });
}
