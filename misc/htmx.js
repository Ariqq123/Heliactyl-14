const ejs = require("ejs");
const path = require("path");

function isHtmx(req) {
  return req.headers["hx-request"] === "true";
}

function sendAlert(res, type, title, message) {
  ejs.renderFile(
    path.join(__dirname, "../views/components/alert-partial.ejs"),
    { type, title, message },
    (err, html) => {
      if (err) return res.status(500).send("Render error");
      res.send(html);
    }
  );
}

module.exports = { isHtmx, sendAlert };
