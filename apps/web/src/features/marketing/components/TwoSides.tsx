import { useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import { Icon, type IconName } from '../../../components/Icon';
import {
  BrowserFrame,
  PanelImage,
  PhoneFrame,
  PhoneImage,
  type PanelScreen,
  type PhoneScreen,
} from '../../../components/ProductShot';
import { ProductLightbox, type LightboxSlide } from './ProductLightbox';
import { TrackBackdrop } from './TrackBackdrop';

interface SyncScene {
  id: string;
  label: string;
  icon: IconName;
  phone: PhoneScreen;
  phoneAlt: string;
  panel: PanelScreen;
  panelLabel: string;
  panelAlt: string;
  panelViewClassName: string;
  clientItems: string[];
  professionalItems: string[];
  syncChip: string;
}

const syncScenes: SyncScene[] = [
  {
    id: 'checkin',
    label: 'Check-in diario',
    icon: 'chart',
    phone: 'movil-checkin',
    phoneAlt:
      'Check-in diario en la app del cliente: peso de 66,9 kg, 6,5 horas de sueño y estrés bajo, registrado el sábado 21 de noviembre.',
    panel: 'panel-seguimiento',
    panelLabel: 'Seguimiento · Mariana Ríos',
    panelAlt:
      'Seguimiento en el panel: adherencia a la alimentación de 63 % y peso corporal de 66.9 kg, 2.2 kg menos en cuatro semanas.',
    panelViewClassName:
      'aspect-[3.15/1] [--crop-x:38.3] [--crop-y:47] [--crop-w:39.4]',
    clientItems: [
      'Peso, sueño, energía, estrés, hambre y cumplimiento del día.',
      'Registro diario guiado en menos de un minuto.',
      'Correcciones permitidas hasta dos días después.',
    ],
    professionalItems: [
      'Adherencia al entrenamiento y alimentación en 7 días, 4 semanas o 3 meses.',
      'Peso corporal diario, separado del peso base y de tus evaluaciones.',
      'Tendencia por periodo con cobertura real de días con registro.',
    ],
    syncChip: '66,9 kg y 6,5 h de sueño → −2.2 kg en 4 semanas',
  },
  {
    id: 'entrenamiento',
    label: 'Sesión entrenada',
    icon: 'dumbbell',
    phone: 'movil-planes',
    phoneAlt:
      'Rutina semanal en la app del cliente: Fuerza y definición fase 2 con cinco días activos y 35 series.',
    panel: 'panel-entrenamiento',
    panelLabel: 'Actividad reciente · Mariana Ríos',
    panelAlt:
      'Actividad reciente de entrenamiento en el panel: Cardio y movilidad hoy con 3 de 3 series finalizadas, y sesiones anteriores.',
    panelViewClassName:
      'aspect-[1.55/1] [--crop-x:75] [--crop-y:37.5] [--crop-w:23.2]',
    clientItems: [
      'Cada ejercicio y serie del día tal como la diseñaste.',
      'Días de descanso integrados sin penalizar su cumplimiento.',
      'El cliente marca sus series realizadas, sin editar tu prescripción.',
    ],
    professionalItems: [
      'Historial fechado de cada sesión iniciada o finalizada.',
      'Detalle de series completadas frente a las programadas.',
      'Alertas en Inicio cuando alguien lleva días sin registrar actividad.',
    ],
    syncChip:
      'Fuerza y definición fase 2 → Cardio y movilidad · 3/3 series hoy',
  },
  {
    id: 'visibilidad',
    label: 'Visibilidad controlada',
    icon: 'sliders',
    phone: 'movil-progreso',
    phoneAlt:
      'Progreso en la app del cliente: total levantado, entrenamientos del mes, racha semanal y calendario de actividad.',
    panel: 'panel-expediente',
    panelLabel: 'Resumen y evaluación · Mariana Ríos',
    panelAlt:
      'Resumen del expediente en el panel: peso en check-ins de 66.9 kg y última evaluación de 26.7 % de grasa corporal.',
    panelViewClassName:
      'aspect-[2.95/1] [--crop-x:59.2] [--crop-y:31.2] [--crop-w:39.2]',
    clientItems: [
      'Su propio avance de entrenamientos, racha y peso diario.',
      'Consulta en caché segura sus planes activos y su historial propio.',
      'Solo ve medidas evaluadas o adherencia si tú decides compartirlas.',
    ],
    professionalItems: [
      'Control por cliente de qué secciones compartes en su app móvil.',
      'Si revocas visibilidad, deja de mostrarse en su siguiente lectura.',
      'Evaluaciones clínicas y notas internas siempre bajo tu criterio.',
    ],
    syncChip: 'Tú eliges qué ve en Progreso; tu expediente queda protegido',
  },
];

const sceneLightboxSlides: LightboxSlide[] = syncScenes.map((scene) => ({
  id: scene.id,
  title: `${scene.label} · App del cliente y panel profesional`,
  summary: scene.professionalItems[0],
  syncHighlight: scene.syncChip,
  panel: scene.panel,
  phone: scene.phone,
  panelAlt: scene.panelAlt,
  phoneAlt: scene.phoneAlt,
}));

function SideList({
  title,
  items,
}: {
  title: string;
  items: string[];
}): ReactElement {
  return (
    <div>
      <h3 className="text-xl font-semibold text-white">{title}</h3>
      <ul className="m-0 mt-5 list-none p-0">
        {items.map((item) => (
          <li
            key={item}
            className="border-t border-white/10 py-4 text-lg leading-snug text-[#e6e7f0]"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Pasaje espejado interactivo: lo que el cliente registra (izq.) y lo que ve el profesional (der.). */
export function TwoSides(): ReactElement {
  const [activeScene, setActiveScene] = useState(0);
  const [showMeasurements, setShowMeasurements] = useState(true);
  const [showAdherence, setShowAdherence] = useState(true);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const scene = syncScenes[activeScene];

  function selectScene(index: number, shouldFocus = false): void {
    setActiveScene(index);
    const target = tabRefs.current[index];
    if (target) {
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      if (shouldFocus) target.focus();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const last = syncScenes.length - 1;
    const keys: Record<string, number> = {
      ArrowRight: activeScene === last ? 0 : activeScene + 1,
      ArrowLeft: activeScene === 0 ? last : activeScene - 1,
      Home: 0,
      End: last,
    };
    const next = keys[event.key];
    if (next === undefined) return;
    event.preventDefault();
    selectScene(next, true);
  }

  const sharedItems: string[] = ['Entrenamientos y check-ins propios'];
  if (showMeasurements) sharedItems.push('Medidas evaluadas (26.7 % grasa)');
  if (showAdherence) sharedItems.push('Adherencia compartida (78 % / 63 %)');

  return (
    <section
      id="producto"
      aria-labelledby="two-sides-title"
      className="mk-on-color relative mt-24 scroll-mt-16 overflow-hidden bg-brand-night text-white sm:mt-32"
    >
      <TrackBackdrop variant="night" />

      <div className="relative z-10 mx-auto w-full max-w-[1240px] px-4 pt-20 sm:px-8 sm:pt-28">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2
              id="two-sides-title"
              className="max-w-[20ch] font-display text-[clamp(2rem,1.2rem+2.4vw,3.4rem)] font-semibold leading-[1.06] tracking-[-0.03em]"
            >
              Lo que tu cliente registra en su teléfono, lo ves en tu panel.
            </h2>
            <p className="mt-6 max-w-[58ch] text-lg leading-relaxed text-[#bbbfd3]">
              Un plan no cuenta toda la historia. El sueño, la energía, el
              estrés y el cumplimiento de cada día ayudan a entender cómo va
              cada persona.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsLightboxOpen(true)}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/20"
          >
            <Icon name="arrow-up-right" size={17} />
            Ver capturas en grande
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Escenas de sincronización entre app y panel"
          className="mk-tablist mt-10 gap-2 border-b border-white/10 pb-3"
          onKeyDown={handleKeyDown}
        >
          {syncScenes.map((item, index) => {
            const selected = index === activeScene;
            return (
              <button
                key={item.id}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                id={`escena-${item.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectScene(index)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-[15px] font-semibold transition-colors ${
                  selected
                    ? 'bg-brand-primary text-white'
                    : 'bg-white/8 text-[#bbbfd3] hover:bg-white/15 hover:text-white'
                }`}
              >
                <Icon name={item.icon} size={17} />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        role="tabpanel"
        tabIndex={0}
        aria-labelledby={`escena-${scene.id}`}
        className="relative z-10 mt-10 grid sm:mt-14 lg:grid-cols-2"
      >
        <div className="flex flex-col justify-between gap-10 bg-brand-night-2 px-4 py-12 sm:px-8 lg:py-20 lg:pl-[max(2rem,calc((100vw-1240px)/2+2rem))] lg:pr-[200px]">
          <div>
            <SideList title="En su app" items={scene.clientItems} />
            <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-3.5 py-2.5 text-sm text-[#e6e7f0]">
              <Icon
                name="swap"
                size={16}
                className="shrink-0 text-indigo-300"
              />
              <span>{scene.syncChip}</span>
            </div>
          </div>
          <p className="hidden max-w-[40ch] text-sm leading-relaxed text-[#8f97af] lg:block">
            La adherencia solo cuenta días con plan; descansos y días sin
            registro no cuentan como incumplidos. Son indicadores orientativos,
            no un diagnóstico.
          </p>
        </div>

        <PhoneFrame className="relative z-10 mx-auto -my-10 w-[min(64vw,250px)] lg:absolute lg:left-1/2 lg:top-1/2 lg:my-0 lg:w-[270px] lg:-translate-x-1/2 lg:-translate-y-1/2">
          {syncScenes.map((item, index) => (
            <PhoneImage
              key={item.id}
              screen={item.phone}
              alt={index === activeScene ? item.phoneAlt : ''}
              className={`transition-opacity duration-300 motion-reduce:transition-none ${
                index === activeScene ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))}
        </PhoneFrame>

        <div className="px-4 py-12 pt-20 sm:px-8 lg:py-20 lg:pl-[200px] lg:pr-[max(2rem,calc((100vw-1240px)/2+2rem))]">
          <div className="lg:max-w-[440px]">
            <SideList title="En tu panel" items={scene.professionalItems} />
          </div>

          {scene.id === 'visibilidad' && (
            <div className="mt-6 rounded-2xl border border-white/15 bg-brand-night-2 p-4 lg:max-w-[440px]">
              <p className="text-sm font-semibold text-white">
                Prueba el control de visibilidad para este cliente
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={showMeasurements}
                  onClick={() => setShowMeasurements((prev) => !prev)}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition-colors ${
                    showMeasurements
                      ? 'border-indigo-300 bg-brand-primary text-white'
                      : 'border-white/20 bg-white/5 text-[#bbbfd3] hover:bg-white/12'
                  }`}
                >
                  <Icon name={showMeasurements ? 'check' : 'close'} size={16} />
                  Medidas evaluadas
                </button>
                <button
                  type="button"
                  aria-pressed={showAdherence}
                  onClick={() => setShowAdherence((prev) => !prev)}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition-colors ${
                    showAdherence
                      ? 'border-indigo-300 bg-brand-primary text-white'
                      : 'border-white/20 bg-white/5 text-[#bbbfd3] hover:bg-white/12'
                  }`}
                >
                  <Icon name={showAdherence ? 'check' : 'close'} size={16} />
                  Adherencia compartida
                </button>
              </div>
              <p
                aria-live="polite"
                className="mt-3 text-sm leading-relaxed text-[#bbbfd3]"
              >
                <strong className="text-white">Visible hoy en su app: </strong>
                {sharedItems.join(' · ')}.
              </p>
            </div>
          )}

          <BrowserFrame
            label={scene.panelLabel}
            className="mt-8 lg:max-w-[440px]"
            viewClassName={scene.panelViewClassName}
          >
            <PanelImage screen={scene.panel} alt={scene.panelAlt} />
          </BrowserFrame>

          <p className="mt-8 text-sm leading-relaxed text-[#8f97af] lg:hidden">
            La adherencia solo cuenta días con plan; descansos y días sin
            registro no cuentan como incumplidos. Son indicadores orientativos,
            no un diagnóstico.
          </p>
        </div>
      </div>

      <ProductLightbox
        slides={sceneLightboxSlides}
        activeIndex={activeScene}
        initialDevice="phone"
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        onSelectIndex={(index) => setActiveScene(index)}
      />
    </section>
  );
}
