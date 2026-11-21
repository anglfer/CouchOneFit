import type { ReactElement } from 'react';
import { PhoneShot, type PhoneScreen } from '../../../components/ProductShot';
import { SectionHeading } from './SectionHeading';

const screens: {
  screen: PhoneScreen;
  title: string;
  text: string;
  alt: string;
}[] = [
  {
    screen: 'movil-inicio',
    title: 'Su día',
    text: 'La rutina y la alimentación de hoy, en cuanto abre la app.',
    alt: 'Inicio de la app del cliente: semana con días entrenados, el entrenamiento de hoy, su check-in y la alimentación del día.',
  },
  {
    screen: 'movil-checkin',
    title: 'Su check-in',
    text: 'Peso, sueño, energía, estrés, hambre y cumplimiento en segundos.',
    alt: 'Check-in diario en la app: peso corporal, horas de sueño y nivel de estrés.',
  },
  {
    screen: 'movil-progreso',
    title: 'Su progreso',
    text: 'Su historial y lo que tú decidas compartir con él.',
    alt: 'Progreso en la app: kilos levantados, entrenamientos, racha semanal y actividad de los últimos meses.',
  },
];

export function ConnectedExperience(): ReactElement {
  return (
    <section
      className="bg-(--sg-orange) py-24 text-(--sg-ink) lg:py-32"
      aria-labelledby="client-app-title"
    >
      <div className="mx-auto w-full max-w-[1360px] px-4 sm:px-8">
        <SectionHeading
          id="client-app-title"
          title="Una app para tus clientes."
          className="[&_p]:text-(--sg-ink)"
        >
          Tus clientes ven solo lo que les asignas y registran su día desde el
          teléfono. Tú lo recibes en el panel.
        </SectionHeading>
      </div>
      <ul
        className="m-0 mt-14 flex list-none snap-x snap-mandatory gap-8 overflow-x-auto px-4 pb-4 sm:px-8 lg:mx-auto lg:grid lg:max-w-[1360px] lg:grid-cols-3 lg:gap-12 lg:overflow-visible"
        aria-label="Pantallas de la app del cliente"
        tabIndex={0}
      >
        {screens.map((item) => (
          <li
            key={item.screen}
            className="w-[72%] max-w-[300px] shrink-0 snap-center sm:w-[44%] lg:w-auto lg:max-w-none"
          >
            <PhoneShot
              screen={item.screen}
              alt={item.alt}
              className="mx-auto max-w-[300px]"
            />
            <h3 className="sg-display mt-7 text-lg font-bold">{item.title}</h3>
            <p className="mt-2 text-base leading-relaxed">{item.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
