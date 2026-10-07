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
    <>
      <div className="preview-metrics">
        <div>
          <span>Clientes activos</span>
          <strong>3</strong>
          <small>En este ejemplo</small>
        </div>
        <div>
          <span>Check-ins recibidos</span>
          <strong>
            {isCheckInComplete ? '3' : '2'}
            <em> / 3</em>
          </strong>
          <small>El seguimiento de hoy</small>
        </div>
        <div>
          <span>Por revisar</span>
          <strong>{isCheckInComplete ? '0' : '1'}</strong>
          <small>Check-ins pendientes</small>
        </div>
      </div>
      <div className="preview-list-heading">
        <h3>Tus clientes, al día</h3>
        <span>Check-in de hoy</span>
      </div>
      <ul className="preview-clients">
        {clients.map((client) => (
          <li key={client.initials}>
            <span
              className={`preview-avatar avatar-${client.initials.toLowerCase()}`}
              aria-hidden="true"
            >
              {client.initials}
            </span>
            <span className="preview-client-name">
              <strong>{client.name}</strong>
              <small>{client.goal}</small>
            </span>
            <span
              className={`preview-status ${client.received ? 'is-received' : ''}`}
            >
              {client.received ? 'Recibido' : 'Pendiente'}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function TrainingPreview(): ReactElement {
  return (
    <div className="preview-plan">
      <div className="preview-plan-heading">
        <div>
          <small>Rutina de ejemplo para Ana</small>
          <h3>Fuerza de cuerpo completo</h3>
        </div>
        <span className="preview-status is-received">Versión activa</span>
      </div>
      <div className="preview-week" aria-label="Programación de ejemplo">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, index) => (
          <span
            key={day}
            className={index % 2 === 0 && index < 5 ? 'training-day' : ''}
          >
            {day}
            <small>
              {index % 2 === 0 && index < 5 ? 'Entrena' : 'Descansa'}
            </small>
          </span>
        ))}
      </div>
      <dl className="preview-exercises">
        <div>
          <dt>Sentadilla goblet</dt>
          <dd>
            3 × 12 <span>RPE 7</span>
          </dd>
        </div>
        <div>
          <dt>Remo con mancuerna</dt>
          <dd>
            3 × 10 <span>RPE 7</span>
          </dd>
        </div>
        <div>
          <dt>Plancha</dt>
          <dd>
            3 × 30 s <span>Control</span>
          </dd>
        </div>
      </dl>
      <p className="preview-plan-note">
        Ejemplo ilustrativo, no una recomendación de entrenamiento.
      </p>
    </div>
  );
}

function NutritionPreview(): ReactElement {
  return (
    <div className="preview-plan">
      <div className="preview-plan-heading">
        <div>
          <small>Plan de ejemplo para Ana</small>
          <h3>Cada comida, bien definida</h3>
        </div>
        <span className="preview-status is-received">Versión activa</span>
      </div>
      <dl className="preview-meals">
        <div>
          <dt>
            <span>01</span> Desayuno
          </dt>
          <dd>
            Avena con yogur y fruta
            <small>Cantidades e indicaciones del profesional</small>
          </dd>
        </div>
        <div>
          <dt>
            <span>02</span> Comida
          </dt>
          <dd>
            Pollo, arroz y verduras
            <small>Cantidades e indicaciones del profesional</small>
          </dd>
        </div>
        <div>
          <dt>
            <span>03</span> Cena
          </dt>
          <dd>
            Tostadas con queso y vegetales
            <small>Cantidades e indicaciones del profesional</small>
          </dd>
        </div>
      </dl>
      <p className="preview-plan-note">
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
      className="preview-phone"
      aria-label="Vista conceptual de la app del cliente"
    >
      <div className="phone-speaker" aria-hidden="true" />
      <div className="phone-top">
        <span>CouchOne Fit</span>
        <span className="phone-account" aria-hidden="true">
          AT
        </span>
      </div>
      <p className="phone-greeting">Un día a la vez.</p>
      <h3>
        Hola, Ana<span aria-hidden="true">.</span>
      </h3>
      <p className="phone-subtitle">Tu plan para hoy</p>
      <div className="phone-session">
        <span>ENTRENAMIENTO</span>
        <strong>
          Hoy toca
          <br />
          dar un paso más.
        </strong>
        <p>Fuerza de cuerpo completo</p>
        <small>3 ejercicios</small>
      </div>
      <div className="phone-meal">
        <span aria-hidden="true">02</span>
        <div>
          <strong>Tu alimentación</strong>
          <small>Plan activo de tu profesional</small>
        </div>
      </div>
      <div className="phone-checkin">
        <strong>¿Cómo va tu día?</strong>
        <p>Tu check-in le da contexto a tu profesional.</p>
        <button
          type="button"
          className="marketing-button"
          aria-pressed={isCheckInComplete}
          onClick={onToggleCheckIn}
        >
          {isCheckInComplete ? 'Deshacer ejemplo' : 'Simular check-in'}{' '}
          <span aria-hidden="true">{isCheckInComplete ? '↶' : '→'}</span>
        </button>
        <span className="phone-feedback" role="status">
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
      className="product-preview"
      id="vista-previa"
      aria-labelledby="preview-caption"
    >
      <div className="preview-stage">
        <div className="preview-desktop">
          <div className="preview-window-bar">
            <span className="window-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>Tu espacio profesional</span>
            <span className="preview-example">Ejemplo</span>
          </div>
          <div className="preview-workspace">
            <div className="preview-sidebar">
              <span className="preview-wordmark">
                CouchOne<span> Fit</span>
              </span>
              <span className="preview-sidebar-label">TU ESPACIO</span>
              <div
                className="preview-view-buttons"
                role="group"
                aria-label="Explorar vistas del producto"
              >
                {previewViews.map((view) => (
                  <button
                    type="button"
                    key={view.id}
                    aria-pressed={activeView === view.id}
                    aria-controls="preview-content"
                    onClick={() => setActiveView(view.id)}
                  >
                    <span aria-hidden="true">{view.number}</span>
                    {view.label}
                  </button>
                ))}
              </div>
              <div className="preview-professional">
                <span className="preview-avatar" aria-hidden="true">
                  LC
                </span>
                <span>
                  <strong>Laura Campos</strong>
                  <small>Profesional de ejemplo</small>
                </span>
              </div>
            </div>
            <div className="preview-content" id="preview-content">
              <div className="preview-content-title">
                <div>
                  <p>Una mirada a tu día</p>
                  <h2>
                    {activeView === 'summary'
                      ? 'Cada cliente cuenta.'
                      : activeView === 'training'
                        ? 'Un plan con dirección.'
                        : 'Nutrición con criterio.'}
                  </h2>
                </div>
                <span className="preview-date">Miércoles</span>
              </div>
              {activeView === 'summary' && (
                <SummaryPreview isCheckInComplete={isCheckInComplete} />
              )}
              {activeView === 'training' && <TrainingPreview />}
              {activeView === 'nutrition' && <NutritionPreview />}
            </div>
          </div>
        </div>
        <ClientPreview
          isCheckInComplete={isCheckInComplete}
          onToggleCheckIn={toggleCheckIn}
        />
      </div>
      <figcaption id="preview-caption">
        <span className="preview-caption-mark" aria-hidden="true">
          ↳
        </span>
        <span>
          Una plataforma. Dos experiencias conectadas.
          <small>
            Vista conceptual interactiva con datos ficticios. Las funciones del
            producto están en desarrollo.
          </small>
        </span>
      </figcaption>
    </figure>
  );
}
