const listeners = new Set<() => void>();
let guard: (() => boolean) | null = null;
let currentUrl = typeof window === 'undefined' ? '' : window.location.href;

export function guardNavigation(check: () => boolean): () => void {
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
    if (window.location.href !== currentUrl && guard && !guard()) {
      window.history.pushState({}, '', currentUrl);
      return;
    }
    currentUrl = window.location.href;
    notify();
  });
}

export function navigate(
  to: string,
  options: { replace?: boolean } = {}
): void {
  if (guard && !guard()) return;
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
