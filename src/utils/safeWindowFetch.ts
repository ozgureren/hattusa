/**
 * Safely ensures `window.fetch` can be assigned by browser extensions or
 * instrumentation wrappers when the host environment defines `fetch` as a
 * getter-only accessor property on `window` or `Window.prototype`.
 */
export function ensureWritableFetch(win: object): boolean {
  try {
    const ownDesc = Object.getOwnPropertyDescriptor(win, 'fetch');
    const proto = Object.getPrototypeOf(win);
    const protoDesc = proto ? Object.getOwnPropertyDescriptor(proto, 'fetch') : undefined;
    const desc = ownDesc ?? protoDesc;

    if (!desc) return false;

    if ('writable' in desc && desc.writable) return true;
    if (typeof desc.set === 'function') return true;

    if (ownDesc && !ownDesc.configurable) {
      return false;
    }

    let overrideFetch: unknown = null;
    const baseGetter =
      typeof desc.get === 'function'
        ? () => desc.get!.call(win)
        : () => desc.value;

    Object.defineProperty(win, 'fetch', {
      configurable: true,
      enumerable: desc.enumerable !== false,
      get() {
        return overrideFetch !== null ? overrideFetch : baseGetter();
      },
      set(next: unknown) {
        if (typeof next === 'function') {
          overrideFetch = next;
        }
      },
    });

    if (!ownDesc && proto && protoDesc && protoDesc.get && !protoDesc.set && protoDesc.configurable) {
      Object.defineProperty(proto, 'fetch', {
        configurable: true,
        enumerable: protoDesc.enumerable !== false,
        get() {
          return protoDesc.get!.call(this);
        },
        set(next: unknown) {
          if (this && (typeof this === 'object' || typeof this === 'function')) {
            Object.defineProperty(this, 'fetch', {
              configurable: true,
              enumerable: true,
              writable: true,
              value: next,
            });
          }
        },
      });
    }

    return true;
  } catch {
    return false;
  }
}

export function isBenignExtensionFetchError(filename?: string, message?: string): boolean {
  const src = String(filename ?? '');
  const msg = String(message ?? '');
  if (
    src.startsWith('chrome-extension://') ||
    src.startsWith('moz-extension://') ||
    src.startsWith('safari-web-extension://')
  ) {
    return true;
  }
  if (msg.includes('Cannot set property fetch of #<Window>')) {
    return true;
  }
  return false;
}

export function installSafeWindowFetchGuard(): void {
  if (typeof window === 'undefined') return;
  ensureWritableFetch(window);

  window.addEventListener(
    'error',
    (event: ErrorEvent) => {
      if (isBenignExtensionFetchError(event.filename, event.message)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );
}
