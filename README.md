# Shelflife

Manage your Plex library storage. Shelflife connects to [Overseerr](https://overseerr.dev/) and [Tautulli](https://tautulli.com/) to let users vote on whether content they requested should be kept or deleted. Admins get a dashboard showing what can be safely pruned.

## How it works

1. Users sign in with their Plex account (same login as Overseerr)
2. Shelflife syncs media requests from Overseerr and watch history from Tautulli
3. Each user sees their own requests and marks them as **Keep** or **Can Delete**
4. Admins see an aggregate view of what users have flagged for deletion

Shelflife is read-only against your external services -- it never deletes anything. It just helps you figure out what's safe to remove.

## Requirements

- [Overseerr](https://overseerr.dev/) -- for media request data
- [Tautulli](https://tautulli.com/) -- for watch history
- A Plex account

## Configuration

| Variable | Required | Description |
|---|---|---|
| `OVERSEERR_URL` | Yes | URL of your Overseerr instance (e.g. `http://192.168.1.100:5055`) |
| `OVERSEERR_API_KEY` | Yes | Found in Overseerr under Settings > General |
| `TAUTULLI_URL` | Yes | URL of your Tautulli instance (e.g. `http://192.168.1.100:8181`) |
| `TAUTULLI_API_KEY` | Yes | Found in Tautulli under Settings > Web Interface |
| `SESSION_SECRET` | Yes | Random string for signing sessions (minimum 32 characters) |
| `PLEX_CLIENT_ID` | No | Identifier for Plex auth (defaults to `shelflife`) |
| `ADMIN_PLEX_ID` | No | Force a specific Plex user as admin. If unset, the first user to sign in becomes admin |
| `DATABASE_PATH` | No | Path to SQLite database (defaults to `/app/data/shelflife.db` in Docker) |

## Running with Docker Compose

```yaml
services:
  shelflife:
    image: ghcr.io/fauxvo/shelflife:latest
    container_name: shelflife
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - OVERSEERR_URL=http://your-ip:5055
      - OVERSEERR_API_KEY=your-key
      - TAUTULLI_URL=http://your-ip:8181
      - TAUTULLI_API_KEY=your-key
      - SESSION_SECRET=your-random-32-char-secret
    volumes:
      - shelflife-data:/app/data

volumes:
  shelflife-data:
```

```bash
docker compose up -d
```

The app will be available at `http://localhost:3000`.

## Running on Unraid

### Option 1: Docker Compose (recommended)

If you have the **Compose Manager** plugin installed:

1. Add a new compose stack
2. Paste the docker-compose example above
3. Replace the environment variable values with your own
4. Change the volume to a host path for Unraid:
   ```yaml
   volumes:
     - /mnt/user/appdata/shelflife:/app/data
   ```
5. Start the stack

To update: restart the stack and it will pull the latest image.

### Option 2: Unraid Docker UI

1. In the Unraid Docker tab, click **Add Container** and fill in:

   | Field | Value |
   |---|---|
   | **Name** | `shelflife` |
   | **Repository** | `ghcr.io/fauxvo/shelflife:latest` |
   | **Port** | `3000` -> `3000` |
   | **Path** | `/mnt/user/appdata/shelflife` -> `/app/data` |

2. Add these environment variables:

   | Variable | Value |
   |---|---|
   | `OVERSEERR_URL` | `http://<your-unraid-ip>:5055` |
   | `OVERSEERR_API_KEY` | Your Overseerr API key |
   | `TAUTULLI_URL` | `http://<your-unraid-ip>:8181` |
   | `TAUTULLI_API_KEY` | Your Tautulli API key |
   | `SESSION_SECRET` | A random 32+ character string |

3. Click **Apply**

To update: click the container's **Update** button in the Docker tab, or use [Watchtower](https://containrrr.dev/watchtower/) for automatic updates.

### Option 3: XML Template

Copy `unraid/shelflife.xml` to `/boot/config/plugins/dockerMan/templates-user/` on your Unraid server. The template will appear in the Docker tab under **Add Container** with all fields pre-configured.

### Getting your API keys

- **Overseerr**: Settings > General > API Key
- **Tautulli**: Settings > Web Interface > API Key

### Generating a session secret

Run this on your Unraid terminal:
```bash
openssl rand -hex 32
```

## First login

1. Open Shelflife in your browser
2. Click **Sign in with Plex**
3. Authorize the app in the Plex popup
4. The first user to sign in automatically becomes the admin
5. Go to the Admin page and click **Sync** to pull in your Overseerr requests and Tautulli watch history
