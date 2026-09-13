import { useState } from 'react';
import { importRuntime, MAX_SAVE_CHARACTERS, type Runtime } from '../core/runtime';
import { SAVE_KEY } from '../core/save';
import { readSlots, type SaveSlots } from '../persistence/database';
import type { SaveSession } from '../persistence/session';

export function downloadText(raw: string, filename: string) {
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SavePanel({ runtime, session, blocked, onSaved, onBusy }: {
  runtime: Runtime; session: SaveSession | null; blocked: boolean; onSaved: () => void; onBusy: (busy: boolean) => void;
}) {
  const [draft, setDraft] = useState('');
  const [preview, setPreview] = useState<Runtime | null>(null);
  const [message, setMessage] = useState('Importing replaces this device’s current world after review. Existing valid saves become backups.');
  const [slots, setSlots] = useState<SaveSlots | null>(null);
  const [busy, setBusy] = useState(false);
  function validate(raw: string) {
    setPreview(null);
    try {
      const next = importRuntime(raw, crypto.randomUUID());
      setPreview(next);
      setMessage('Valid save. Review the fish counts below before replacing this world.');
    } catch (error) { setMessage(`Import rejected. Current world is unchanged. ${error instanceof Error ? error.message : 'Invalid save.'}`); }
  }
  async function commit(next: Runtime, replace: boolean) {
    if (!session) { setMessage('Storage is unavailable. Export your session and reload to retry.'); return; }
    setBusy(true); onBusy(true);
    try {
      await session.save(next, blocked);
      if (replace) window.location.reload();
      else { onSaved(); setMessage('Saved and read back successfully. Autosave is enabled.'); }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Save failed; existing data is preserved.'); }
    finally { setBusy(false); onBusy(false); }
  }
  return <section className="save-panel" aria-labelledby="save-title">
    <h2 id="save-title">Saves and recovery</h2>
    <p>Local sandbox · {runtime.world.fish.length.toLocaleString()} records · {runtime.world.fish.filter(f => f.status === 'living').length} living fish. Exports include identity, ancestry and recent command history. Goals and favorites remain on this device.</p>
    <div className="save-actions">
      <button onClick={() => downloadText(JSON.stringify(runtime), 'fishtank-save-v2.json')}>Export current world</button>
      <button onClick={() => {
        try {
          const raw = localStorage.getItem(SAVE_KEY);
          if (raw === null) setMessage('No legacy save is stored on this device.');
          else downloadText(raw, 'fishtank-preserved-legacy.json');
        } catch { setMessage('Legacy browser storage cannot be read.'); }
      }}>Export preserved legacy save</button>
      <button disabled={busy || !session} onClick={() => void commit(runtime, false)}>{blocked ? 'Save this session and preserve old data' : 'Retry save now'}</button>
      <button disabled={busy || !session} onClick={async () => {
        try { setSlots(await readSlots(session!.database)); } catch { setMessage('Could not read backups. Your session can still be exported.'); }
      }}>Show recovery copies</button>
    </div>
    <label>Import JSON file<input type="file" accept="application/json,.json" disabled={busy} onChange={async event => {
      const file = event.target.files?.[0];
      setPreview(null);
      if (!file) return;
      if (file.size > MAX_SAVE_CHARACTERS) { setMessage('File exceeds the 64 MB import limit.'); return; }
      try { const raw = await file.text(); setDraft(raw); validate(raw); }
      catch { setMessage('Could not read that file. Current world is unchanged.'); }
    }} /></label>
    <label>Or paste a save<textarea aria-label="Save JSON" value={draft} onChange={event => { setDraft(event.target.value); setPreview(null); }} /></label>
    <button disabled={busy || !draft} onClick={() => validate(draft)}>Validate import</button>
    {preview ? <div className="import-preview">
      <h3>Import preview</h3><p>{preview.world.fish.length.toLocaleString()} records · {preview.world.fish.filter(f => f.status === 'living').length} living · {preview.world.tanks.length} tanks · {preview.world.credits.toLocaleString()} credits</p>
      <p>This replaces the current world ({runtime.world.fish.length.toLocaleString()} records). Export this session first if it contains unsaved work.</p>
      <button disabled={busy || !session} onClick={() => void commit(preview, true)}>Replace world with reviewed import</button>
      <button disabled={busy} onClick={() => setPreview(null)}>Cancel import</button>
    </div> : null}
    {slots ? <div><h3>Recovery copies</h3>{(['current', 'backup1', 'backup2'] as const).map(key => {
      const record = slots[key];
      return <div className="save-actions" key={key}><span>{key === 'current' ? 'Stored current' : key === 'backup1' ? 'Previous save' : 'Older save'} · {record?.savedAt ?? 'No copy yet'}</span>
        {record ? <><button onClick={() => downloadText(record.raw, `fishtank-${key}.json`)}>Export {key}</button><button disabled={busy} onClick={() => { setDraft(record.raw); validate(record.raw); }}>Preview {key}</button></> : null}</div>;
    })}</div> : null}
    <p role="status">{message}</p>
  </section>;
}
