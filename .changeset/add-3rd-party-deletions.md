---
"shelflife": minor
---

Add optional Sonarr/Radarr/Overseerr deletion from admin review rounds

Admins can now execute real deletions from the review round panel when items are marked "remove". Sonarr and Radarr are opt-in via environment variables; Overseerr deletion uses the existing integration. Includes deletion audit log, per-service success/failure tracking, and a confirmation dialog with file deletion option.
