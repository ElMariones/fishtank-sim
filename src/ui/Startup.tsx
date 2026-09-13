import { useEffect, useState } from 'react';
import { loadSession, type LoadedSession } from '../persistence/session';
import { App } from './App';

export function Startup() {
  const [initial, setInitial] = useState<LoadedSession | null>(null);
  useEffect(() => {
    let cancelled = false;
    let loaded: LoadedSession | null = null;
    // StrictMode's probe is cleaned up before this microtask; it must not create a second world.
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      const result = await loadSession();
      loaded = result;
      if (cancelled) void result.session?.close(); else setInitial(result);
    });
    return () => { cancelled = true; void loaded?.session?.close(); };
  }, []);
  return initial ? <App initial={initial} /> : <main className="save-panel" role="status">Opening your aquarium and checking its save…</main>;
}
