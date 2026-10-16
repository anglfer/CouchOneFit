import { useState, type ReactElement } from 'react';

type PreviewView = 'summary' | 'training' | 'nutrition';

const previewViews: { id: PreviewView; label: string; number: string }[] = [
  { id: 'summary', label: 'Seguimiento', number: '01' },
  { id: 'training', label: 'Entrenamiento', number: '02' },
  { id: 'nutrition', label: 'Alimentación', number: '03' },
];

function SummaryPreview({
  isCheckInComplete,
}: {
  isCheckInComplete: boolean;
}): ReactElement {
  const clients = [
    {
      name: 'Mariana Ríos',
      initials: 'MR',
      goal: 'Mejorar fuerza',
      received: true,
    },
    {
      name: 'Diego Valdés',
      initials: 'DV',
      goal: 'Composición corporal',
      received: true,
    },
    {
      name: 'Ana Torres',
      initials: 'AT',
      goal: 'Crear constancia',
      received: isCheckInComplete,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
          <span className="block text-[11px] font-semibold text-slate-500">
            Clientes activos
          </span>
          <strong className="block text-2xl font-black text-slate-900 mt-0.5">
            3
          </strong>
          <small className="text-[10px] text-slate-400">En este ejemplo</small>
        </div>
        <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200/80">
          <span className="block text-[11px] font-semibold text-indigo-700">
            Check-ins recibidos
          </span>
          <strong className="block text-2xl font-black text-indigo-900 mt-0.5">
            {isCheckInComplete ? '3' : '2'}
            <em className="text-sm font-semibold text-indigo-500 not-italic">
              {' '}
              / 3
            </em>
          </strong>
          <small className="text-[10px] text-indigo-600">
            El seguimiento de hoy
          </small>
        </div>
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
          <span className="block text-[11px] font-semibold text-slate-500">
            Por revisar
          </span>
          <strong className="block text-2xl font-black text-slate-900 mt-0.5">
            {isCheckInComplete ? '0' : '1'}
          </strong>
          <small className="text-[10px] text-slate-400">
            Check-ins pendientes
          </small>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900">
            Tus clientes, al día
          </h3>
          <span className="text-[11px] font-semibold text-slate-400">
            Check-in de hoy
          </span>
        </div>
        <ul className="space-y-2">
          {clients.map((client) => (
            <li
              key={client.initials}
              className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200/80 hover:border-slate-300 shadow-2xs transition-all"
            >
              <div className="flex items-center gap-3">
                <span
                  className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0"
                  aria-hidden="true"
                >
                  {client.initials}
                </span>
                <div>
                  <strong className="block text-xs font-bold text-slate-900">
                    {client.name}
                  </strong>
                  <small className="text-[11px] text-slate-400">
                    {client.goal}
                  </small>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                  client.received
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : 'text-amber-700 bg-amber-50 border-amber-200'
                }`}
              >
                {client.received ? 'Recibido' : 'Pendiente'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TrainingPreview(): ReactElement {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <small className="block text-xs text-indigo-600 font-semibold">
            Rutina de ejemplo para Ana
          </small>
          <h3 className="text-base font-bold text-slate-900">
            Fuerza de cuerpo completo
          </h3>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
          Versión activa
        </span>
      </div>

      <div
        className="grid grid-cols-7 gap-1.5 text-center text-xs"
        aria-label="Programación de ejemplo"
      >
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, index) => {
          const isTrain = index % 2 === 0 && index < 5;
          return (
            <span
              key={day}
              className={`p-2 rounded-xl flex flex-col items-center justify-center border font-bold ${
                isTrain
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-slate-50 border-slate-200/60 text-slate-400'
              }`}
            >
              <span className="text-xs">{day}</span>
              <small className="text-[9px] font-medium mt-0.5">
                {isTrain ? 'Entrena' : 'Descanso'}
              </small>
            </span>
          );
        })}
      </div>

      <dl className="space-y-2 text-xs">
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
          <dt className="font-bold text-slate-900">Sentadilla goblet</dt>
          <dd className="flex items-center gap-2 text-slate-600 font-semibold">
            3 × 12{' '}
            <span className="px-2 py-0.5 rounded text-[10px] font-bold text-indigo-700 bg-indigo-100">
              RPE 7
            </span>
          </dd>
        </div>
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
          <dt className="font-bold text-slate-900">Remo con mancuerna</dt>
          <dd className="flex items-center gap-2 text-slate-600 font-semibold">
            3 × 10{' '}
            <span className="px-2 py-0.5 rounded text-[10px] font-bold text-indigo-700 bg-indigo-100">
              RPE 7
            </span>
          </dd>
        </div>
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
          <dt className="font-bold text-slate-900">Plancha</dt>
          <dd className="flex items-center gap-2 text-slate-600 font-semibold">
            3 × 30 s{' '}
            <span className="px-2 py-0.5 rounded text-[10px] font-bold text-indigo-700 bg-indigo-100">
              Control
            </span>
          </dd>
        </div>
      </dl>

      <p className="text-[11px] text-slate-400 text-center">
        Ejemplo ilustrativo, no una recomendación de entrenamiento.
      </p>
    </div>
  );
}

function NutritionPreview(): ReactElement {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <small className="block text-xs text-purple-600 font-semibold">
            Plan de ejemplo para Ana
          </small>
          <h3 className="text-base font-bold text-slate-900">
            Cada comida, bien definida
          </h3>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
          Versión activa
        </span>
      </div>

      <dl className="space-y-2.5 text-xs">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
          <dt className="flex items-center gap-2 font-bold text-slate-900">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-purple-700 bg-purple-100">
              01
            </span>{' '}
            Desayuno
          </dt>
          <dd className="text-slate-600 pl-7">
            Avena con yogur y fruta
            <small className="block text-[10px] text-slate-400 mt-0.5">
              Cantidades e indicaciones del profesional
            </small>
          </dd>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
          <dt className="flex items-center gap-2 font-bold text-slate-900">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-purple-700 bg-purple-100">
              02
            </span>{' '}
            Comida
          </dt>
          <dd className="text-slate-600 pl-7">
            Pollo, arroz y verduras
            <small className="block text-[10px] text-slate-400 mt-0.5">
              Cantidades e indicaciones del profesional
            </small>
          </dd>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
          <dt className="flex items-center gap-2 font-bold text-slate-900">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-purple-700 bg-purple-100">
              03
            </span>{' '}
            Cena
          </dt>
          <dd className="text-slate-600 pl-7">
            Tostadas con queso y vegetales
            <small className="block text-[10px] text-slate-400 mt-0.5">
              Cantidades e indicaciones del profesional
            </small>
          </dd>
        </div>
      </dl>

      <p className="text-[11px] text-slate-400 text-center">
        Ejemplo ilustrativo, no una recomendación alimenticia.
      </p>
    </div>
  );
}

interface ClientPreviewProps {
  isCheckInComplete: boolean;
  onToggleCheckIn: () => void;
}

function ClientPreview({
  isCheckInComplete,
  onToggleCheckIn,
}: ClientPreviewProps): ReactElement {
  return (
    <aside
      className="w-full max-w-[320px] mx-auto rounded-[36px] bg-slate-900 text-white p-5 border-4 border-slate-800 shadow-2xl space-y-4"
      aria-label="Vista conceptual de la app del cliente"
    >
      <div
        className="w-20 h-4 bg-slate-800 rounded-full mx-auto"
        aria-hidden="true"
      />

      <div className="flex items-center justify-between text-xs font-bold text-slate-400 pt-1">
        <span>CouchOne Fit</span>
        <span
          className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold"
          aria-hidden="true"
        >
          AT
        </span>
      </div>

      <div>
        <p className="text-xs text-indigo-400 font-semibold">
          Un día a la vez.
        </p>
        <h3 className="text-xl font-extrabold text-white tracking-tight">
          Hola, Ana<span aria-hidden="true">.</span>
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">Tu plan para hoy</p>
      </div>

      <div className="p-4 rounded-2xl bg-indigo-600 text-white space-y-1 shadow-md">
        <span className="text-[10px] font-black tracking-wider text-indigo-200 uppercase">
          ENTRENAMIENTO
        </span>
        <strong className="block text-sm font-bold leading-snug">
          Hoy toca dar un paso más.
        </strong>
        <p className="text-xs text-indigo-100">Fuerza de cuerpo completo</p>
        <small className="text-[10px] text-indigo-200 block pt-1">
          3 ejercicios
        </small>
      </div>

      <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700/80 flex items-center gap-3">
        <span
          className="w-7 h-7 rounded-lg bg-slate-700 text-purple-400 font-bold text-xs flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          02
        </span>
        <div>
          <strong className="block text-xs font-bold text-white">
            Tu alimentación
          </strong>
          <small className="text-[10px] text-slate-400">
            Plan activo de tu profesional
          </small>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-2.5">
        <strong className="block text-xs font-bold text-white">
          ¿Cómo va tu día?
        </strong>
        <p className="text-[11px] text-slate-400 leading-snug">
          Tu check-in le da contexto a tu profesional.
        </p>
        <button
          type="button"
          className="w-full py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-indigo-500 hover:bg-indigo-600 active:scale-[0.98] shadow-xs transition-all cursor-pointer text-center"
          aria-pressed={isCheckInComplete}
          onClick={onToggleCheckIn}
        >
          {isCheckInComplete ? 'Deshacer ejemplo' : 'Simular check-in'}{' '}
          <span aria-hidden="true">{isCheckInComplete ? '↶' : '→'}</span>
        </button>
        <span
          className="block text-[10px] text-slate-400 text-center"
          role="status"
        >
          {isCheckInComplete
            ? 'Ejemplo recibido en el panel.'
            : 'Pruébalo y observa el panel.'}
        </span>
      </div>
    </aside>
  );
}

export function ProductPreview(): ReactElement {
  const [activeView, setActiveView] = useState<PreviewView>('summary');
  const [isCheckInComplete, setIsCheckInComplete] = useState(false);

  function toggleCheckIn(): void {
    setIsCheckInComplete(!isCheckInComplete);
    setActiveView('summary');
  }

  return (
    <figure
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14"
      id="vista-previa"
      aria-labelledby="preview-caption"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Desktop Preview */}
        <div className="lg:col-span-8 rounded-3xl bg-white border border-slate-200/90 shadow-xl overflow-hidden">
          {/* Top Window Bar */}
          <div className="h-11 px-4 bg-slate-100/80 border-b border-slate-200/80 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1.5" aria-hidden="true">
              <span className="w-3 h-3 rounded-full bg-red-400" />
              <span className="w-3 h-3 rounded-full bg-amber-400" />
              <span className="w-3 h-3 rounded-full bg-emerald-400" />
            </span>
            <span className="font-semibold text-slate-700">
              Tu espacio profesional
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200">
              Ejemplo
            </span>
          </div>

          {/* Workspace Body */}
          <div className="grid grid-cols-1 md:grid-cols-12 min-h-[440px]">
            {/* Sidebar */}
            <div className="md:col-span-4 bg-slate-50/70 border-r border-slate-200/80 p-5 flex flex-col justify-between">
              <div>
                <span className="block text-base font-extrabold text-slate-900 tracking-tight">
                  CouchOne<span className="text-indigo-600"> Fit</span>
                </span>
                <span className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase mt-4 mb-2">
                  TU ESPACIO
                </span>
                <div
                  className="space-y-1"
                  role="group"
                  aria-label="Explorar vistas del producto"
                >
                  {previewViews.map((view) => {
                    const isActive = activeView === view.id;
                    return (
                      <button
                        type="button"
                        key={view.id}
                        aria-pressed={isActive}
                        aria-controls="preview-content"
                        onClick={() => setActiveView(view.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                          isActive
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-200/60'
                        }`}
                      >
                        <span
                          className={`text-[10px] font-bold opacity-70`}
                          aria-hidden="true"
                        >
                          {view.number}
                        </span>
                        {view.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-4 border-t border-slate-200/80 mt-6">
                <span
                  className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0"
                  aria-hidden="true"
                >
                  LC
                </span>
                <div>
                  <strong className="block text-xs font-bold text-slate-900 leading-tight">
                    Laura Campos
                  </strong>
                  <small className="text-[10px] text-slate-400">
                    Profesional de ejemplo
                  </small>
                </div>
              </div>
            </div>

            {/* Content View */}
            <div
              className="md:col-span-8 p-6 sm:p-7 flex flex-col justify-between"
              id="preview-content"
            >
              <div>
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                  <div>
                    <p className="text-xs text-indigo-600 font-semibold">
                      Una mirada a tu día
                    </p>
                    <h2 className="text-lg font-bold text-slate-900">
                      {activeView === 'summary'
                        ? 'Cada cliente cuenta.'
                        : activeView === 'training'
                          ? 'Un plan con dirección.'
                          : 'Nutrición con criterio.'}
                    </h2>
                  </div>
                  <span className="text-xs font-semibold text-slate-400">
                    Miércoles
                  </span>
                </div>

                {activeView === 'summary' && (
                  <SummaryPreview isCheckInComplete={isCheckInComplete} />
                )}
                {activeView === 'training' && <TrainingPreview />}
                {activeView === 'nutrition' && <NutritionPreview />}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Phone Mockup */}
        <div className="lg:col-span-4 flex justify-center">
          <ClientPreview
            isCheckInComplete={isCheckInComplete}
            onToggleCheckIn={toggleCheckIn}
          />
        </div>
      </div>

      <figcaption
        id="preview-caption"
        className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500 text-center"
      >
        <span className="text-indigo-600 font-bold" aria-hidden="true">
          ↳
        </span>
        <span>
          Una plataforma. Dos experiencias conectadas.{' '}
          <strong className="font-semibold text-slate-700">
            Entrenamiento, nutrición y seguimiento en un mismo lugar.
          </strong>
        </span>
      </figcaption>
    </figure>
  );
}

