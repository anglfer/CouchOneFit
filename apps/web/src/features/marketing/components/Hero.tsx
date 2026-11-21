import { useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import { Icon } from '../../../components/Icon';
import { Link } from '../../../components/Link';
import {
  PanelShot,
  PhoneShot,
  type PanelScreen,
  type PhoneScreen,
} from '../../../components/ProductShot';
import { SignTitle } from '../../../components/SignTitle';
import { MODULES, ModuleChip, type ModuleId } from '../modules';

type Module = {
  id: ModuleId;
  panel: PanelScreen;
  panelAlt: string;
  phone: PhoneScreen;
  phoneAlt: string;
  caption: string;
};

const modules: Module[] = [
  {
    id: 'evaluacion',
    panel: 'panel-expediente',
    panelAlt:
      'Expediente de una clienta en el panel: entrenamiento de la semana, plan alimenticio activo, peso en check-ins y última evaluación con su porcentaje de grasa.',
    phone: 'movil-progreso',
    phoneAlt:
      'Pantalla Progreso de la app del cliente con kilos levantados, entrenamientos, racha semanal y actividad de los últimos meses.',
    caption:
      'Bioimpedancia, perímetros o pliegues con fecha. Cada evaluación queda en el expediente y alimenta la evolución.',
  },
  {
    id: 'alimentacion',
    panel: 'panel-nutricion',
    panelAlt:
      'Plan de alimentación activo en el panel: calorías objetivo, macros, hidratación y cuatro tiempos de comida.',
    phone: 'movil-inicio',
    phoneAlt:
      'Inicio de la app del cliente con el entrenamiento de hoy, su check-in registrado y la alimentación del día.',
    caption:
      'Tiempos de comida, alimentos, equivalentes y macros. Tu cliente ve el plan vigente en su teléfono.',
  },
  {
    id: 'entrenamiento',
    panel: 'panel-entrenamiento',
    panelAlt:
      'Rutina activa de una clienta en el panel: semana con cinco días de entrenamiento y la actividad reciente registrada desde el móvil.',
    phone: 'movil-planes',
    phoneAlt:
      'Pantalla Planes de la app del cliente con su rutina semanal día por día.',
    caption:
      'Rutinas por día con series, repeticiones, carga y descanso. Tu cliente registra cada serie al entrenar.',
  },
  {
    id: 'seguimiento',
    panel: 'panel-seguimiento',
    panelAlt:
      'Seguimiento de una clienta en el panel: adherencia al entrenamiento y a la alimentación, peso corporal y check-ins de cuatro semanas.',
    phone: 'movil-checkin',
    phoneAlt:
      'Check-in diario en la app del cliente con peso corporal, horas de sueño y estrés.',
    caption:
      'Peso, sueño, energía, estrés, hambre y cumplimiento del día. Lo que tu cliente registra llega a tu panel.',
  },
];
// Orden de anillos del contrato (rosa, cobalto, naranja); el activo pasa al primer anillo.
const palette = (
  ['seguimiento', 'entrenamiento', 'evaluacion', 'alimentacion'] as const
).map((id) => MODULES[id].color);

function preload(module: Module): void {
  for (const screen of [module.panel, module.phone])
    new Image().src = `/marketing/${screen}.webp`;
}

export function Hero(): ReactElement {
  const [selected, setSelected] = useState(modules.length - 1);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const active = modules[selected];
  const activeModule = MODULES[active.id];
  const others = palette.filter((color) => color !== activeModule.color);
  const rings = {
    ring1: activeModule.color,
    ring2: others[0],
    ring3: others[1],
  };

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const last = modules.length - 1;
    const next =
      event.key === 'ArrowRight'
        ? selected === last
          ? 0
          : selected + 1
        : event.key === 'ArrowLeft'
          ? selected === 0
            ? last
            : selected - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    setSelected(next);
    tabs.current[next]?.focus();
  }

  return (
    <section
      className="border-b-[3px] border-(--sg-ink)"
      aria-labelledby="hero-title"
    >
      <div className="mx-auto grid w-full max-w-[1360px] gap-14 px-4 pb-20 pt-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-10 lg:pb-24 lg:pt-14">
        <div className="flex min-w-0 flex-col">
          <SignTitle
            id="hero-title"
            lines={['Tus planes.', 'Su progreso.']}
            className="text-[clamp(2.4rem,9.4vw,3.6rem)] lg:text-[clamp(2.6rem,4.3vw,4rem)]"
          />
          <p className="mt-7 max-w-[34rem] text-lg leading-relaxed text-(--sg-ink-2)">
            Evaluaciones, rutinas, planes de alimentación y el check-in diario
            de cada cliente, en un mismo expediente. Tú trabajas desde la web;
            tu cliente sigue su día desde la app.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/registro" className="sg-btn" data-variant="action">
              Crear mi cuenta <Icon name="arrow-right" size={18} />
            </Link>
            <a href="#planes" className="sg-btn" data-variant="line">
              Ver planes
            </a>
          </div>
          <p className="mt-4 text-sm text-(--sg-ink-2)">
            Crear tu cuenta no realiza cobros ni activa una suscripción.
          </p>

          <div
            role="tablist"
            aria-label="Módulos de CouchOne Fit"
            className="mt-10 grid grid-cols-2 border-[3px] border-(--sg-ink) sm:grid-cols-4 lg:mt-auto"
            onKeyDown={onKeyDown}
          >
            {modules.map((module, index) => {
              const isActive = index === selected;
              const meta = MODULES[module.id];
              return (
                <button
                  key={module.id}
                  ref={(node) => {
                    tabs.current[index] = node;
                  }}
                  id={`modulo-${module.id}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls="modulo-vista"
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setSelected(index)}
                  onPointerEnter={() => preload(module)}
                  onFocus={() => preload(module)}
                  className={`flex min-h-[104px] cursor-pointer flex-col items-start justify-between gap-3 border-(--sg-ink) p-3 text-left transition-colors [&:nth-child(n+2)]:border-l-[3px] max-sm:[&:nth-child(3)]:border-l-0 max-sm:[&:nth-child(n+3)]:border-t-[3px] ${isActive ? '' : 'bg-white text-(--sg-ink) hover:bg-[#f2f2f2]'}`}
                  style={
                    isActive
                      ? { background: meta.color, color: meta.onColor }
                      : undefined
                  }
                >
                  <ModuleChip id={module.id} onField={isActive} />
                  <span className="sg-display text-[12.5px] font-bold">
                    {meta.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          id="modulo-vista"
          role="tabpanel"
          aria-labelledby={`modulo-${active.id}`}
          className="min-w-0 px-6 pt-6 sm:px-12 sm:pt-12 lg:pr-0"
        >
          <div className="relative">
            <PanelShot
              key={active.panel}
              screen={active.panel}
              alt={active.panelAlt}
              rings={rings}
              eager
              className="sg-swap aspect-square md:aspect-[16/10]"
            />
            <PhoneShot
              key={active.phone}
              screen={active.phone}
              alt={active.phoneAlt}
              eager
              className="sg-swap mx-auto mt-16 w-[62%] max-w-[250px] lg:absolute lg:-bottom-16 lg:-left-20 lg:mt-0 lg:w-[33%]"
            />
          </div>
          <p className="mt-14 max-w-[36rem] text-base leading-relaxed text-(--sg-ink-2) lg:ml-[28%] lg:mt-20">
            <strong className="text-(--sg-ink)">{activeModule.label}.</strong>{' '}
            {active.caption}
          </p>
          <p className="mt-2 text-sm text-(--sg-ink-2) lg:ml-[28%]">
            Capturas reales del producto con datos de demostración.
          </p>
        </div>
      </div>
    </section>
  );
}
