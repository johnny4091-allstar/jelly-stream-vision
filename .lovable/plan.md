# Play more video formats (MKV, MP4, and friends)

Right now Aurora only plays a file straight through when it is an MP4 or WebM with common codecs. Everything else — MKV, AVI, MOV, TS, HEVC, and most surround audio — is converted by the Jellyfin server on the fly. That works but costs quality and can stutter.

## What changes

- Aurora asks the browser (or the Android app) what it can actually play, then tells the media server the full list.
- Files the device can handle play directly at full original quality: MP4, M4V, MOV, WebM, MKV (where supported), and TS.
- Codecs added to the direct list: H.264, HEVC/H.265, VP9, AV1 for video; AAC, MP3, Opus, Vorbis, FLAC, AC-3, E-AC-3 for sound.
- Anything the device cannot play still converts automatically, exactly as today, so nothing that works now breaks.
- The player shows which mode is in use (Direct or Converted) in the info line, so it is obvious why a title looks better or worse.

## Technical notes

- `src/lib/jellyfin.functions.ts`: `getPlaybackInfoFn` gains an optional `capabilities` input (array of container/codec support flags). The `DeviceProfile.DirectPlayProfiles` is built from those flags instead of the hardcoded mp4/webm pair. `TranscodingProfiles` (HLS/TS/H.264/AAC) stays as the fallback. Return value adds `playMethod: 'DirectPlay' | 'DirectStream' | 'Transcode'`.
- New `src/lib/media-capabilities.ts` (client-safe): probes `MediaSource.isTypeSupported` and `video.canPlayType` for each container/codec pair once, memoized, returns the flag list.
- `src/routes/watch.$id.tsx`: probes capabilities before calling `getPlaybackInfoFn`, passes them in; when the server returns a direct-play source it loads the proxied file URL directly instead of HLS; HLS path unchanged otherwise. Existing retry/recovery logic is kept, and the current no-raw-MKV-fallback guard is replaced by "fall back only to the converted HLS stream".
- Progress reporting sends the real `PlayMethod` rather than a hardcoded `"Transcode"`.

## Not included

- Server-side conversion of formats Jellyfin itself cannot handle — that is a Jellyfin/ffmpeg limitation, not something Aurora can change.
