const jwt = require("jsonwebtoken");
const crypto = require("crypto");

function generateToken(pterodactylUserId, email, settings) {
  if (!settings.pterodactyl.sso || !settings.pterodactyl.sso.enabled) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: settings.pterodactyl.sso.issuer,
    aud: settings.pterodactyl.sso.audience,
    sub: String(pterodactylUserId),
    email: email,
    iat: now,
    nbf: now,
    exp: now + settings.pterodactyl.sso.maxAgeSeconds,
    jti: crypto.randomBytes(16).toString("hex"),
  };

  return jwt.sign(payload, settings.pterodactyl.sso.sharedSecret, {
    algorithm: "HS256",
  });
}

function getSsoUrl(pterodactylUserId, email, settings) {
  const token = generateToken(pterodactylUserId, email, settings);
  if (!token) return null;

  const panelDomain = settings.pterodactyl.domain;
  return `${panelDomain}/extensions/heliactyl-sso?token=${encodeURIComponent(token)}`;
}

module.exports = { generateToken, getSsoUrl };
