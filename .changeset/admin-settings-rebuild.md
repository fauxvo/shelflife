---
"shelflife": minor
---

Add DB-backed service configuration with admin settings UI

- Multi-page admin section with shared layout and tab navigation (Overview, Settings, Sync, Users, Reviews)
- Service URLs and API keys stored in DB (`app_settings` table) with env var fallback
- Settings UI with service cards, connection testing, and request provider selection
- Refactored all service clients to accept explicit config params
- Only `SESSION_SECRET` is required — everything else can be configured through the admin UI
