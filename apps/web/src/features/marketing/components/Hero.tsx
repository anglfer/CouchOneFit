import { useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import { Icon, type IconName } from '../../../components/Icon';
import { Link } from '../../../components/Link';
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

type ProductModule = {
  id: string;
  label: string;
  icon: IconName;
  panel: PanelScreen;
  phone: PhoneScreen;
  panelAlt: string;
  phoneAlt: string;
  pro: string;
  client: string;
  syncBridge: string;
};

const productModules: ProductModule[] = [
  {
    id: 'inicio',
    label: 'Inicio',
    icon: 'home',
    panel: 'panel-inicio',
    phone: 'movil-inicio',
    panelAlt:
      'Inicio del panel profesional: clientes activos, quién entrenó esta semana, check-ins de hoy y clientes que necesitan atención.',
    phoneAlt:
      'Inicio de la app del cliente: su semana, la sesión de hoy, su check-in registrado y la alimentación del día.',
    pro: 'Quién entrenó, quién registró su check-in y quién necesita tu atención hoy.',
    client: 'La sesión que le toca, su check-in y su alimentación del día.',
    syncBridge: '5 de 8 clientes ya registraron check-in hoy',
  },
  {
    id: 'expediente',
    label: 'Expediente',
    icon: 'clipboard',
    panel: 'panel-expediente',
    phone: 'movil-progreso',
    panelAlt:
      'Expediente de una clienta: datos base, objetivo, rutina activa, plan de alimentación, peso en check-ins y última evaluación.',
    phoneAlt:
      'Progreso en la app del cliente: total levantado, entrenamientos, racha semanal y actividad de los últimos meses.',
    pro: 'Datos base, objetivo, rutina, alimentación y última evaluación en una ficha.',
    client: 'Su progreso: entrenamientos, racha y series hechas.',
    syncBridge:
      'Mariana Ríos · 1 ficha con rutina, plan v1 y 26.7 % grasa evaluada',
  },
  {
    id: 'entrenamiento',
    label: 'Entrenamiento',
    icon: 'dumbbell',
    panel: 'panel-entrenamiento',
    phone: 'movil-planes',
    panelAlt:
      'Rutina activa de una clienta por día de la semana, con ejercicios y series, junto a su actividad reciente.',
    phoneAlt:
      'Planes en la app del cliente: la rutina asignada por su profesional y su semana de entrenamiento.',
    pro: 'Rutinas por día con ejercicios y series, y lo que tu cliente ya entrenó.',
    client: 'Su semana tal como la diseñaste, lista para entrenar.',
    syncBridge:
      '5 días · 14 ejercicios activos → Cardio y movilidad (3/3 series hoy)',
  },
  {
    id: 'alimentacion',
    label: 'Alimentación',
    icon: 'bowl',
    panel: 'panel-nutricion',
    phone: 'movil-inicio',
    panelAlt:
      'Plan alimenticio activo en el panel profesional: Definición alta en proteína, versión 1, 1750 kcal, macros e hidratación en cuatro tiempos.',
    phoneAlt:
      'Alimentación del día en la app del cliente: cuatro comidas, 1750 kcal y objetivos de macros visibles desde su pantalla principal.',
    pro: 'Planes por tiempos de comida, calorías, macros e historial de versiones.',
    client: 'Su plan activo del día con comidas, horarios y metas claras.',
    syncBridge:
      'Plan v1 · 1750 kcal · P 144 / C 174 / G 53 g → 4 comidas en su app',
  },
  {
    id: 'seguimiento',
    label: 'Seguimiento',
    icon: 'chart',
    panel: 'panel-seguimiento',
    phone: 'movil-checkin',
    panelAlt:
      'Seguimiento de una clienta en cuatro semanas: adherencia al entrenamiento y a la alimentación, peso corporal y check-ins.',
    phoneAlt:
      'Check-in diario en la app del cliente: peso, horas de sueño y estrés del día.',
    pro: 'Adherencia, peso y check-ins por periodo, con indicadores orientativos.',
    client: 'Su check-in diario: peso, sueño, estrés y más, en segundos.',
    syncBridge:
      'App: 66,9 kg y 6,5 h sueño → Panel: 66.9 kg (−2.2 kg) y 26/28 días',
  },
];

const lightboxSlides: LightboxSlide[] = productModules.map((module) => ({
  id: module.id,
  title: `${module.label} · Panel profesional y app del cliente`,
  summary: `${module.pro} ${module.client}`,
  syncHighlight: module.syncBridge,
  panel: module.panel,
  phone: module.phone,
  panelAlt: module.panelAlt,
  phoneAlt: module.phoneAlt,
}));

const ease = 'ease-[cubic-bezier(0.16,1,0.3,1)]';

export function Hero(): ReactElement {
  const [active, setActive] = useState(0);
  const [focusedSide, setFocusedSide] = useState<'both' | 'panel' | 'phone'>(
    'both'
  );
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxDevice, setLightboxDevice] = useState<'panel' | 'phone'>(
    'panel'
  );
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = productModules[active];

  function selectModule(index: number, shouldFocus = false): void {
    setActive(index);
    const target = tabRefs.current[index];
    if (target) {
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      if (shouldFocus) target.focus();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const last = productModules.length - 1;
    const keys: Record<string, number> = {
      ArrowRight: active === last ? 0 : active + 1,
      ArrowLeft: active === 0 ? last : active - 1,
      Home: 0,
      End: last,
    };
    const next = keys[event.key];
    if (next === undefined) return;
    event.preventDefault();
    selectModule(next, true);
  }

  function toggleFocusSide(side: 'panel' | 'phone'): void {
    setFocusedSide((prev) => (prev === side ? 'both' : side));
  }

  function openLightbox(device: 'panel' | 'phone'): void {
    setLightboxDevice(device);
    setIsLightboxOpen(true);
  }

  return (
    <section aria-labelledby="hero-title" className="pt-3 sm:pt-4">
      <div className="mx-auto w-full max-w-[1360px] px-3 sm:px-6">
        <div className="mk-on-color mk-hero-stage relative overflow-hidden rounded-[28px] px-4 pb-5 pt-8 sm:px-8 sm:pb-0 sm:pt-11 lg:px-12 lg:pt-12">
          <TrackBackdrop variant="brand" className="opacity-70" />

          <div className="relative z-10 mx-auto max-w-[54rem] text-center">
            <h1
              id="hero-title"
              className="font-display text-[clamp(2.1rem,1.25rem+3vw,3.85rem)] font-semibold leading-[1.04] tracking-[-0.032em] text-white"
            >
              Un solo sistema para tu cartera.
              <br className="hidden sm:inline" /> Una app real para cada
              cliente.
            </h1>
            <p className="mx-auto mt-4 max-w-[58ch] text-base leading-relaxed text-[#d4daf5] sm:text-lg">
              Reúne evaluaciones, rutinas y alimentación en un expediente por
              persona. Cada entrenamiento y check-in que registra tu cliente
              llega fechado a tu panel para que decidas con datos, no con chats
              dispersos.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link to="/registro" className="mk-btn" data-variant="inverse">
                Crear mi cuenta
                <Icon name="arrow-right" size={18} />
              </Link>
              <a
                href="#planes"
                className="mk-btn"
                data-variant="outline-inverse"
              >
                Ver planes
              </a>
            </div>
            <p className="mt-3.5 text-sm text-[#b9c2e8]">
              Crear tu cuenta no realiza cobros ni activa una suscripción.
            </p>
          </div>

          {/* En móvil las capturas van primero (entran en el pliegue); desde sm, pestañas arriba. */}
          <div className="relative z-10 mt-7 flex flex-col sm:mt-9">
            <div className="order-2 mt-5 flex flex-col gap-3 sm:order-1 sm:mt-0 lg:flex-row lg:items-center lg:justify-between">
              <div className="rounded-2xl border border-white/14 bg-white/[0.06] p-1.5">
                <div
                  role="tablist"
                  aria-label="Módulos del producto"
                  className="mk-tablist gap-1.5"
                  onKeyDown={handleKeyDown}
                >
                  {productModules.map((module, index) => {
                    const selected = index === active;
                    return (
                      <button
                        key={module.id}
                        ref={(node) => {
                          tabRefs.current[index] = node;
                        }}
                        id={`modulo-${module.id}`}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => selectModule(index)}
                        className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3.5 text-[15px] font-semibold transition-colors duration-200 sm:px-4 ${
                          selected
                            ? 'bg-white text-brand-primary shadow-[0_2px_8px_-2px_rgb(9_9_24/0.3)]'
                            : 'text-indigo-50 hover:bg-white/12 hover:text-white'
                        }`}
                      >
                        <Icon name={module.icon} size={18} />
                        {module.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() => openLightbox('panel')}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/20 sm:self-auto"
              >
                <Icon name="arrow-up-right" size={17} />
                Ampliar capturas
              </button>
            </div>

            <div className="order-3 mt-3.5 grid gap-2.5 sm:order-2 lg:grid-cols-[1fr_1fr_auto] lg:items-stretch">
              <button
                type="button"
                aria-pressed={focusedSide === 'panel'}
                onClick={() => toggleFocusSide('panel')}
                onMouseEnter={() => setFocusedSide('panel')}
                onMouseLeave={() => setFocusedSide('both')}
                className={`min-h-11 rounded-xl border px-3.5 py-2.5 text-left text-[15px] leading-snug transition-colors ${
                  focusedSide === 'panel'
                    ? 'border-white/55 bg-white/16 text-white'
                    : 'border-white/14 bg-white/[0.06] text-[#d4daf5] hover:bg-white/12'
                }`}
              >
                <span className="inline-flex items-center gap-1.5 font-semibold text-white">
                  <Icon name="monitor" size={15} />
                  En tu panel
                </span>
                <span className="mt-0.5 block">{current.pro}</span>
              </button>

              <button
                type="button"
                aria-pressed={focusedSide === 'phone'}
                onClick={() => toggleFocusSide('phone')}
                onMouseEnter={() => setFocusedSide('phone')}
                onMouseLeave={() => setFocusedSide('both')}
                className={`min-h-11 rounded-xl border px-3.5 py-2.5 text-left text-[15px] leading-snug transition-colors ${
                  focusedSide === 'phone'
                    ? 'border-white/55 bg-white/16 text-white'
                    : 'border-white/14 bg-white/[0.06] text-[#d4daf5] hover:bg-white/12'
                }`}
              >
                <span className="inline-flex items-center gap-1.5 font-semibold text-white">
                  <Icon name="smartphone" size={15} />
                  En su app
                </span>
                <span className="mt-0.5 block">{current.client}</span>
              </button>

              <div className="flex items-center gap-2 rounded-xl border border-white/16 bg-[#050a1a]/65 px-3.5 py-2.5 text-sm font-medium text-[#e6e7f0]">
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full bg-[#1fcc92]"
                />
                <Icon name="swap" size={16} className="shrink-0 text-white" />
                <span>{current.syncBridge}</span>
              </div>
            </div>

            <div
              id="modulo-vista"
              role="tabpanel"
              tabIndex={0}
              aria-labelledby={`modulo-${current.id}`}
              className="order-1 rounded-xl sm:order-3"
            >
              {/* Móvil: alto = 20% + alto del teléfono (≈1.135× el ancho del cuadro). */}
              <div className="relative aspect-[1/1.42] sm:mt-7 sm:aspect-auto sm:h-[clamp(340px,43vw,520px)] lg:mt-8">
                <BrowserFrame
                  className={`w-[92%] transition-opacity duration-300 motion-reduce:transition-none sm:w-[81%] ${
                    focusedSide === 'phone' ? 'opacity-70' : 'opacity-100'
                  }`}
                  viewClassName="aspect-[4/3.4] [--crop-w:36] [--crop-x:19.5] [--crop-y:6] sm:aspect-[16/10] sm:[--crop-w:100] sm:[--crop-x:0] sm:[--crop-y:0]"
                >
                  {productModules.map((module, index) => (
                    <PanelImage
                      key={module.id}
                      screen={module.panel}
                      alt={index === active ? module.panelAlt : ''}
                      eager={index === 0}
                      className={`transition-[opacity,translate,filter] duration-500 motion-reduce:transition-none ${ease} ${
                        index === active
                          ? 'opacity-100'
                          : 'translate-y-3 opacity-0 blur-[6px]'
                      }`}
                    />
                  ))}
                </BrowserFrame>
                <PhoneFrame
                  className={`absolute right-0 top-[20%] w-[50%] transition-[opacity,transform] duration-300 motion-reduce:transition-none sm:right-[1%] sm:top-[12%] sm:w-[23%] lg:right-[3%] lg:top-[20%] lg:w-[22%] ${
                    focusedSide === 'panel'
                      ? 'opacity-75'
                      : focusedSide === 'phone'
                        ? 'opacity-100 sm:-translate-y-1.5'
                        : 'opacity-100'
                  }`}
                >
                  {productModules.map((module, index) => (
                    <PhoneImage
                      key={module.id}
                      screen={module.phone}
                      alt={index === active ? module.phoneAlt : ''}
                      eager={index === 0}
                      className={`transition-[opacity,translate] duration-500 motion-reduce:transition-none ${ease} ${
                        index === active
                          ? 'opacity-100 delay-75'
                          : 'translate-y-6 opacity-0'
                      }`}
                    />
                  ))}
                </PhoneFrame>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="mx-auto mt-4 w-full max-w-[1240px] px-4 text-sm text-[#5b6388] sm:px-8">
        Capturas reales del producto con datos de demostración.
      </p>

      <ProductLightbox
        slides={lightboxSlides}
        activeIndex={active}
        initialDevice={lightboxDevice}
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        onSelectIndex={(index) => setActive(index)}
      />
    </section>
  );
}
