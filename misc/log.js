const settings = require('../settings.json')
const fetch = require('node-fetch')
const Keyv = require('keyv')

/**
 * In-memory log buffer (last MAX_BUFFER entries).
 * Note: with cluster mode each worker has its own buffer.
 */
const MAX_BUFFER = 500;
const logBuffer = [];
const SHARED_LOG_KEY = 'system:action_logs';
const sharedLogStore = new Keyv(settings.database);

function pushLog(entry) {
    logBuffer.push(entry);
    if (logBuffer.length > MAX_BUFFER) logBuffer.shift();

    // Persist to shared DB so logs are visible across cluster workers.
    // Best-effort async write (non-blocking for request flow).
    (async () => {
        try {
            let history = await sharedLogStore.get(SHARED_LOG_KEY);
            history = Array.isArray(history) ? history : [];
            history.push(entry);
            if (history.length > MAX_BUFFER) history = history.slice(-MAX_BUFFER);
            await sharedLogStore.set(SHARED_LOG_KEY, history);
        } catch (_) {}
    })();
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
log.getRecent = async (limit) => {
    const n = Math.max(1, Math.min(MAX_BUFFER, limit || MAX_BUFFER));

    try {
        const history = await sharedLogStore.get(SHARED_LOG_KEY);
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
