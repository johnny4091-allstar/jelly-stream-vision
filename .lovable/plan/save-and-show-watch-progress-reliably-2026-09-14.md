# Save and show watch progress reliably

Today the app tells the media server you're watching, but the saved position often ends up as 0, and the app's own history keeps rows with no position or runtime. Result: "Continue watching" and the progress bars under posters are often wrong or missing.

## What changes

**Progress is saved properly while you watch**
- Position is sent to the media server right when playback starts, then every 10 seconds, on pause, on seek, and when you leave — with the user identity attached so the server stores it against your account.
- When you finish something (past ~92%), it's marked watched and removed from Continue Watching automatically.
- Very short views (under ~10 seconds) no longer overwrite a good saved position with 0.

**The app keeps its own copy**
- Every play also records position, total length, and time watched in the app, so progress survives even if the media server misses a report.
- Continue Watching falls back to the app's own record when the server has nothing for that title.

**You can see it everywhere**
- Progress bar on posters across home, search, library and watchlist, using whichever source is further along.
- Title pages show "Resume from 12:34" instead of just Play when there's a saved spot.
- Live TV is excluded — live channels have no resume position.

## Technical notes

- `reportPlayingFn`: add `UserId`, `MediaSourceId`, and `IsPaused`; add a `Started` report on first frame and flush a final `Stopped` with `navigator.sendBeacon`-style teardown already present. Report interval stays 10s but also fires on `pause`, `seeked`, and `ended`.
- Guard: skip reports and history writes when `currentTime < 10` unless it's the initial `Started` call.
- `logWatchFn` calls always pass `runtimeSeconds` from the item's `RunTimeTicks` when the video element hasn't reported duration yet, and `positionSeconds` from the live element rather than the stale `time` state.
- On `ended` or >92% progress, call the existing `setPlayedFn` and invalidate `["home"]`, `["item", id]`, `["history"]`.
- `getHomeFn`: after fetching `/Items/Resume`, merge in `watch_history` rows (position between 1% and 92%, last 30 days) that the server didn't return, hydrating item details via a batched `/Users/{id}/Items?Ids=`.
- `MediaCard` uses `max(UserData.PlayedPercentage, history percentage)` supplied through a lightweight progress map in the home/library loaders.
