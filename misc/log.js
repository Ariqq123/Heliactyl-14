const settings = require('../settings.json')
const fetch = require('node-fetch')
const db = require('./database')
const logger = require('./logger').child({ module: 'action' })

const MAX_BUFFER = 500;
const logBuffer = [];
const SHARED_LOG_KEY = 'system:action_logs';

function pushLog(entry) {
    logBuffer.push(entry);
    if (logBuffer.length > MAX_BUFFER) logBuffer.shift();

    setImmediate(() => {
        try {
            let history = db.get(SHARED_LOG_KEY);
            history = Array.isArray(history) ? history : [];
            history.push(entry);
            if (history.length > MAX_BUFFER) history = history.slice(-MAX_BUFFER);
            db.set(SHARED_LOG_KEY, history);
        } catch (_) {}
    });
}

function log(action, message, correlationId) {
    const timestamp = new Date().toISOString();

    logger.info({ action, correlationId: correlationId || null }, message);

    pushLog({ timestamp, action, message, correlationId: correlationId || null });

    if (!settings.logging || !settings.logging.status) return;
    if (!settings.logging.actions.user[action] && !settings.logging.actions.admin[action]) return;

    fetch(settings.logging.webhook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            embeds: [
                {
                    color: hexToDecimal('#FFFFFF'),
                    title: `Event: \`${action}\``,
                    description: correlationId ? `\`cid:${correlationId}\`\n${message}` : message,
                    author: { name: 'Heliactyl Logging' },
                    thumbnail: { url: 'https://atqr.pages.dev/favicon.png' }
                }
            ]
        })
    }).catch(() => {});
}

log.buffer = logBuffer;
log.getRecent = async (limit) => {
    const n = Math.max(1, Math.min(MAX_BUFFER, limit || MAX_BUFFER));

    try {
        const history = db.get(SHARED_LOG_KEY);
        if (Array.isArray(history) && history.length) {
            return history.slice(-n).reverse();
        }
    } catch (_) {}

    return logBuffer.slice(-n).reverse();
};

module.exports = log;

function hexToDecimal(hex) {
    return parseInt(hex.replace("#", ""), 16);
}
