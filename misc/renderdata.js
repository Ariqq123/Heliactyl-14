/**
 * Builds the per-request render data consumed by every EJS template.
 *
 * Replaces the legacy `eval(indexjs.renderdataeval)` pattern. Same shape — same
 * keys — but built by a real function so it can be cached on `res.locals`,
 * imported, and reasoned about.
 */

const fs = require("fs");
const JavaScriptObfuscator = require("javascript-obfuscator");
const arciotext = require("./afk");
const actionLog = require("./log");
const csrf = require("./csrf");

function obfuscatedAfkScript(newsettings) {
  return JavaScriptObfuscator.obfuscate(`
     let everywhat = ${newsettings.api.afk.every};
     let gaincoins = ${newsettings.api.afk.coins};
     let wspath = "ws";

     ${arciotext}
    `).getObfuscatedCode();
}

async function buildRenderData(req, db, theme) {
  const newsettings = JSON.parse(fs.readFileSync("./settings.json"));
  const userinfo = req.session.userinfo || null;

  let packagename = null;
  let extraresources = null;
  let packages = null;
  let coins = null;

  if (userinfo) {
    packagename =
      (await db.get("package-" + userinfo.id)) ||
      newsettings.api.client.packages.default;
    extraresources =
      (await db.get("extra-" + userinfo.id)) ||
      { ram: 0, disk: 0, cpu: 0, servers: 0 };
    packages = newsettings.api.client.packages.list[packagename] || null;
    if (newsettings.api.client.coins.enabled === true) {
      coins = (await db.get("coins-" + userinfo.id)) || 0;
    }
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
    logs: await actionLog.getRecent(500),
    x: "aHR0cHM6Ly93d3cueW91dHViZS5jb20vd2F0Y2g/dj1wVGZKZm5pUUZTOA==",
    pterodactyl: req.session.pterodactyl,
    extra: theme && theme.settings ? theme.settings.variables : {},
    csrfToken: csrf.getToken(req),
    db,
  };
  data.arcioafktext = obfuscatedAfkScript(newsettings);
  return data;
}

module.exports = { buildRenderData };
