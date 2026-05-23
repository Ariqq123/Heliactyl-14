# Heliactyl 14

![GitHub commit](https://img.shields.io/github/last-commit/Ariqq123/Heliactyl-14) ![GitHub release](https://img.shields.io/github/v/release/heliactyloss/heliactyl)

Heliactyl is a client dashboard for the Pterodactyl Panel. This fork is configured for a production-style deployment behind Nginx + PM2, with responsive sidebar layout fixes and safer config handling.

## Important Notes

- Heliactyl 14 is **not compatible** with `settings.json` from v13 or older.
- Keep `database.sqlite` if migrating from another v14 instance.
- This repository now tracks `settings.example.json` (template), not `settings.json` (live secrets).

## Security First

Never commit real secrets to Git:

- Pterodactyl API key
- Discord OAuth2 client secret
- Discord bot token
- website/app secret
- API private codes

Use:

- `settings.example.json` as a template
- local `settings.json` for real credentials (already ignored in `.gitignore`)

## Quick Start

1. Clone repository:
   ```bash
   git clone https://github.com/Ariqq123/Heliactyl-14.git
   cd Heliactyl-14
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create runtime config:
   ```bash
   cp settings.example.json settings.json
   ```

4. Edit `settings.json` and configure required fields:
   - `pterodactyl.domain`
   - `pterodactyl.key`
   - `api.client.oauth2.id`
   - `api.client.oauth2.secret`
   - `api.client.oauth2.link`
   - `website.secret`

5. Start locally:
   ```bash
   npm run start
   ```

## Production Deployment (PM2 + Nginx + SSL)

### 1) Run with PM2

```bash
npm i -g pm2
pm2 start app.js --name heliactyl
pm2 save
pm2 startup systemd -u root --hp /root
```

### 2) Nginx Reverse Proxy

Use `dash.mcgg.me` (or your own domain):

```nginx
server {
    listen 80;
    server_name dash.mcgg.me;

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

Enable and reload:

```bash
ln -s /etc/nginx/sites-available/heliactyl /etc/nginx/sites-enabled/heliactyl
nginx -t
systemctl reload nginx
```

### 3) SSL via Certbot

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d dash.mcgg.me
```

## Frontend / UI Notes

This fork includes dashboard layout refactoring:

- sidebar + content now use proper flex shell
- sidebar no longer overlaps main content
- avatar text truncation and overflow handling improved
- search area sizing and alignment improved
- desktop layout spacing aligned across dashboard pages

## Development Commands

```bash
npm run start    # nodemon app.js
npm run build    # tailwind watcher
```

If you need one-time CSS rebuild without watch:

```bash
npx tailwindcss -i ./assets/tw.conf -o ./assets/tailwind.css
```

## API v2 Endpoints

### `/api/v2/userinfo` (GET)
Query: `id`

### `/api/v2/setcoins` (POST)
Body: `id`, `coins`

### `/api/v2/setplan` (POST)
Body: `id`, `package`

### `/api/v2/setresources` (POST)
Body: `id`, `ram`, `disk`, `cpu`, `servers`

---

If you deploy this publicly, rotate any token that was ever exposed in terminal logs or old commits.
