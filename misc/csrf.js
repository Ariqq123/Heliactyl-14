const crypto = require("crypto");

function getToken(req) {
  if (!req.session) return null;
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }
  return req.session.csrfToken;
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function verify(req) {
  const expected = req.session && req.session.csrfToken;
  const provided =
    (req.body && (req.body._csrf || req.body.token)) ||
    (req.headers && req.headers["x-csrf-token"]) ||
    (req.query && req.query.token);
  if (!expected || !provided) return false;
  return safeEqual(expected, String(provided));
}

function require_(redirectOnFail) {
  return function (req, res, next) {
    if (verify(req)) return next();
    if (redirectOnFail) return res.redirect(redirectOnFail);
    return res.status(403).send("Invalid or missing CSRF token.");
  };
}

module.exports = { getToken, verify, require: require_ };
