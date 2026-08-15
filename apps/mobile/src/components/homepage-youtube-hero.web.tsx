import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

function extractYoutubeId(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] ?? null;
    if (host !== 'youtube.com') return null;
    if (url.pathname === '/watch') return url.searchParams.get('v');
    const parts = url.pathname.split('/').filter(Boolean);
    if (['embed', 'shorts', 'live'].includes(parts[0] ?? '')) return parts[1] ?? null;
    return null;
  } catch {
    return null;
  }
}

export function HomepageYoutubeHero({
  desktopUrl,
  mobileUrl,
  isPhone = false,
  fallbackSource,
}: {
  desktopUrl?: string | null | undefined;
  mobileUrl?: string | null | undefined;
  isPhone?: boolean;
  fallbackSource: { uri: string };
  style?: StyleProp<ViewStyle>;
}) {
  const selectedUrl = isPhone ? mobileUrl || desktopUrl : desktopUrl || mobileUrl;
  const videoId = useMemo(() => extractYoutubeId(selectedUrl), [selectedUrl]);
  const [mountPlayer, setMountPlayer] = useState(false);
  const [poster, setPoster] = useState(fallbackSource.uri);

  useEffect(() => {
    setPoster(fallbackSource.uri);
    if (!videoId) return undefined;

    let cancelled = false;
    let preload: HTMLImageElement | null = null;
    const remotePoster = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
    const warmPoster = () => {
      if (cancelled) return;
      preload = new window.Image();
      preload.decoding = 'async';
      preload.onload = () => {
        if (!cancelled) setPoster(remotePoster);
      };
      preload.src = remotePoster;
    };

    if (document.readyState === 'complete') {
      window.setTimeout(warmPoster, 0);
    } else {
      window.addEventListener('load', warmPoster, { once: true });
    }

    return () => {
      cancelled = true;
      if (preload) preload.onload = null;
      window.removeEventListener('load', warmPoster);
    };
  }, [fallbackSource.uri, videoId]);

  useEffect(() => {
    setMountPlayer(false);
    if (!videoId) return undefined;

    let cancelled = false;
    let idleHandle: number | undefined;
    let timeoutHandle: number | undefined;
    const browser = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const mount = () => {
      if (!cancelled) setMountPlayer(true);
    };
    const schedulePlayer = () => {
      if (cancelled) return;
      idleHandle = browser.requestIdleCallback?.(mount, { timeout: 1_500 });
      if (idleHandle === undefined) timeoutHandle = window.setTimeout(mount, 650);
    };

    if (document.readyState === 'complete') {
      schedulePlayer();
    } else {
      window.addEventListener('load', schedulePlayer, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener('load', schedulePlayer);
      if (idleHandle !== undefined) browser.cancelIdleCallback?.(idleHandle);
      if (timeoutHandle !== undefined) window.clearTimeout(timeoutHandle);
    };
  }, [videoId]);

  const embedUrl = videoId
    ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1`
    : null;

  return (
    <div aria-hidden="true" style={styles.frame}>
      <img alt="" decoding="async" src={poster} style={styles.poster} />
      {mountPlayer && embedUrl ? (
        <iframe
          allow="autoplay; encrypted-media; picture-in-picture"
          loading="eager"
          src={embedUrl}
          style={isPhone ? styles.playerPhone : styles.playerDesktop}
          tabIndex={-1}
          title="Chọn.love hero video"
        />
      ) : null}
    </div>
  );
}

const playerBase: CSSProperties = {
  border: 0,
  left: '50%',
  pointerEvents: 'none',
  position: 'absolute',
  top: '50%',
  transform: 'translate(-50%, -50%)',
};

const styles: Record<string, CSSProperties> = {
  frame: {
    backgroundColor: '#090909',
    contain: 'paint',
    height: '100%',
    inset: 0,
    maxWidth: '100vw',
    overflow: 'hidden',
    position: 'absolute',
    width: '100%',
  },
  poster: {
    height: '100%',
    inset: 0,
    objectFit: 'cover',
    position: 'absolute',
    width: '100%',
  },
  playerDesktop: {
    ...playerBase,
    height: '56.25vw',
    minHeight: '100%',
    width: '100vw',
  },
  playerPhone: {
    ...playerBase,
    height: '100%',
    maxHeight: '100%',
    maxWidth: '100%',
    minHeight: 0,
    minWidth: 0,
    width: '100%',
  },
};
