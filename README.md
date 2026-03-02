# Shelflife

Manage your Plex library storage. Shelflife connects to [Seerr](https://github.com/seerr-app/seerr) (or [Overseerr](https://overseerr.dev/)/[Jellyseerr](https://github.com/Fallenbagel/jellyseerr) for legacy setups) and [Tautulli](https://tautulli.com/) to let users vote on whether content they requested should be kept or deleted. Admins get a dashboard showing what can be safely pruned.

## How it works

1. Users sign in with their Plex account (same login as Seerr/Overseerr)
2. Shelflife syncs media requests from Seerr (or Overseerr) and watch history from Tautulli
3. Each user sees their own requests and marks them as **Keep** or **Can Delete**
4. Admins see an aggregate view of what users have flagged for deletion

By default Shelflife is read-only -- it syncs data but never modifies your external services. Optionally, admins can connect [Sonarr](https://sonarr.tv/) and [Radarr](https://radarr.video/) to execute deletions directly from the admin review dashboard.

## Requirements

- [Seerr](https://github.com/seerr-app/seerr), [Overseerr](https://overseerr.dev/) (legacy), or [Jellyseerr](https://github.com/Fallenbagel/jellyseerr) (legacy) -- for media request data
- [Tautulli](https://tautulli.com/) -- for watch history
- A Plex account

> **Note:** Both Overseerr and Jellyseerr have been archived and succeeded by Seerr (v3.0.0+). Shelflife supports all three -- configure `SEERR_URL`/`SEERR_API_KEY` for Seerr, `OVERSEERR_URL`/`OVERSEERR_API_KEY` for legacy Overseerr, or `JELLYSEERR_URL`/`JELLYSEERR_API_KEY` for legacy Jellyseerr. Seerr takes priority when multiple are configured.

### Tautulli setup for file size display

Shelflife shows file sizes alongside media items in the admin review panel to help prioritize deletions by storage impact. For **movies**, file sizes are pulled automatically from Tautulli. For **TV shows**, Tautulli does not calculate total file sizes by default, so Shelflife falls back to querying the Plex server directly using the admin user's Plex token.

To enable Tautulli-native file size calculation for TV shows (recommended for faster syncs):

1. Open Tautulli > **Settings** > **General**
2. Click **Show Advanced** at the top
3. Enable **Calculate Total File Sizes**
4. Save and restart Tautulli
5. Open each TV library's **Media Info** tab in Tautulli at least once to trigger the initial calculation

After this, Tautulli will return TV show file sizes in its API, and Shelflife will use those values. If the setting is not enabled, Shelflife will fall back to querying the Plex server API for TV episode sizes and aggregating them per show. This fallback works automatically but adds extra API calls during sync.

## Configuration

Only `SESSION_SECRET` is required to start. All service URLs and API keys can be configured through **Admin > Settings** after first login (DB settings take priority over env vars).

| Variable             | Required | Description                                                                            |
| -------------------- | -------- | -------------------------------------------------------------------------------------- |
| `SESSION_SECRET`     | Yes      | Random string for signing sessions (minimum 32 characters)                             |
| `SEERR_URL`          | No       | URL of your Seerr instance (e.g. `http://192.168.1.100:5055`)                          |
| `SEERR_API_KEY`      | No       | Found in Seerr under Settings > General                                                |
| `OVERSEERR_URL`      | No       | URL of your Overseerr instance (legacy fallback)                                       |
| `OVERSEERR_API_KEY`  | No       | Found in Overseerr under Settings > General                                            |
| `JELLYSEERR_URL`     | No       | URL of your Jellyseerr instance (legacy fallback)                                      |
| `JELLYSEERR_API_KEY` | No       | Found in Jellyseerr under Settings > General                                           |
| `TAUTULLI_URL`       | No       | URL of your Tautulli instance (e.g. `http://192.168.1.100:8181`)                       |
| `TAUTULLI_API_KEY`   | No       | Found in Tautulli under Settings > Web Interface                                       |
| `SONARR_URL`         | No       | URL of your Sonarr instance -- enables TV show deletion from admin                     |
| `SONARR_API_KEY`     | No       | Found in Sonarr under Settings > General                                               |
| `RADARR_URL`         | No       | URL of your Radarr instance -- enables movie deletion from admin                       |
| `RADARR_API_KEY`     | No       | Found in Radarr under Settings > General                                               |
| `PLEX_CLIENT_ID`     | No       | Identifier for Plex auth (defaults to `shelflife`)                                     |
| `ADMIN_PLEX_ID`      | No       | Force a specific Plex user as admin. If unset, the first user to sign in becomes admin |
| `DATABASE_PATH`      | No       | Path to SQLite database (defaults to `/app/data/shelflife.db` in Docker)               |
| `COOKIE_SECURE`      | No       | Set to `true` if behind HTTPS reverse proxy. Defaults to `false` for plain HTTP        |
| `DEBUG`              | No       | Set to `true` for verbose debug logging (useful for troubleshooting)                   |

> **Tip:** You can pass service URLs/keys as env vars for automated deployments, or skip them entirely and configure everything through the admin UI after your first Plex login.

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
      - SESSION_SECRET=your-random-32-char-secret
      # All service URLs/keys are optional — configure via Admin > Settings after first login
      # - SEERR_URL=http://your-ip:5055
      # - SEERR_API_KEY=your-key
      # - TAUTULLI_URL=http://your-ip:8181
      # - TAUTULLI_API_KEY=your-key
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

> **Important -- Networking:** Shelflife needs to reach your Seerr/Overseerr and Tautulli instances. On Unraid with the default bridge network, `localhost` and `127.0.0.1` refer to the container itself, not your server. Use your **Unraid server's IP address** (e.g. `http://192.168.1.100:5055`) when setting `SEERR_URL` (or `OVERSEERR_URL`) and `TAUTULLI_URL`.

### Getting your API keys

Before starting, grab these from your existing services:

- **Seerr API Key**: Open Seerr > Settings > General > scroll to **API Key** and copy it (or use your existing Overseerr API key if still on Overseerr)
- **Tautulli API Key**: Open Tautulli > Settings > Web Interface > scroll to **API Key** and copy it

### Generating a session secret

Shelflife needs a random secret string (minimum 32 characters) for signing login sessions. Run this in the Unraid terminal to generate one:

```bash
openssl rand -hex 32
```

Copy the output -- you'll paste it into the `SESSION_SECRET` field below.

### Option 1: Docker Compose (recommended)

Requires the [**Compose Manager**](https://forums.unraid.net/topic/114415-plugin-docker-compose-manager/) plugin.

1. In Compose Manager, click **Add New Stack**
2. Give it a name (e.g. `shelflife`)
3. Paste this into the compose editor:

   ```yaml
   services:
     shelflife:
       image: ghcr.io/fauxvo/shelflife:latest
       container_name: shelflife
       restart: unless-stopped
       ports:
         - "3000:3000"
       environment:
         - SESSION_SECRET=your-generated-secret-from-above
         # All service URLs/keys are optional — configure via Admin > Settings after first login
         # - SEERR_URL=http://YOUR_UNRAID_IP:5055
         # - SEERR_API_KEY=your-seerr-api-key
         # - TAUTULLI_URL=http://YOUR_UNRAID_IP:8181
         # - TAUTULLI_API_KEY=your-tautulli-api-key
         # - DEBUG=true  # Uncomment for verbose logging
       volumes:
         - /mnt/user/appdata/shelflife:/app/data
   ```

4. Replace `YOUR_UNRAID_IP` with your Unraid server's IP address
5. Replace the API keys and session secret with your actual values
6. Click **Compose Up**

**To update:** Click **Compose Down**, then **Pull**, then **Compose Up**. Or use [Watchtower](https://containrrr.dev/watchtower/) for automatic updates.

### Option 2: Unraid Docker UI

1. In the Unraid web UI, go to the **Docker** tab
2. Click **Add Container**
3. Toggle **Advanced View** in the top-right if not already enabled
4. Fill in the basic fields:

   | Field            | Value                             |
   | ---------------- | --------------------------------- |
   | **Name**         | `shelflife`                       |
   | **Repository**   | `ghcr.io/fauxvo/shelflife:latest` |
   | **Network Type** | `bridge`                          |

5. Click **Add another Path, Port, Variable, Label or Device** for each of the following:

   **Port mapping:**

   | Config Type | Name     | Container Port | Host Port |
   | ----------- | -------- | -------------- | --------- |
   | Port        | `Web UI` | `3000`         | `3000`    |

   **Volume mapping:**

   | Config Type | Name   | Container Path | Host Path                     |
   | ----------- | ------ | -------------- | ----------------------------- |
   | Path        | `Data` | `/app/data`    | `/mnt/user/appdata/shelflife` |

   **Environment variables** (add one at a time):

   | Config Type | Name             | Key                | Value                                                        |
   | ----------- | ---------------- | ------------------ | ------------------------------------------------------------ |
   | Variable    | Seerr URL        | `SEERR_URL`        | `http://YOUR_UNRAID_IP:5055` (or use `OVERSEERR_URL` legacy) |
   | Variable    | Seerr API Key    | `SEERR_API_KEY`    | Your Seerr API key (or use `OVERSEERR_API_KEY` legacy)       |
   | Variable    | Tautulli URL     | `TAUTULLI_URL`     | `http://YOUR_UNRAID_IP:8181`                                 |
   | Variable    | Tautulli API Key | `TAUTULLI_API_KEY` | Your Tautulli API key                                        |
   | Variable    | Session Secret   | `SESSION_SECRET`   | Your generated secret                                        |
   | Variable    | Sonarr URL       | `SONARR_URL`       | `http://YOUR_UNRAID_IP:8989` (optional)                      |
   | Variable    | Sonarr API Key   | `SONARR_API_KEY`   | Your Sonarr API key (optional)                               |
   | Variable    | Radarr URL       | `RADARR_URL`       | `http://YOUR_UNRAID_IP:7878` (optional)                      |
   | Variable    | Radarr API Key   | `RADARR_API_KEY`   | Your Radarr API key (optional)                               |
   | Variable    | Debug Logging    | `DEBUG`            | `true` (optional)                                            |

6. Click **Apply**

**To update:** Click the container icon in the Docker tab and select **Update**, or use [Watchtower](https://containrrr.dev/watchtower/) for automatic updates.

### Option 3: XML Template (quickest)

This imports a pre-configured template so you only need to fill in your values:

1. Open the Unraid terminal (or SSH in)
2. Run:
   ```bash
   mkdir -p /boot/config/plugins/dockerMan/templates-user
   wget -O /boot/config/plugins/dockerMan/templates-user/shelflife.xml \
     https://raw.githubusercontent.com/fauxvo/shelflife/main/unraid/shelflife.xml
   ```
3. Go to the **Docker** tab and click **Add Container**
4. From the **Template** dropdown, select **shelflife**
5. Fill in your Seerr URL (or Overseerr URL), API Key, Tautulli URL, Tautulli API Key, and Session Secret
6. Click **Apply**

The template has all ports, paths, and optional settings pre-configured. You just fill in your credentials.

### Troubleshooting

**"Connection refused" when syncing:** Your `SEERR_URL` (or `OVERSEERR_URL`) or `TAUTULLI_URL` is probably using `localhost` or `127.0.0.1`. Change it to your Unraid server's actual IP address (e.g. `http://192.168.1.100:5055`).

**Container starts but can't reach the web UI:** Make sure port 3000 isn't already in use by another container. You can change the host port (the left side) to something else, e.g. `3001:3000`.

**Database errors after update:** The SQLite database is stored in `/mnt/user/appdata/shelflife/`. As long as that volume mapping is correct, your data persists across container updates.

**Something not working? Enable debug logging:** Add the environment variable `DEBUG=true` to your container. This outputs detailed logs for auth, sync, and API calls. Check the container logs in the Unraid Docker tab (click the container icon > **Log**) to see what's happening.

## First login

1. Open Shelflife in your browser at `http://YOUR_UNRAID_IP:3000`
2. Click **Sign in with Plex**
3. Authorize the app in the Plex popup
4. The first user to sign in automatically becomes the admin
5. Go to **Admin > Settings** to configure your services (Seerr/Overseerr, Tautulli, Sonarr, Radarr) -- you can test connections right from the UI
6. Go to **Admin > Sync** to pull in your media requests and watch history
7. Share the URL with your Plex users so they can log in and vote on their own requests
