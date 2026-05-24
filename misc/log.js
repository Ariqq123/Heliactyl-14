const settings = require('../settings.json')
const fetch = require('node-fetch')

/**
 * In-memory log buffer (last MAX_BUFFER entries).
 * Note: with cluster mode each worker has its own buffer.
 */
const MAX_BUFFER = 500;
const logBuffer = [];

function pushLog(entry) {
    logBuffer.push(entry);
    if (logBuffer.length > MAX_BUFFER) logBuffer.shift();
}

/**
 * Log an action.
 * Always prints to console/PM2 logs.
 * Always stored in memory buffer (read via /logs).
 * Optionally pushes to Discord webhook if configured in settings.json.
 *
 * @param {string} action
 * @param {string} message
 * @param {string} [correlationId] optional request correlation ID
 */
function log(action, message, correlationId) {
    const timestamp = new Date().toISOString();
    const cidPart = correlationId ? `[cid:${correlationId}] ` : '';
    const line = `[${timestamp}] ${cidPart}[ACTION: ${action}] ${message}`;

    console.log(line);

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
log.getRecent = (limit) => {
    const n = Math.max(1, Math.min(MAX_BUFFER, limit || MAX_BUFFER));
    return logBuffer.slice(-n).reverse();
};

module.exports = log;

function hexToDecimal(hex) {
    return parseInt(hex.replace("#", ""), 16);
}
