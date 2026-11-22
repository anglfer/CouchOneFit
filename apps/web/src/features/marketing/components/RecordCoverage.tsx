import { useState, type ReactElement } from 'react';
import { Icon, type IconName } from '../../../components/Icon';
import {
  BrowserFrame,
  PanelImage,
  type PanelScreen,
} from '../../../components/ProductShot';
import { ProductLightbox, type LightboxSlide } from './ProductLightbox';

interface AreaItem {
  id: string;
  icon: IconName;
  name: string;
  panel: string;
  app: string;
  screen: PanelScreen;
  frameLabel: string;
  viewClassName: string;
  alt: string;
  lightboxSlide: LightboxSlide;
}

const areas: AreaItem[] = [
  {
    id: 'alimentacion',
    icon: 'bowl',
    name: 'Alimentación',
    panel:
      'Planes por tiempos de comida con calorías, macros e hidratación. Cada cambio queda como una nueva versión.',
    app: 'Lo que le toca comer hoy.',
    screen: 'panel-nutricion',
    frameLabel: 'Alimentación · Mariana Ríos',
    viewClassName:
      'aspect-[4/3.3] [--crop-x:19.8] [--crop-y:38.6] [--crop-w:38.6] sm:aspect-[2.6/1] sm:[--crop-x:18.5] sm:[--crop-y:38.6] sm:[--crop-w:81]',
    alt: 'Plan de alimentación activo en el panel: Definición alta en proteína, 1750 kcal, macros 144/174/53 g, hidratación y cuatro tiempos de comida.',
    lightboxSlide: {
      id: 'alimentacion',
      title: 'Alimentación · Versionado y tiempos de comida',
      summary:
        'Plan activo v1 con calorías, macros, hidratación y comidas del día.',
      syncHighlight: '1750 kcal en 4 tiempos → visible en su app hoy',
      panel: 'panel-nutricion',
      phone: 'movil-inicio',
      panelAlt:
        'Plan de alimentación activo en el panel: Definición alta en proteína, 1750 kcal, macros 144/174/53 g, hidratación y cuatro tiempos de comida.',
      phoneAlt:
        'Alimentación del día en la app del cliente con 4 comidas y 1750 kcal.',
    },
  },
  {
    id: 'evaluacion',
    icon: 'clipboard',
    name: 'Evaluación',
    panel:
      'Bioimpedancia, perímetros o pliegues, con su evolución a lo largo del tiempo.',
    app: 'Sus medidas, cuando decides compartirlas.',
    screen: 'panel-expediente',
    frameLabel: 'Resumen y evaluación · Mariana Ríos',
    viewClassName:
      'aspect-[4/3.6] [--crop-x:58.5] [--crop-y:31] [--crop-w:41] sm:aspect-[2.2/1] sm:[--crop-x:18.5] sm:[--crop-y:31] sm:[--crop-w:81]',
    alt: 'Expediente completo: indicadores de entrenamiento, alimentación, peso en check-ins, última evaluación de 26.7 % grasa y perfil base.',
    lightboxSlide: {
      id: 'evaluacion',
      title: 'Evaluación y ficha clínica · Mariana Ríos',
      summary:
        'Resumen integral con última evaluación antropométrica, perfil y medidas base.',
      syncHighlight:
        '8 evaluaciones registradas · compartes medidas solo si lo habilitas',
      panel: 'panel-expediente',
      phone: 'movil-progreso',
      panelAlt:
        'Expediente completo: indicadores de entrenamiento, alimentación, peso en check-ins, última evaluación de 26.7 % grasa y perfil base.',
      phoneAlt: 'Vista de progreso y avance del cliente en la app móvil.',
    },
  },
  {
    id: 'entrenamiento',
    icon: 'dumbbell',
    name: 'Entrenamiento',
    panel:
      'Rutinas por día con ejercicios, series, repeticiones, carga y descanso. Plantillas para reutilizar.',
    app: 'Su semana, cada sesión y cada serie que registra.',
    screen: 'panel-entrenamiento',
    frameLabel: 'Entrenamiento · Mariana Ríos',
    viewClassName:
      'aspect-[4/3.3] [--crop-x:19.5] [--crop-y:37.5] [--crop-w:44] sm:aspect-[2.3/1] sm:[--crop-x:18.5] sm:[--crop-y:37] sm:[--crop-w:81]',
    alt: 'Rutina semanal activa por día (Torso A, Pierna A, Torso B, Pierna B) junto a la actividad reciente registrada desde el móvil.',
    lightboxSlide: {
      id: 'entrenamiento',
      title: 'Entrenamiento · Rutina semanal y actividad reciente',
      summary:
        'Rutina activa de 5 días y 14 ejercicios sincronizada con los registros del cliente.',
      syncHighlight:
        'Torso A/B y Pierna A/B → sesiones registradas desde móvil',
      panel: 'panel-entrenamiento',
      phone: 'movil-planes',
      panelAlt:
        'Rutina semanal activa por día junto a la actividad reciente registrada desde el móvil.',
      phoneAlt: 'Semana de entrenamiento asignada en la app del cliente.',
    },
  },
  {
    id: 'seguimiento',
    icon: 'chart',
    name: 'Seguimiento',
    panel: 'Check-ins, adherencia y peso por periodo.',
    app: 'Su check-in diario, en segundos.',
    screen: 'panel-seguimiento',
    frameLabel: 'Seguimiento · Mariana Ríos',
    viewClassName:
      'aspect-[4/3.3] [--crop-x:19.5] [--crop-y:46.5] [--crop-w:40.5] sm:aspect-[2.18/1] sm:[--crop-x:18.5] sm:[--crop-y:40.5] sm:[--crop-w:81]',
    alt: 'Panel de seguimiento: adherencia al entrenamiento 78 %, alimentación 63 %, peso corporal 66.9 kg, 26 de 28 check-ins y gráfica diaria.',
    lightboxSlide: {
      id: 'seguimiento',
      title: 'Seguimiento · Adherencia y peso diario',
      summary:
        'Cobertura real de check-ins, adherencia por periodo y evolución del peso corporal diario.',
      syncHighlight: '26/28 días registrados · −2.2 kg en cuatro semanas',
      panel: 'panel-seguimiento',
      phone: 'movil-checkin',
      panelAlt:
        'Panel de seguimiento con adherencia al entrenamiento, alimentación, check-ins y gráfica de peso diario.',
      phoneAlt: 'Formulario rápido de check-in diario en la app del cliente.',
    },
  },
];

interface ComparisonMoment {
  id: string;
  label: string;
  withoutTool: string;
  withProduct: string;
  detail: string;
}

const comparisonMoments: ComparisonMoment[] = [
  {
    id: 'alta',
    label: 'Alta de cliente',
    withoutTool:
      'Formularios sueltos, notas en el teléfono o documentos que tienes que volver a pedir cada mes.',
    withProduct:
      'Creas su expediente una sola vez y entregas un código individual de un solo uso para vincular su cuenta.',
    detail: 'Sin recapturar datos físicos ni compartir hojas entre chats.',
  },
  {
    id: 'cambios',
    label: 'Cambios de plan',
    withoutTool:
      'Archivos llamados "Plan final v3", capturas perdidas en WhatsApp y dudas sobre cuál versión sigue vigente.',
    withProduct:
      'Cada actualización de nutrición o rutina guarda su versión anterior y activa la nueva al instante en su app.',
    detail: 'Historial intacto y cero versiones duplicadas en la conversación.',
  },
  {
    id: 'seguimiento',
    label: 'Seguimiento semanal',
    withoutTool:
      'Mensajes largos preguntando cómo durmió, cuánto pesó o qué entrenamientos sí alcanzó a completar.',
    withProduct:
      'Tu Inicio destaca quién entrenó, quién registró check-in hoy y quién necesita atención antes de tu consulta.',
    detail: 'Decides con contexto fechado, no por memoria ni capturas sueltas.',
  },
  {
    id: 'conexion',
    label: 'Sin señal en consulta',
    withoutTool:
      'Tablas que no abren en el gimnasio o ediciones perdidas cuando la conexión del teléfono falla.',
    withProduct:
      'La PWA profesional lee expedientes guardados sin conexión y encola cambios para sincronizarlos al reconectar.',
    detail: 'Control de conflictos por versión para no sobrescribir datos.',
  },
];

const recordLightboxSlides: LightboxSlide[] = areas.map(
  (area) => area.lightboxSlide
);

export function RecordCoverage(): ReactElement {
  const [activeAreaIndex, setActiveAreaIndex] = useState(0);
  const [activeMomentIndex, setActiveMomentIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const activeArea = areas[activeAreaIndex];
  const activeMoment = comparisonMoments[activeMomentIndex];

  return (
    <section
      id="expediente"
      aria-labelledby="coverage-title"
      className="mx-auto w-full max-w-[1240px] scroll-mt-16 px-4 py-24 sm:px-8 sm:py-32"
    >
      <div className="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-12">
        <h2
          id="coverage-title"
          className="font-display text-[clamp(2rem,1.2rem+2.4vw,3.4rem)] font-semibold leading-[1.06] tracking-[-0.03em] text-brand-ink lg:col-span-7"
        >
          Todo el expediente, en una sola ficha.
        </h2>
        <p className="max-w-[52ch] text-lg leading-relaxed text-brand-muted lg:col-span-5">
          Tú administras los datos base, las evaluaciones y lo que prescribes.
          Tu cliente consulta lo que le habilitas y registra su día; nunca
          modifica lo prescrito.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 sm:mt-14">
        <p className="text-sm font-medium text-[#5b6388]">
          Selecciona un área abajo para explorar la captura real dentro del
          expediente.
        </p>
        <button
          type="button"
          onClick={() => setIsLightboxOpen(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-border-strong bg-white px-4 text-sm font-semibold text-brand-ink transition-colors hover:border-brand-primary hover:text-brand-primary"
        >
          <Icon name="arrow-up-right" size={17} />
          Ampliar captura
        </button>
      </div>

      <BrowserFrame
        label={activeArea.frameLabel}
        className="mt-4"
        viewClassName={activeArea.viewClassName}
      >
        <PanelImage screen={activeArea.screen} alt={activeArea.alt} />
      </BrowserFrame>

      <div className="mt-12 sm:mt-16" aria-label="Qué cubre el expediente">
        <div
          aria-hidden="true"
          className="hidden grid-cols-[220px_1fr_1fr] gap-8 pb-4 text-sm font-semibold text-[#5b6388] md:grid"
        >
          <span>Área</span>
          <span>En tu panel</span>
          <span>En su app</span>
        </div>
        <div className="border-b border-brand-border">
          {areas.map((area, index) => {
            const selected = index === activeAreaIndex;
            return (
              <button
                key={area.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setActiveAreaIndex(index)}
                className={`grid w-full gap-2 border-t border-brand-border px-3 py-5 text-left transition-colors sm:px-4 md:grid-cols-[220px_1fr_1fr] md:gap-8 ${
                  selected
                    ? 'border-l-4 border-l-brand-primary bg-[#f1f0ff]'
                    : 'bg-white hover:bg-brand-surface'
                }`}
              >
                <span className="flex items-center gap-3 self-start text-lg font-semibold leading-snug text-brand-ink">
                  <Icon
                    name={area.icon}
                    size={20}
                    className="text-brand-primary"
                  />
                  {area.name}
                </span>
                <span className="text-base leading-relaxed text-brand-ink">
                  <span className="font-semibold text-[#5b6388] md:hidden">
                    En tu panel:{' '}
                  </span>
                  {area.panel}
                </span>
                <span className="text-base leading-relaxed text-brand-muted">
                  <span className="font-semibold text-[#5b6388] md:hidden">
                    En su app:{' '}
                  </span>
                  {area.app}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-20 border-t border-brand-border pt-14 sm:mt-24">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="font-display text-2xl font-semibold tracking-[-0.02em] text-brand-ink sm:text-3xl">
              Lo que dejas atrás desde tu primer cliente
            </h3>
            <p className="mt-2 max-w-[56ch] text-base leading-relaxed text-brand-muted">
              Compara momentos reales de tu operación diaria frente a llevar
              planes y seguimiento en un solo expediente.
            </p>
          </div>
          <div
            role="group"
            aria-label="Momentos diarios de consulta"
            className="flex flex-wrap gap-2"
          >
            {comparisonMoments.map((moment, index) => {
              const selected = index === activeMomentIndex;
              return (
                <button
                  key={moment.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setActiveMomentIndex(index)}
                  className={`min-h-11 rounded-xl border px-3.5 text-sm font-semibold transition-colors ${
                    selected
                      ? 'border-brand-primary bg-brand-primary text-white'
                      : 'border-brand-border-strong bg-white text-brand-ink hover:border-brand-primary hover:text-brand-primary'
                  }`}
                >
                  {moment.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 sm:p-7">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#5b6388]">
              <Icon name="close" size={17} />
              <span>Con chats, PDFs y hojas sueltas</span>
            </div>
            <p className="mt-4 text-lg font-medium leading-relaxed text-brand-ink">
              {activeMoment.withoutTool}
            </p>
          </div>

          <div className="rounded-2xl border border-brand-primary border-l-4 bg-white p-6 sm:p-7">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-primary">
              <Icon name="check" size={17} strokeWidth={2.25} />
              <span>Con CouchOne Fit</span>
            </div>
            <p className="mt-4 text-lg font-medium leading-relaxed text-brand-ink">
              {activeMoment.withProduct}
            </p>
            <p className="mt-3 text-sm text-brand-muted">
              {activeMoment.detail}
            </p>
          </div>
        </div>
      </div>

      <ProductLightbox
        slides={recordLightboxSlides}
        activeIndex={activeAreaIndex}
        initialDevice="panel"
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        onSelectIndex={(index) => setActiveAreaIndex(index)}
      />
    </section>
  );
}
