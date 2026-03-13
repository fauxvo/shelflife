---
"shelflife": patch
---

Accurate media status from Sonarr/Radarr sync and code review fixes

- Sonarr sync now derives status from episodeFileCount: "pending" (0 episodes), "partial" (some missing), "available" (all present)
- Radarr sync now includes all movies (not just downloaded) with status from hasFile
- Status badge labels are now capitalized in the UI
- Nomination button hidden when no active review round exists (both user and admin views)
- Rate limit: non-admin users capped at 100 nominations per review round
- Community vote self-nomination check returns proper 403 instead of 404
- Extracted shared adoption helper for Sonarr/Radarr legacy item deduplication
- Replaced excessive console.log calls with debug.sync (gated by DEBUG env var)
- Added debug logging when enrichFromSeerr clears conflicting overseerrId references
- Replaced nested ternaries in SyncStatus with Record lookups
- Fixed ExternalLinkIcon to require className prop
- Improved mapWatchStatus typing (removed Record<string, any>)
- Review round close now runs all mutations in a single synchronous transaction
- Service settings "Test Connection" button now shows green success message and resets status when fields change
- File size sync errors no longer silently swallowed — re-thrown for orchestrator fault tolerance
