import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';

/**
 * Estado PWA compartido: instalación, nueva versión disponible y conexión.
 * Se importa desde main.tsx para capturar `beforeinstallprompt` aunque el
 * evento llegue antes de montar el sistema interno.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaState {
  canInstall: boolean;
  isInstalled: boolean;
  needsRefresh: boolean;
  isOnline: boolean;
}

const standalone = window.matchMedia('(display-mode: standalone)');
const listeners = new Set<() => void>();
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let state: PwaState = {
  canInstall: false,
  isInstalled:
    standalone.matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true,
  needsRefresh: false,
  isOnline: navigator.onLine,
};

function update(patch: Partial<PwaState>): void {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event as BeforeInstallPromptEvent;
  update({ canInstall: true });
});
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  update({ canInstall: false, isInstalled: true });
});
standalone.addEventListener('change', (event) =>
  update({ isInstalled: event.matches })
);
window.addEventListener('online', () => update({ isOnline: true }));
window.addEventListener('offline', () => update({ isOnline: false }));

// La nueva versión espera confirmación para no recargar un formulario en curso.
const updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh: () => update({ needsRefresh: true }),
});

export async function installApp(): Promise<boolean> {
  if (!deferredPrompt) return false;
  const promptEvent = deferredPrompt;
  deferredPrompt = null;
  update({ canInstall: false });
  await promptEvent.prompt();
  const { outcome } = await promptEvent.userChoice;
  return outcome === 'accepted';
}

export function applyAppUpdate(): void {
  void updateServiceWorker(true);
}

export const isAppleMobile =
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePwa(): PwaState {
  return useSyncExternalStore(subscribe, () => state);
}
