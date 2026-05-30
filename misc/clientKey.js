/**
 * Pterodactyl Client API Key Manager
 * Auto-generates and stores client API keys for users by authenticating
 * against the panel with their credentials.
 */

const fetch = require("node-fetch");
const db = require("./database");
const logger = require("./logger").child({ module: "clientkey" });

/**
 * Get or create a client API key for a user.
 * @param {string} discordId - User's Discord ID
 * @param {object} settings - App settings
 * @returns {string|null} - Client API key or null on failure
 */
async function getClientKey(discordId, settings) {
  // Check if we already have a stored key
  const existing = db.get("clientkey-" + discordId);
  if (existing) return existing;
  return null;
}

/**
 * Generate a client API key by authenticating as the user.
 * Call this during login when we have the user's password.
 * @param {string} discordId - User's Discord ID
 * @param {string} email - User's panel email
 * @param {string} password - User's panel password
 * @param {object} settings - App settings
 * @returns {string|null} - New client API key or null on failure
 */
async function createClientKey(discordId, email, password, settings) {
  const domain = settings.pterodactyl.domain;

  try {
    // Step 1: Get CSRF cookie
    const csrfRes = await fetch(domain + "/sanctum/csrf-cookie", {
      method: "GET",
      redirect: "manual",
    });

    const cookies = csrfRes.headers.raw()["set-cookie"] || [];
    const cookieHeader = cookies.map(c => c.split(";")[0]).join("; ");

    // Extract XSRF token from cookie
    const xsrfCookie = cookies.find(c => c.startsWith("XSRF-TOKEN="));
    if (!xsrfCookie) {
      logger.warn("Failed to get XSRF token from panel");
      return null;
    }
    const xsrfToken = decodeURIComponent(xsrfCookie.split("=")[1].split(";")[0]);

    // Step 2: Login
    const loginRes = await fetch(domain + "/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Cookie": cookieHeader,
        "X-XSRF-TOKEN": xsrfToken,
      },
      body: JSON.stringify({ user: email, password }),
      redirect: "manual",
    });

    if (loginRes.status !== 200 && loginRes.status !== 302) {
      logger.warn({ status: loginRes.status }, "Panel login failed for client key generation");
      return null;
    }

    // Merge session cookies from login response
    const loginCookies = loginRes.headers.raw()["set-cookie"] || [];
    const allCookies = [...cookies, ...loginCookies].map(c => c.split(";")[0]).join("; ");

    // Get new XSRF token if provided
    const newXsrf = loginCookies.find(c => c.startsWith("XSRF-TOKEN="));
    const activeXsrf = newXsrf
      ? decodeURIComponent(newXsrf.split("=")[1].split(";")[0])
      : xsrfToken;

    // Step 3: Create API key
    const keyRes = await fetch(domain + "/api/client/account/api-keys", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Cookie": allCookies,
        "X-XSRF-TOKEN": activeXsrf,
      },
      body: JSON.stringify({
        description: "Heliactyl Dashboard",
        allowed_ips: [],
      }),
    });

    if (!keyRes.ok) {
      const text = await keyRes.text();
      logger.warn({ status: keyRes.status, body: text.slice(0, 200) }, "Failed to create client API key");
      return null;
    }

    const keyData = await keyRes.json();
    const apiKey = keyData.meta?.secret_token;

    if (!apiKey) {
      logger.warn("No secret_token in API key response");
      return null;
    }

    // Store the key
    db.set("clientkey-" + discordId, apiKey);
    logger.info({ discordId }, "Client API key generated successfully");
    return apiKey;
  } catch (e) {
    logger.error(e, "Error creating client API key");
    return null;
  }
}

/**
 * Delete stored client key (e.g., on account deletion).
 */
function deleteClientKey(discordId) {
  db.delete("clientkey-" + discordId);
}

module.exports = { getClientKey, createClientKey, deleteClientKey };
