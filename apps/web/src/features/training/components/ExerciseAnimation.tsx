// The catalog ships start/peak frames; alternating them gives a looping
// GIF-like demonstration without redistributing or deriving new media.
export default function ExerciseAnimation({
  images,
  name,
}: {
  images: string[];
  name: string;
}) {
  if (!images.length) return null;
  return (
    <div
      className="training-anim"
      role="img"
      aria-label={`Demostración de ${name}`}
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
