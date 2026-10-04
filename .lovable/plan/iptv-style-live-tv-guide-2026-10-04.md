# IPTV-style Live TV guide

## What will change

- Replace only the `/live/guide` screen with a TV-first IPTV guide while keeping Channels, Recordings, and the existing channel-guide page intact.
- Add a scrollable category rail with **All channels** and **Favorites**, plus channel search. On phones, this becomes a compact horizontal selector above the preview.
- Show a muted 16:9 live preview beside current/next program details, progress, and a friendly unavailable state.
- Build a synchronized six-hour schedule: fixed channel identity cells, 30-minute time marks, a moving now line, proportional program blocks, and a no-information block when listings are absent.
- Page channel rows in small batches so large groups remain responsive; request guide data only for the current batch.
- Support pointer, touch, and TV remote behavior: one-second focused preview, second activation opens the full player, clear focus rings, and Back returns from the guide rows to categories before leaving.
- Add translations for all new labels in English, Spanish, and French.

## Channel groups

- Request `Genres` and `Tags` with each Live TV channel and expose normalized server groups from `getLiveChannelsFn`.
- Filter and count groups on the server before pagination.
- When the media server supplies no group/tag for a channel, retain the current name-based category fallback so every channel stays discoverable. The final summary will state whether real server groups could be confirmed during testing.

## Preview playback

- Extract the existing live-session playback lifecycle into a small shared hook used by both the full-screen player and the guide preview.
- Preserve the current H.264/AAC stream negotiation, 12-second loading safety timer, one automatic fresh-session retry, 20-second stall watchdog, 30-second healthy reset, session reporting, `LiveStreamId`, and transcode cleanup.
- The guide preview will be muted, debounced, and limited to one active stream. Changing selection or leaving the page will stop and release the previous session.
- A failed preview remains selectable and opens normally in the full-screen player.

## Technical details

- Update `src/lib/livetv.functions.ts` for group metadata, group counts, and server-side filtering.
- Add a reusable live playback hook under `src/hooks/`, then adapt `src/routes/live.watch.$channelId.tsx` without changing its visible full-screen controls.
- Rebuild `src/routes/live.guide.tsx` with semantic theme classes and existing Button/Link components.
- Update `src/lib/i18n.tsx` and document the shared playback architecture in `AGENTS.md`.
- Add focused tests for category normalization/filtering if the current test setup supports them; otherwise verify through the server function and rendered guide.
- Run the TypeScript check, app build, and responsive browser checks at desktop and phone widths. Authenticated live-stream behavior will be verified if a usable preview session is available; otherwise it will be listed explicitly as unverified.

## Scope boundaries

- No changes to Android folders, release metadata, workflows, proxying, movie/episode playback, authentication, or Roku APIs.
