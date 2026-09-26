import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerServiceWorker } from './register-sw';

describe('registerServiceWorker', () => {
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it('registers service worker when supported and forced', async () => {
    const mockRegister = vi
      .fn()
      .mockResolvedValue({ scope: '/' } as unknown as ServiceWorkerRegistration);

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        ...originalNavigator,
        serviceWorker: {
          register: mockRegister,
        },
      },
      writable: true,
      configurable: true,
    });

    const reg = await registerServiceWorker(true);
    expect(mockRegister).toHaveBeenCalledWith('/sw.js');
    expect(reg).toBeDefined();
  });

  it('gracefully handles registration errors', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mockRegister = vi.fn().mockRejectedValue(new Error('Registration denied'));

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        ...originalNavigator,
        serviceWorker: {
          register: mockRegister,
        },
      },
      writable: true,
      configurable: true,
    });

    const reg = await registerServiceWorker(true);
    expect(mockRegister).toHaveBeenCalledWith('/sw.js');
    expect(reg).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith('Service worker registration failed:', expect.any(Error));
  });

  it('does not register if serviceWorker is not in navigator', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      writable: true,
      configurable: true,
    });

    const reg = await registerServiceWorker(true);
    expect(reg).toBeUndefined();
  });
});
