const listeners = new Set<() => void>();
type Guard = () => boolean | Promise<boolean>;
let guard: Guard | null = null;
let currentUrl = typeof window === 'undefined' ? '' : window.location.href;

/** Registers a check (sync or async, e.g. confirmDialog) that may cancel navigation. */
export function guardNavigation(check: Guard): () => void {
  guard = check;
  return () => {
    if (guard === check) guard = null;
  };
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    const target = window.location.href;
    if (target !== currentUrl && guard) {
      // Stay on the current page while asking; go on only if confirmed.
      window.history.pushState({}, '', currentUrl);
      void Promise.resolve(guard()).then((ok) => ok && go(target));
      return;
    }
    currentUrl = target;
    notify();
  });
}

export function navigate(
  to: string,
  options: { replace?: boolean } = {}
): void {
  if (guard) {
    void Promise.resolve(guard()).then((ok) => ok && go(to, options));
    return;
  }
  go(to, options);
}

function go(to: string, options: { replace?: boolean } = {}): void {
  if (to.startsWith('#')) {
    const target = document.querySelector(to);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
    window.location.hash = to;
    return;
  }

  if (options.replace) {
    window.history.replaceState({}, '', to);
  } else {
    window.history.pushState({}, '', to);
  }
  currentUrl = window.location.href;
  window.dispatchEvent(new PopStateEvent('popstate'));
  notify();

  if (!to.includes('#')) {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}

export function subscribeNavigation(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
