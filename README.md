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

| Variable            | Required | Description                                                                            |
| ------------------- | -------- | -------------------------------------------------------------------------------------- |
| `OVERSEERR_URL`     | Yes      | URL of your Overseerr instance (e.g. `http://192.168.1.100:5055`)                      |
| `OVERSEERR_API_KEY` | Yes      | Found in Overseerr under Settings > General                                            |
| `TAUTULLI_URL`      | Yes      | URL of your Tautulli instance (e.g. `http://192.168.1.100:8181`)                       |
| `TAUTULLI_API_KEY`  | Yes      | Found in Tautulli under Settings > Web Interface                                       |
| `SESSION_SECRET`    | Yes      | Random string for signing sessions (minimum 32 characters)                             |
| `PLEX_CLIENT_ID`    | No       | Identifier for Plex auth (defaults to `shelflife`)                                     |
| `ADMIN_PLEX_ID`     | No       | Force a specific Plex user as admin. If unset, the first user to sign in becomes admin |
| `DATABASE_PATH`     | No       | Path to SQLite database (defaults to `/app/data/shelflife.db` in Docker)               |
| `DEBUG`             | No       | Set to `true` for verbose debug logging (useful for troubleshooting)                   |

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

> **Important -- Networking:** Shelflife needs to reach your Overseerr and Tautulli instances. On Unraid with the default bridge network, `localhost` and `127.0.0.1` refer to the container itself, not your server. Use your **Unraid server's IP address** (e.g. `http://192.168.1.100:5055`) when setting `OVERSEERR_URL` and `TAUTULLI_URL`.

### Getting your API keys

Before starting, grab these from your existing services:

- **Overseerr API Key**: Open Overseerr > Settings > General > scroll to **API Key** and copy it
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
         - OVERSEERR_URL=http://YOUR_UNRAID_IP:5055
         - OVERSEERR_API_KEY=your-overseerr-api-key
         - TAUTULLI_URL=http://YOUR_UNRAID_IP:8181
         - TAUTULLI_API_KEY=your-tautulli-api-key
         - SESSION_SECRET=your-generated-secret-from-above
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

   | Config Type | Name              | Key                 | Value                        |
   | ----------- | ----------------- | ------------------- | ---------------------------- |
   | Variable    | Overseerr URL     | `OVERSEERR_URL`     | `http://YOUR_UNRAID_IP:5055` |
   | Variable    | Overseerr API Key | `OVERSEERR_API_KEY` | Your Overseerr API key       |
   | Variable    | Tautulli URL      | `TAUTULLI_URL`      | `http://YOUR_UNRAID_IP:8181` |
   | Variable    | Tautulli API Key  | `TAUTULLI_API_KEY`  | Your Tautulli API key        |
   | Variable    | Session Secret    | `SESSION_SECRET`    | Your generated secret        |
   | Variable    | Debug Logging     | `DEBUG`             | `true` (optional)            |

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
5. Fill in your Overseerr URL, Overseerr API Key, Tautulli URL, Tautulli API Key, and Session Secret
6. Click **Apply**

The template has all ports, paths, and optional settings pre-configured. You just fill in your credentials.

### Troubleshooting

**"Connection refused" when syncing:** Your `OVERSEERR_URL` or `TAUTULLI_URL` is probably using `localhost` or `127.0.0.1`. Change it to your Unraid server's actual IP address (e.g. `http://192.168.1.100:5055`).

**Container starts but can't reach the web UI:** Make sure port 3000 isn't already in use by another container. You can change the host port (the left side) to something else, e.g. `3001:3000`.

**Database errors after update:** The SQLite database is stored in `/mnt/user/appdata/shelflife/`. As long as that volume mapping is correct, your data persists across container updates.

**Something not working? Enable debug logging:** Add the environment variable `DEBUG=true` to your container. This outputs detailed logs for auth, sync, and API calls. Check the container logs in the Unraid Docker tab (click the container icon > **Log**) to see what's happening.

## First login

1. Open Shelflife in your browser at `http://YOUR_UNRAID_IP:3000`
2. Click **Sign in with Plex**
3. Authorize the app in the Plex popup
4. The first user to sign in automatically becomes the admin
5. Go to the Admin page and click **Sync** to pull in your Overseerr requests and Tautulli watch history
6. Share the URL with your Plex users so they can log in and vote on their own requests
