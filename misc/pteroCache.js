/**
 * Simple in-memory cache for Pterodactyl API responses.
 * Avoids hammering the panel for data that rarely changes (user info, server lists).
 */

const fetch = require("node-fetch");

const cache = new Map();
const DEFAULT_TTL = 60 * 1000; // 1 minute

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data, ttl = DEFAULT_TTL) {
  cache.set(key, { data, expires: Date.now() + ttl });
}

/**
 * Fetch a Pterodactyl API endpoint with caching.
 * @param {string} url - Full API URL
 * @param {string} apiKey - Application API key
 * @param {object} [options] - { ttl: ms, force: boolean }
 * @returns {object|null} - Parsed JSON or null on failure
 */
async function fetchPtero(url, apiKey, options = {}) {
  const { ttl = DEFAULT_TTL, force = false } = options;

  if (!force) {
    const cached = getCached(url);
    if (cached) return cached;
  }

  try {
    const res = await fetch(url, {
      method: "get",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    setCache(url, data, ttl);
    return data;
  } catch (e) {
    return null;
  }
}

/**
 * Invalidate cache entries matching a prefix.
 */
function invalidate(prefix) {
  for (const key of cache.keys()) {
    if (key.includes(prefix)) cache.delete(key);
  }
}

function clear() {
  cache.clear();
}

module.exports = { fetchPtero, invalidate, clear };
