import { createAudioPlayer, setAudioModeAsync, useAudioPlayerStatus, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { Episode } from '../media';

interface AudioValue {
  episode: Episode | null;
  status: AudioStatus;
  play: (episode: Episode) => void;
  toggle: () => void;
  /** Jumps back or forward by this many seconds. */
  skip: (seconds: number) => void;
  stop: () => void;
}

/** Height the mini player takes, so screens can leave room for it. */
export const MINI_PLAYER_SPACE = 76;

const AudioContext = createContext<AudioValue | null>(null);

/**
 * One podcast player for the whole app. It keeps playing with the screen off and shows controls
 * on the lock screen and in the notification shade.
 */
export function AudioProvider({ children }: { children: ReactNode }) {
  const playerRef = useRef<AudioPlayer | null>(null);
  if (!playerRef.current) playerRef.current = createAudioPlayer(null, { updateInterval: 1000 });
  const player = playerRef.current;
  const status = useAudioPlayerStatus(player);
  const [episode, setEpisode] = useState<Episode | null>(null);
  const modeSet = useRef(false);

  useEffect(() => () => player.remove(), [player]);

  const play = useCallback(
    (ep: Episode) => {
      if (!modeSet.current) {
        modeSet.current = true;
        setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' }).catch(() => {});
      }
      if (episode?.id === ep.id) {
        player.play();
        return;
      }
      player.replace({ uri: ep.audioUrl });
      player.play();
      try {
        player.setActiveForLockScreen(true, { title: ep.title, artist: ep.show, albumTitle: ep.publisher, artworkUrl: ep.imageUrl });
      } catch {
        // Lock screen controls are a nicety; playback works without them.
      }
      setEpisode(ep);
    },
    [player, episode],
  );

  const toggle = useCallback(() => {
    if (player.playing) player.pause();
    else player.play();
  }, [player]);

  const skip = useCallback(
    (seconds: number) => {
      const to = Math.max(0, Math.min(player.currentTime + seconds, player.duration || Infinity));
      player.seekTo(to).catch(() => {});
    },
    [player],
  );

  const stop = useCallback(() => {
    player.pause();
    try {
      player.setActiveForLockScreen(false);
    } catch {
      // Already off.
    }
    setEpisode(null);
  }, [player]);

  const value = useMemo<AudioValue>(() => ({ episode, status, play, toggle, skip, stop }), [episode, status, play, toggle, skip, stop]);
  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}

export function useAudio(): AudioValue {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error('useAudio must be used inside AudioProvider');
  return ctx;
}
