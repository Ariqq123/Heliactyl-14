/**
 * Builds the per-request render data consumed by every EJS template.
 *
 * Replaces the legacy `eval(indexjs.renderdataeval)` pattern. Same shape — same
 * keys — but built by a real function so it can be cached on `res.locals`,
 * imported, and reasoned about.
 */

const JavaScriptObfuscator = require("javascript-obfuscator");
const arciotext = require("./afk");
const actionLog = require("./log");
const csrf = require("./csrf");
const indexjs = require("../app");

function normalizePackage(packageObj, packagename) {
  if (!packageObj) return null;
  return {
    ram: packageObj.ram || 0,
    disk: packageObj.disk || 0,
    cpu: packageObj.cpu || 0,
    servers: packageObj.servers || 0,
    displayName: packageObj.displayName || (packagename.charAt(0).toUpperCase() + packagename.slice(1)),
    description: packageObj.description || null,
    price: packageObj.price !== undefined ? packageObj.price : null,
    featured: packageObj.featured || false,
    badge: packageObj.badge || null,
    _key: packagename,
  };
}

function obfuscatedAfkScript(newsettings) {
  return JavaScriptObfuscator.obfuscate(`
     let everywhat = ${newsettings.api.afk.every};
     let gaincoins = ${newsettings.api.afk.coins};
     let wspath = "ws";

     ${arciotext}
    `).getObfuscatedCode();
}

async function buildRenderData(req, db, theme) {
  const newsettings = indexjs.getSettings();
  const userinfo = req.session.userinfo || null;
  const pathname = req.path || req._parsedUrl?.pathname || "";

  let packagename = null;
  let extraresources = null;
  let packages = null;
  let coins = null;
  let themePreference = "light";

  if (userinfo) {
    packagename =
      (await db.get("package-" + userinfo.id)) ||
      newsettings.api.client.packages.default;
    extraresources =
      (await db.get("extra-" + userinfo.id)) ||
      { ram: 0, disk: 0, cpu: 0, servers: 0 };
    packages = normalizePackage(newsettings.api.client.packages.list[packagename], packagename);
    if (newsettings.api.client.coins.enabled === true) {
      coins = (await db.get("coins-" + userinfo.id)) || 0;
    }
    themePreference = (await db.get("theme-" + userinfo.id)) || "light";
  } else if (newsettings.api.client.coins.enabled === true) {
    coins = null;
  }

  const data = {
    req,
    settings: newsettings,
    userinfo,
    packagename,
    extraresources,
    packages,
    coins,
    logs: pathname === "/logs" ? await actionLog.getRecent(500) : [],
    x: "aHR0cHM6Ly93d3cueW91dHViZS5jb20vd2F0Y2g/dj1wVGZKZm5pUUZTOA==",
    pterodactyl: req.session.pterodactyl,
    extra: theme && theme.settings ? theme.settings.variables : {},
    csrfToken: csrf.getToken(req),
    themePreference,
    db,
  };

  if (userinfo && packages && req.session.pterodactyl) {
    const servers = req.session.pterodactyl.relationships.servers.data;
    let usedRam = 0, usedDisk = 0, usedCpu = 0;
    for (let i = 0; i < servers.length; i++) {
      usedRam += servers[i].attributes.limits.memory || 0;
      usedDisk += servers[i].attributes.limits.disk || 0;
      usedCpu += servers[i].attributes.limits.cpu || 0;
    }
    const extra = extraresources || { ram: 0, disk: 0, cpu: 0, servers: 0 };
    data.availableRam = (packages.ram + extra.ram - usedRam) / 1024;
    data.availableDisk = (packages.disk + extra.disk - usedDisk) / 1024;
    data.availableCpu = (packages.cpu + extra.cpu - usedCpu) / 100;
    data.availableServers = packages.servers + extra.servers - servers.length;
  } else {
    data.availableRam = 0;
    data.availableDisk = 0;
    data.availableCpu = 0;
    data.availableServers = 0;
  }

  if (pathname === "/afk") {
    data.arcioafktext = obfuscatedAfkScript(newsettings);
  }

  if (pathname === "/users") {
    const fetch = require("node-fetch");
    const userIds = (await db.get("users")) || [];
    const usersList = [];
    for (const pteroId of userIds) {
      try {
        const res = await fetch(
          newsettings.pterodactyl.domain + "/api/application/users/" + pteroId + "?include=servers",
          {
            method: "get",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${newsettings.pterodactyl.key}`,
            },
          }
        );
        if (!res.ok) continue;
        const pteroUser = (await res.json()).attributes;
        const discordId = pteroUser.username;
        const userCoins = (await db.get("coins-" + discordId)) || 0;
        const userPackageId = (await db.get("package-" + discordId)) || newsettings.api.client.packages.default;
        const userPackage = normalizePackage(newsettings.api.client.packages.list[userPackageId], userPackageId);
        const userExtra = (await db.get("extra-" + discordId)) || { ram: 0, disk: 0, cpu: 0, servers: 0 };
        usersList.push({
          pteroId,
          discordId,
          username: pteroUser.first_name,
          email: pteroUser.email,
          servers: pteroUser.relationships.servers.data.length,
          coins: userCoins,
          package: userPackage ? userPackage.displayName : userPackageId,
          extra: userExtra,
          admin: pteroUser.root_admin,
        });
      } catch (e) {
        continue;
      }
    }
    data.usersList = usersList;
  }

  return data;
}

module.exports = { buildRenderData };
