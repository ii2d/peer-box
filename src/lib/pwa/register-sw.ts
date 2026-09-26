/**
 * Registers the PeerBox service worker for offline shell caching in production.
 */
export async function registerServiceWorker(
  force = false,
): Promise<ServiceWorkerRegistration | undefined> {
  if (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    (force || import.meta.env.PROD)
  ) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      return registration;
    } catch (err) {
      console.warn('Service worker registration failed:', err);
      return undefined;
    }
  }
  return undefined;
}
