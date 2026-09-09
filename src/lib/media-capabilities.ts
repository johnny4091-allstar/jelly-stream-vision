/**
 * Probe what this browser/device can actually play, so Jellyfin can direct-play
 * the original file (MKV, MP4, MOV, TS, WebM …) instead of always transcoding.
 */
export interface DirectPlayProfile {
  container: string;
  videoCodecs: string[];
  audioCodecs: string[];
}

const VIDEO_CODEC_MIMES: Record<string, string[]> = {
  h264: ['avc1.640029', 'avc1.42E01E'],
  hevc: ['hvc1.1.6.L93.B0', 'hev1.1.6.L93.B0'],
  vp9: ['vp09.00.10.08', 'vp9'],
  av1: ['av01.0.05M.08'],
  vp8: ['vp8'],
  mpeg4: ['mp4v.20.8'],
};

const AUDIO_CODEC_MIMES: Record<string, string[]> = {
  aac: ['mp4a.40.2'],
  mp3: ['mp4a.69', 'mp3'],
  opus: ['opus'],
  vorbis: ['vorbis'],
  flac: ['flac'],
  ac3: ['ac-3'],
  eac3: ['ec-3'],
};

/** container -> base MIME types worth probing for that container */
const CONTAINERS: { container: string; mimes: string[] }[] = [
  { container: 'mp4,m4v,mov', mimes: ['video/mp4'] },
  // Do not infer Matroska support from MP4 codec support. Chrome/WebView can
  // decode many codecs found in MKV but cannot demux the MKV container itself.
  { container: 'mkv', mimes: ['video/x-matroska'] },
  { container: 'webm', mimes: ['video/webm'] },
  { container: 'ts', mimes: ['video/mp2t'] },
];

function supported(mime: string): boolean {
  if (typeof window === 'undefined') return false;
  const ms = (window as unknown as { MediaSource?: { isTypeSupported?: (t: string) => boolean } })
    .MediaSource;
  if (ms?.isTypeSupported?.(mime)) return true;
  try {
    const v = document.createElement('video');
    return v.canPlayType(mime) !== '';
  } catch {
    return false;
  }
}

let cached: DirectPlayProfile[] | null = null;

export function detectDirectPlayProfiles(): DirectPlayProfile[] {
  if (cached) return cached;
  if (typeof window === 'undefined') return [];

  const profiles: DirectPlayProfile[] = [];

  for (const { container, mimes } of CONTAINERS) {
    const videoCodecs: string[] = [];
    const audioCodecs: string[] = [];

    for (const [codec, candidates] of Object.entries(VIDEO_CODEC_MIMES)) {
      const ok = mimes.some((base) => candidates.some((c) => supported(`${base}; codecs="${c}"`)));
      if (ok) videoCodecs.push(codec);
    }
    for (const [codec, candidates] of Object.entries(AUDIO_CODEC_MIMES)) {
      const ok = mimes.some((base) => candidates.some((c) => supported(`${base}; codecs="${c}"`)));
      if (ok) audioCodecs.push(codec);
    }

    if (videoCodecs.length && audioCodecs.length) {
      profiles.push({ container, videoCodecs, audioCodecs });
    }
  }

  // Always keep a baseline so a stingy probe never disables direct play entirely.
  if (!profiles.length) {
    profiles.push({
      container: 'mp4,m4v',
      videoCodecs: ['h264'],
      audioCodecs: ['aac', 'mp3'],
    });
  }

  cached = profiles;
  return profiles;
}
