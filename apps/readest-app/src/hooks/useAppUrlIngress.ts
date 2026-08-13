import { useEffect } from 'react';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEnv } from '@/context/EnvContext';
import { isTauriAppPlatform } from '@/services/environment';
import { eventDispatcher } from '@/utils/event';

interface SingleInstancePayload {
  args: string[];
  cwd: string;
}

interface OpenFilesPayload {
  files: string[];
}

/**
 * Single ingress point for incoming URLs from the operating system.
 *
 * Subscribes to every Tauri channel that can deliver a URL on any platform:
 *   - `single-instance` event  — Win/Linux deep link, macOS open-file
 *   - `open-files` event       — macOS in-app open-files
 *   - `onOpenUrl`              — iOS / Android / macOS via Tauri v2
 *
 * Re-broadcasts every URL list as the `app-incoming-url` event. Consumers
 * subscribe to the event instead of the underlying channels, which:
 *   - decouples them from platform specifics
 *   - sidesteps a Tauri Android quirk where multiple `onOpenUrl`
 *     subscribers don't all fire
 *   - keeps the channel-subscription code in exactly one place
 *
 * Existing consumers:
 *   - `useOpenWithBooks`        — file imports
 *   - `useOpenAnnotationLink`   — annotation deep links
 *
 * Cold-start URLs (`getCurrent()`) are intentionally NOT read here. Cold-
 * start handling is consumer-specific (a launching file goes through the
 * library init flow; an annotation jumps the reader), so each consumer
 * reads `getCurrent()` itself when it needs to.
 */
export function useAppUrlIngress() {
  const { appService } = useEnv();

  useEffect(() => {
    if (!isTauriAppPlatform() || !appService) return;
    // Note: removed an old `listened.current` ref guard that tried to
    // make this effect a one-shot. In React strict mode (dev) the effect
    // mounts → cleans up → mounts again. With the guard, the second
    // mount short-circuited (ref still true) and DID NOT re-register
    // any listeners — but the previous cleanup had already
    // `unregister()`ed the underlying native plugin listener
    // (NativeBridgePlugin's listeners["shared-intent"] map). Net result:
    // the app ended up with zero shared-intent listeners on the native
    // side, so any "Open with Readest" intent that arrived AFTER cold
    // start was silently dropped (event got queued by our pending-events
    // workaround but, with no future register call, never replayed).
    // Letting the effect re-run on every mount cycle keeps the JS-side
    // and native-side listener bookkeeping in lockstep.

    const dispatch = (urls: string[], action?: 'VIEW' | 'SEND') => {
      if (!urls.length) return;
      console.log('App incoming URL:', urls, 'action:', action);
      eventDispatcher.dispatch('app-incoming-url', { urls, action });
    };

    const unlistenSingleInstance = getCurrentWindow().listen<SingleInstancePayload>(
      'single-instance',
      ({ payload }) => {
        const url = payload.args?.[1];
        if (url) dispatch([url]);
      },
    );

    const unlistenOpenFiles = getCurrentWindow().listen<OpenFilesPayload>(
      'open-files',
      ({ payload }) => {
        if (payload.files?.length) dispatch(payload.files);
      },
    );

    const unlistenOpenUrl = onOpenUrl((urls) => {
      if (urls?.length) dispatch(urls);
    });

    return () => {
      unlistenSingleInstance.then((f) => f());
      unlistenOpenFiles.then((f) => f());
      unlistenOpenUrl.then((f) => f());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appService]);
}
