import { useState } from 'react';
import { Icon } from '../../../components/Icon';
import type { TrainingExercise } from '../types/training';
import ExerciseAnimation from './ExerciseAnimation';
import Modal from './Modal';

export default function ExerciseDemoModal({
  exercise,
  onClose,
  onLinkCatalog,
}: {
  exercise: TrainingExercise;
  onClose: () => void;
  onLinkCatalog?: () => void;
}) {
  const [paused, setPaused] = useState(false);
  const hasAnimation = exercise.images.length > 1;
  const hasImages = exercise.images.length > 0;

  return (
    <Modal
      title={exercise.name}
      subtitle={
        exercise.catalogId
          ? 'Ejercicio del catálogo'
          : 'Ejercicio personalizado'
      }
      onClose={onClose}
    >
      <div className="training-demo-stage">
        <ExerciseAnimation
          images={exercise.images}
          name={exercise.name}
          size={240}
          paused={paused}
        />
        {hasAnimation && (
          <button
            type="button"
            className="ws-btn"
            aria-pressed={paused}
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? 'Reanudar animación' : 'Pausar animación'}
          </button>
        )}
      </div>

      <div className="training-demo-chips">
        <span>
          {exercise.loadMode === 'bodyweight' ? 'Peso corporal' : 'Con peso'}
        </span>
        {exercise.restSeconds !== null && (
          <span>Descanso {exercise.restSeconds} s</span>
        )}
        {!exercise.catalogId && !hasImages && (
          <span data-tone="custom">Personalizado · sin demostración GIF</span>
        )}
      </div>

      {!hasImages && (
        <div className="ws-alert" data-tone="info">
          <p>
            Este ejercicio se creó de forma personalizada y no está ligado a una
            animación del catálogo.
          </p>
          {onLinkCatalog && (
            <button
              type="button"
              className="ws-btn mt-2"
              data-variant="primary"
              onClick={() => {
                onClose();
                onLinkCatalog();
              }}
            >
              <Icon name="link" size={16} /> Vincular con ejercicio del catálogo
            </button>
          )}
        </div>
      )}

      {exercise.instructions && (
        <section className="space-y-1">
          <h3>Indicaciones del profesional</h3>
          <p className="text-sm leading-relaxed text-(--ws-text-2)">
            {exercise.instructions}
          </p>
        </section>
      )}

      {exercise.guidance.length > 0 && (
        <section className="space-y-2">
          <h3>Técnica paso a paso</h3>
          <ol className="training-demo-steps">
            {exercise.guidance.map((step, i) => (
              <li key={i}>
                <span>{i + 1}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {hasImages && (
        <small className="training-credit">
          Animaciones ©{' '}
          <a
            href="https://gymvisual.com/"
            target="_blank"
            rel="nofollow noreferrer"
          >
            Gym visual
          </a>
        </small>
      )}
    </Modal>
  );
}
