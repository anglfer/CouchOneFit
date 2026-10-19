const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', notify);
}

export function navigate(
  to: string,
  options: { replace?: boolean } = {}
): void {
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
