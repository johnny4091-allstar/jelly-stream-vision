# Netflix-style streaming front-end for your Plex library

A full browsing and watching experience built on top of your existing Plex Media Server at your IP address.

## One important thing first

Your Plex server is at an IP address rather than an HTTPS website. Browsers refuse to load plain `http://` content inside a secure site, so the app cannot talk to it directly. The app will route every request through its own backend, which reaches your server and passes images and video back safely. This works well, but it means video streams pass through the app rather than straight from your server.

If you later put your Plex server behind an `https://` address, we can switch to direct connections for better speed.

## What gets built

**Sign in**
- Login screen; authentication against Plex (either your Plex account or a server token).
- Session kept in an encrypted cookie so people stay signed in.
- Everything else in the app requires sign-in.

**Home**
- Full-bleed hero for a featured title with backdrop art, description, Play and More Info.
- Horizontal rows: On Deck / Continue Watching, Recently Added, Movies, Shows, and one row per library.
- Cards enlarge on hover with quick actions, like Netflix, but with our own accent color rather than Netflix red.

**Title pages**
- Movie page: backdrop, synopsis, year/rating/runtime, cast, Play and Resume.
- Show page: season picker, episode list with thumbnails, progress bars, next-up episode.

**Player**
- Full-screen video player with play/pause, seek, volume, subtitles and audio track selection, fullscreen, and skip forward/back.
- Watch progress reported back to Plex so On Deck stays accurate across your devices.

**Search**
- Instant search across movies, shows and episodes with poster results.

**Profiles**
- Optional profile-select screen if multiple Plex home users exist, styled like Netflix's "Who's watching?".

## Look and feel

Netflix-inspired, not a copy: near-black background, layered dark surfaces, tight bold type, poster-first layout, smooth hover-scale rows. Distinct accent color instead of Netflix red. Fully responsive, works on phone.

## Technical notes

- Plex calls go through TanStack Start server functions and server routes; the client never contacts the Plex host directly.
- Auth uses your Plex token (`X-Plex-Token`), stored securely as a secret (`PLEX_TOKEN`) along with the server URL (`PLEX_SERVER_URL`). I'll collect both via a secure form once you approve.
- Server routes proxy artwork (`/library/metadata/:key/thumb/...`) and video streams (direct stream and HLS transcode endpoints) with range-request passthrough so seeking works.
- Playback uses Plex's HLS/universal transcode where direct play isn't supported; `hls.js` loaded client-side only.
- Routes: `/` (home), `/login`, `/title/$id`, `/watch/$id`, `/search`, `/library/$id`.

## Open items

- Need from you: your Plex server URL and a Plex token (I can walk you through finding it — it takes about a minute).
- Some codecs may need Plex transcoding; if your server has no hardware transcoding, those titles could be slow.
