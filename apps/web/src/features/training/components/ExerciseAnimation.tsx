import { useState } from 'react';
import { Icon } from '../../../components/Icon';

// Catalog media is [still thumbnail, animated GIF]: the GIF covers the still,
// which remains visible with reduced motion or when paused (see training.css).
export default function ExerciseAnimation({
  images,
  name,
  size,
  paused = false,
}: {
  images: string[];
  name: string;
  /** Fixed square size in px; omitted fills the container (max 220px). */
  size?: number;
  paused?: boolean;
}) {
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const style = size
    ? { width: size, height: size, maxWidth: size }
    : undefined;
  const frames = (paused ? images.slice(0, 1) : images.slice(0, 2)).filter(
    (url) => !failedUrls.includes(url)
  );
  if (!frames.length)
    return (
      <div className="training-anim" data-empty style={style} aria-hidden>
        <Icon name="dumbbell" size={size ? Math.round(size / 2.6) : 48} />
      </div>
    );
  return (
    <div
      className="training-anim"
      role="img"
      aria-label={`Demostración de ${name}`}
      style={style}
    >
      {frames.map((url, i) => (
        <img
          key={url}
          src={url}
          alt=""
          loading="lazy"
          data-frame={paused ? 0 : i}
          onError={() => {
            setFailedUrls((prev) =>
              prev.includes(url) ? prev : [...prev, url]
            );
          }}
        />
      ))}
    </div>
  );
}
