# Netflix-style streaming front-end for your Jellyfin library

A full browsing and watching experience built on top of your existing Jellyfin server at `http://76.8.230.133:8096`.

## One important thing first

Your server address is plain `http://` at an IP, not `https://`. Browsers refuse to load `http://` content inside a secure site, so the app cannot talk to it directly from the browser. The app will instead route every request through its own backend, which can reach your server and pass images and video back safely. This works, but it means video streams pass through the app rather than straight from your server. If you later put your server behind an `https://` address, we can switch to direct connections for better speed.

## What gets built

**Sign in**
- Login screen asking for Jellyfin username and password, checked against your server.
- Session kept in an encrypted cookie so people stay signed in.
- Everything else in the app requires sign-in.

**Home**
- Full-bleed hero for a featured title with backdrop art, description, Play and More Info.
- Horizontal rows: Continue Watching, Recently Added, Movies, Shows, and one row per library.
- Cards enlarge on hover with quick actions, like Netflix, but with our own accent color rather than Netflix red.

**Title pages**
- Movie page: backdrop, synopsis, year/rating/runtime, cast, Play and Resume.
- Show page: season picker, episode list with thumbnails, progress bars, next-up episode.

**Player**
- Full-screen video player with play/pause, seek, volume, subtitles and audio track selection, fullscreen, and skip forward/back.
- Watch progress reported back to Jellyfin so Continue Watching stays accurate across your devices.

**Search**
- Instant search across movies, shows and episodes with poster results.

**Profiles**
- Jellyfin user switcher on a profile-select screen after login, styled like Netflix's "Who's watching?".

## Look and feel

Netflix-inspired, not a copy: near-black background, layered dark surfaces, tight bold type, poster-first layout, smooth hover-scale rows. Distinct accent color instead of Netflix red. Fully responsive, works on phone.

## Technical notes

- Jellyfin calls go through TanStack Start server functions and a small set of server routes; the client never contacts the Jellyfin host directly (mixed content + CORS).
- Auth via Jellyfin `/Users/AuthenticateByName`; the returned access token is stored in an encrypted session cookie, never exposed to the browser.
- Your Jellyfin API key (`JELLYFIN_API_KEY`) and server URL (`JELLYFIN_SERVER_URL`) will be stored securely as secrets; I'll collect the API key via a secure form once you approve.
- Server routes proxy `/Items/{id}/Images/*` and video (`/Videos/{id}/stream`, plus HLS segments) with range-request passthrough so seeking works.
- Playback uses direct-play/remux via HLS where the browser supports it; `hls.js` loaded client-side only.
- Routes: `/` (home), `/login`, `/profiles`, `/title/$id`, `/watch/$id`, `/search`, `/library/$id`.

## Open items

- Playback of some codecs (HEVC, certain audio) may require Jellyfin transcoding; if your server has no hardware transcoding, those titles could be slow. We'll see once it's running.
