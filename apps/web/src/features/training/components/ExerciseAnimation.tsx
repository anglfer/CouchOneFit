import { Icon } from '../../../components/Icon';

// Catalog media is [still thumbnail, animated GIF]: the GIF covers the still,
// which remains visible with reduced motion (see training.css).
export default function ExerciseAnimation({
  images,
  name,
  size,
}: {
  images: string[];
  name: string;
  /** Fixed square size in px; omitted fills the container (max 220px). */
  size?: number;
}) {
  const style = size ? { width: size, maxWidth: size } : undefined;
  if (!images.length)
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
      {images.slice(0, 2).map((url, i) => (
        <img
          key={url}
          src={url}
          alt=""
          loading="lazy"
          data-frame={i}
          onError={(e) => {
            e.currentTarget.hidden = true;
          }}
        />
      ))}
    </div>
  );
}
