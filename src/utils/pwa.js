/**
 * Register service worker + runtime version checks.
 * The update callback receives a function that applies the update immediately.
 */
import { createLogger } from '@/utils/logger';

const logger = createLogger('PWA');

async function disablePwaForDevMode() {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));

    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch (err) {
    logger.warn('sw_disable_in_dev_failed', { error: err?.message || String(err) });
  }
}

export function registerServiceWorker(options = {}) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return () => {};
  }

  if (import.meta.env.DEV) {
    // In dev we explicitly remove existing SW + caches to avoid stale bundles.
    void disablePwaForDevMode();
    return () => {};
  }

  const onNeedRefresh = typeof options.onNeedRefresh === 'function' ? options.onNeedRefresh : null;
  let promptShown = false;
  let reloading = false;

  const emitUpdatePrompt = (applyUpdate) => {
    if (!onNeedRefresh || promptShown) return;
    promptShown = true;
    onNeedRefresh(applyUpdate);
  };

  const getCurrentModuleEntryPath = () => {
    const script = document.querySelector('script[type="module"][src]');
    if (!script) return '';
    try {
      return new URL(script.getAttribute('src') || '', window.location.origin).pathname;
    } catch {
      return '';
    }
  };

  const checkHtmlBundleUpdate = async () => {
    const currentPath = getCurrentModuleEntryPath();
    if (!currentPath) return;

    try {
      const response = await fetch(`/index.html?ts=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'cache-control': 'no-cache' }
      });
      if (!response.ok) return;
      const html = await response.text();
      const moduleMatch = html.match(/<script[^>]*type=["']module["'][^>]*src=["']([^"']+)["']/i);
      if (!moduleMatch?.[1]) return;

      const latestPath = new URL(moduleMatch[1], window.location.origin).pathname;
      if (latestPath && latestPath !== currentPath) {
        emitUpdatePrompt(() => window.location.reload());
      }
    } catch (err) {
      logger.warn('version_check_failed', { error: err?.message || String(err) });
    }
  };

  const onControllerChange = () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

  const register = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');

      const promptForWaitingWorker = (worker) => {
        if (!worker) return;
        emitUpdatePrompt(() => {
          worker.postMessage({ type: 'SKIP_WAITING' });
        });
      };

      if (registration.waiting) {
        promptForWaitingWorker(registration.waiting);
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            promptForWaitingWorker(newWorker);
          }
        });
      });

      // Force update check on startup
      await registration.update();
    } catch (err) {
      logger.warn('sw_registration_failed', { error: err?.message || String(err) });
    }

    // Independent bundle check, useful even if SW script did not change
    void checkHtmlBundleUpdate();
  };

  void register();

  return () => {
    navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  };
}
