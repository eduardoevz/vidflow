import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface VideoPlayerProps {
  src: string;
  protocol: 'hls' | 'dash' | 'https' | 'http' | 'direct';
  poster?: string;
}

export function VideoPlayer({ src, protocol, poster }: VideoPlayerProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (protocol === 'hls' && Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      return () => hls.destroy();
    }

    video.src = src;
    return undefined;
  }, [src, protocol]);

  return (
    <video
      ref={videoRef}
      poster={poster}
      controls
      className="aspect-video w-full rounded-card bg-black"
    >
      No es posible reproducir este video en tu navegador.
    </video>
  );
}
