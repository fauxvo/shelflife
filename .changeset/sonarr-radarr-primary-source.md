---
"shelflife": minor
---

Add Sonarr/Radarr as primary content source with layered sync architecture

- Sonarr and Radarr now serve as the primary library source (Layer 1), with Seerr as optional enrichment (Layer 2) and Tautulli/Tracearr for watch history (Layer 3)
- Auto-detection: if \*arr services are configured, they're used as primary; otherwise falls back to legacy Seerr-only mode for backward compatibility
- Any authenticated user can now nominate any item (not just their own requests), with admin review rounds as the governance layer
- Default scope changed from "personal" to "all" to better support libraries without request tracking
- Transparent voting: community vote tallies now show voter usernames
- New sort options: "added_newest" and "added_oldest" using \*arr's added date
- Poster handling updated to support full TVDB URLs from Sonarr alongside TMDB relative paths
- Deletion service now uses direct sonarrId/radarrId when available, falling back to TMDB/TVDB lookup for legacy items
