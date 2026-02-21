---
"shelflife": minor
---

Add Seerr support as the primary request service, with Overseerr and Jellyseerr as legacy fallbacks. Auto-detects the active provider from env vars (Seerr > Overseerr > Jellyseerr) and dynamically reflects the provider name in all UI labels.
