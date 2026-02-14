---
"shelflife": minor
---

Add optional Sonarr/Radarr/Overseerr deletion from admin review rounds

Admins can now execute real deletions directly from the review round panel. New features:

- **Service clients**: Radarr and Sonarr clients with configurable API keys (optional env vars)
- **Deletion orchestration**: ID mapping (tmdbId to Radarr, tvdbId to Sonarr, overseerrId to Overseerr), independent error handling per service, and race condition protection
- **Admin UI**: Action dropdown (Remove/Keep/Skip) with "Delete from Sonarr" or "Delete from Radarr" button, and a styled confirmation modal with optional file deletion
- **Audit trail**: New `deletion_log` table tracking per-service success/failure and error details
- **Configuration**: New optional env vars `SONARR_URL`, `SONARR_API_KEY`, `RADARR_URL`, `RADARR_API_KEY` — if not set, deletion buttons don't appear
