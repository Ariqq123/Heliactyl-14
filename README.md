# Heliactyl 14

![GitHub commit](https://img.shields.io/github/last-commit/Ariqq123/Heliactyl-14) ![GitHub release](https://img.shields.io/github/v/release/heliactyloss/heliactyl)

Heliactyl is a high-performance, modern client dashboard for the Pterodactyl Panel. It allows users to manage their servers, view resource usage, and earn coins for upgrades. This repository provides a clean, fast, and stable release with an improved responsive UI and secure configuration handling.

## Features

- **Clean and responsive UI** built with Tailwind CSS
- **Full Pterodactyl Integration** for server management
- **Discord OAuth2** for seamless user authentication
- **Economy & AFK Systems** for resource rewards
- **Secure Configuration** with separate tracking for secrets
- **Admin User Management** - view all registered users with full details (coins, package, resources, servers)
- **Enhanced Security** - account removal blocks if servers exist, IP duplicate locks properly cleaned, SSO fallback on config errors

## Getting Started

### Prerequisites
- Node.js (v14 or higher recommended)
- Pterodactyl Panel (API key with admin permissions)
- Discord Application (for OAuth2 and optional bot features)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Ariqq123/Heliactyl-14.git
   cd Heliactyl-14
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your configuration:
   ```bash
   cp settings.example.json settings.json
   ```
   *Note: `settings.json` is ignored by Git to protect your credentials. Never commit this file.*

4. Edit `settings.json` and configure the following required fields:
   - `pterodactyl.domain` and `pterodactyl.key`
   - `api.client.oauth2.id` and `api.client.oauth2.secret`
   - `api.client.oauth2.link` (e.g., `https://your-domain.com`)
   - `website.secret`

## Production Deployment

We recommend using **PM2** for process management and **Nginx** as a reverse proxy.

### 1. Start with PM2
```bash
npm install -g pm2
pm2 start app.js --name heliactyl
pm2 save
pm2 startup
```

### 2. Nginx Reverse Proxy Setup
Create a new site configuration in `/etc/nginx/sites-available/heliactyl`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```
Enable the site and reload Nginx:
```bash
ln -s /etc/nginx/sites-available/heliactyl /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 3. SSL Configuration (Certbot)
Secure your dashboard with Let's Encrypt:
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

## Hosting in Pterodactyl Server

You can run Heliactyl as an application inside your own Pterodactyl Panel using a Node.js egg.

### Prerequisites
- Node.js 18+ egg available in your Pterodactyl Panel
- Allocated port for the application
- Reverse proxy (Nginx/Traefik) configured on the host
- SSL certificate (HTTPS required for secure cookies)

### Setup Steps

1. **Create a new server** in your Pterodactyl Panel using a Node.js egg.

2. **Upload Heliactyl files** to the server root directory.

3. **Configure settings.json**:
   ```json
   {
     "pterodactyl": {
       "domain": "https://your-panel-domain.com",
       "key": "your-application-api-key",
       "sso": {
         "enabled": true,
         "sharedSecret": "your-shared-secret-matching-blueprint-extension",
         "issuer": "heliactyl",
         "audience": "pterodactyl-panel",
         "maxAgeSeconds": 60
       }
     },
     "website": {
       "port": 3000,
       "secret": "generate-a-strong-random-string"
     },
     "api": {
       "client": {
         "oauth2": {
           "link": "https://your-heliactyl-domain.com"
         }
       }
     }
   }
   ```

4. **Startup Command** (in egg configuration):
   ```bash
   npm ci --omit=dev && node app.js
   ```

5. **Important Notes**:
   - Heliactyl requires `cookie.secure: true`, so HTTPS is mandatory.
   - Configure your reverse proxy to pass `X-Forwarded-Proto: https` headers.
   - The app listens on the port specified in `settings.json` (`website.port`).
   - Allocate at least 512 MB RAM for stable operation.
   - Use a persistent volume for `database.sqlite` if you want data to survive restarts.

6. **Reverse Proxy** (on Pterodactyl host):
   ```nginx
   server {
       listen 443 ssl http2;
       server_name your-heliactyl-domain.com;
       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;

       location / {
           proxy_pass http://127.0.0.1:ALLOCATED_PORT;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto https;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
       }
   }
   ```

## Development

Run the app locally with hot-reloading (requires `nodemon`):
```bash
npm run start
```

Rebuild Tailwind CSS manually if you make UI changes:
```bash
npm run build
```

## API v2 Documentation

Heliactyl 14 includes a V2 API for programmatic access:

- **`GET /api/v2/userinfo`** - Fetch user details (Query: `id`)
- **`POST /api/v2/setcoins`** - Update coin balance (Body: `id`, `coins`)
- **`POST /api/v2/setplan`** - Update user plan (Body: `id`, `package`)
- **`POST /api/v2/setresources`** - Modify server resources (Body: `id`, `ram`, `disk`, `cpu`, `servers`)

---
*Disclaimer: This fork is based on the open-source Heliactyl project.*
