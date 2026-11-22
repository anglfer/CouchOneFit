import { useEffect, useId, useRef, useState, type ReactElement } from 'react';
import { Icon } from '../../../components/Icon';
import type { PanelScreen, PhoneScreen } from '../../../components/ProductShot';

export interface LightboxSlide {
  id: string;
  title: string;
  summary: string;
  syncHighlight: string;
  panel: PanelScreen;
  phone: PhoneScreen;
  panelAlt: string;
  phoneAlt: string;
}

interface ProductLightboxProps {
  slides: LightboxSlide[];
  activeIndex: number;
  initialDevice?: 'panel' | 'phone';
  isOpen: boolean;
  onClose: () => void;
  onSelectIndex: (index: number) => void;
}

export function ProductLightbox({
  slides,
  activeIndex,
  initialDevice = 'panel',
  isOpen,
  onClose,
  onSelectIndex,
}: ProductLightboxProps): ReactElement {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [selectedDevice, setSelectedDevice] = useState<
    'panel' | 'phone' | null
  >(null);
  const device = selectedDevice ?? initialDevice;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Fallback ligero para Safari / navegadores sin soporte nativo de `closedby="any"`.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || 'closedBy' in HTMLDialogElement.prototype) return;

    let pressedOutside = false;
    const isOutside = (event: PointerEvent): boolean => {
      const rect = dialog.getBoundingClientRect();
      return (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      );
    };

    const handlePointerDown = (event: PointerEvent): void => {
      pressedOutside = isOutside(event);
    };
    const handlePointerUp = (event: PointerEvent): void => {
      if (pressedOutside && isOutside(event)) {
        dialog.close();
      }
      pressedOutside = false;
    };

    dialog.addEventListener('pointerdown', handlePointerDown);
    dialog.addEventListener('pointerup', handlePointerUp);
    return () => {
      dialog.removeEventListener('pointerdown', handlePointerDown);
      dialog.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  const current = slides[activeIndex] ?? slides[0];
  const canNavigate = slides.length > 1;
  const previousIndex = activeIndex === 0 ? slides.length - 1 : activeIndex - 1;
  const nextIndex = activeIndex === slides.length - 1 ? 0 : activeIndex + 1;

  const currentSrc =
    device === 'panel'
      ? `/marketing/${current.panel}.webp`
      : `/marketing/${current.phone}.webp`;
  const currentAlt = device === 'panel' ? current.panelAlt : current.phoneAlt;

  return (
    <dialog
      ref={dialogRef}
      className="mk-lightbox"
      aria-labelledby={titleId}
      onClose={() => {
        if (dialogRef.current) {
          dialogRef.current.returnValue = '';
        }
        setSelectedDevice(null);
        onClose();
      }}
      {...({ closedby: 'any' } as Record<string, unknown>)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-border bg-white px-4 py-3.5 sm:px-6">
        <div className="min-w-0">
          <h2
            id={titleId}
            className="font-display text-lg font-semibold text-brand-ink sm:text-xl"
          >
            {current.title}
          </h2>
          <p className="mt-0.5 text-sm text-brand-muted">{current.summary}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-xl border border-brand-border bg-brand-surface p-1"
            role="group"
            aria-label="Vista del dispositivo"
          >
            <button
              type="button"
              aria-pressed={device === 'panel'}
              onClick={() => setSelectedDevice('panel')}
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors ${
                device === 'panel'
                  ? 'bg-brand-primary text-white'
                  : 'text-brand-ink hover:bg-white'
              }`}
            >
              <Icon name="monitor" size={16} />
              Panel web
            </button>
            <button
              type="button"
              aria-pressed={device === 'phone'}
              onClick={() => setSelectedDevice('phone')}
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors ${
                device === 'phone'
                  ? 'bg-brand-primary text-white'
                  : 'text-brand-ink hover:bg-white'
              }`}
            >
              <Icon name="smartphone" size={16} />
              App móvil
            </button>
          </div>

          <button
            type="button"
            autoFocus
            onClick={() => dialogRef.current?.close()}
            aria-label="Cerrar vista ampliada"
            className="inline-flex size-11 items-center justify-center rounded-xl border border-brand-border bg-white text-brand-ink transition-colors hover:border-brand-primary hover:text-brand-primary"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center overflow-auto bg-[#050a1a] p-4 sm:p-6">
        {isOpen && (
          <img
            src={currentSrc}
            alt={currentAlt}
            width={device === 'panel' ? 2160 : 720}
            height={device === 'panel' ? 1350 : 1600}
            className={`max-h-[64vh] w-auto rounded-xl border border-white/15 object-contain ${
              device === 'phone' ? 'max-w-[320px] rounded-[28px]' : ''
            }`}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-border bg-brand-surface px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 text-sm text-brand-ink">
          <Icon name="swap" size={16} className="shrink-0 text-brand-primary" />
          <span>{current.syncHighlight}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canNavigate && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSelectIndex(previousIndex)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-brand-border-strong bg-white px-3.5 text-sm font-semibold text-brand-ink transition-colors hover:border-brand-primary hover:text-brand-primary"
              >
                <Icon name="arrow-right" size={16} className="rotate-180" />
                Anterior
              </button>
              <button
                type="button"
                onClick={() => onSelectIndex(nextIndex)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-brand-border-strong bg-white px-3.5 text-sm font-semibold text-brand-ink transition-colors hover:border-brand-primary hover:text-brand-primary"
              >
                Siguiente
                <Icon name="arrow-right" size={16} />
              </button>
            </div>
          )}
          <span className="text-xs font-medium text-[#5b6388]">
            Captura real del producto con datos de demostración
          </span>
        </div>
      </div>
    </dialog>
  );
}
