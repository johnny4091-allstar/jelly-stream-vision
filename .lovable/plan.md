# Live TV for Aurora

Your media server's Live TV is live and returning channels with "now playing" info, so Aurora can surface the full experience: channels, guide, recordings, and category/tag browsing.

## What you'll get

**Live TV page (`/live`)**
- Grid of channel cards with channel logo, number, name, and what's on right now with a progress bar.
- Category/tag filter chips across the top (News, Sports, Kids, Movies, Entertainment, plus favorites and recently watched). Categories come from the genres/tags your server reports on the current program, with channel-name fallback rules so every channel lands somewhere.
- Search box to jump to a channel by name or number.
- Favorite (heart) a channel so it pins to the top.

**Guide**
- "Now & Next" view by default, plus a scrollable time-grid guide showing several hours of programming across channels.
- Tap a program for details: title, description, time, episode info, and a Watch or Record button.

**Recordings**
- Recorded shows list with posters, duration, and playback.
- Scheduled recordings and series recordings, with the ability to cancel.
- Record button on any program in the guide (single or whole series).

**Playback**
- Channels play through the existing player with the same 4 Mbps cap, no subtitles, and HLS conversion path already used for movies.
- Live-specific UI: LIVE badge, channel name overlay, up/down channel switching from the remote on the TV app, and no resume-position logic.

**Navigation**
- "Live TV" entry added to the top nav on phone and TV, translated into English, Spanish, and French.

## Technical notes

- New `src/lib/livetv.functions.ts` server functions wrapping the server's Live TV API: channels (with current program), guide programs for a time window, program details, recordings, timers/series timers, create/cancel timer, and channel favorite toggle. All reuse the existing session + `jfGet`/`jfPost`/`jfDelete` helpers.
- Channel and recording playback reuse `getPlaybackInfoFn` and the existing `/api/proxy` HLS path; live streams skip start-position ticks and progress reporting writes a "Live TV" entry to watch history.
- New routes: `src/routes/live.tsx` (channels + categories), `src/routes/live.guide.tsx` (time grid), `src/routes/live.recordings.tsx`. Channel playback goes through the existing `watch.$id` route with a `live` flag.
- New components: `ChannelCard`, `GuideGrid`, `ProgramDialog`, reusing existing card/dialog styling.
- Queries use short stale times (30s for now-playing, 5 min for the guide) so "what's on" stays accurate; channel list polls every 60s.
- i18n strings added for all new labels in the three existing languages.
