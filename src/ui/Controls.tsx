import type { Fish } from '../core/types';

/** Colour-coded sex symbol (pink ♀, blue ♂). The text label keeps it readable without colour or sight. */
export function SexMark({ sex, withLabel = false, decorative = false }: { sex: Fish['sex']; withLabel?: boolean; decorative?: boolean }) {
  const female = sex === 'F', text = female ? 'Female' : 'Male';
  return <span className={`sex-mark ${female ? 'female' : 'male'}`} aria-hidden={decorative || undefined}>
    <span className="sex-symbol" aria-hidden="true">{female ? '♀' : '♂'}</span>
    {withLabel ? <span className="sex-label">{text}</span> : decorative ? null : <span className="visually-hidden">{text}</span>}
  </span>;
}

export function Pagination({ page, count, size, onPage, label }: { page: number; count: number; size: number; onPage: (page: number) => void; label: string }) {
  if (count <= size) return null;
  return <nav className="pagination" aria-label={`${label} pages`}>
    <button disabled={page === 0} onClick={() => onPage(page - 1)}>Previous {label.toLowerCase()} page</button>
    <span>{page * size + 1}–{Math.min(count, (page + 1) * size)} of {count.toLocaleString()}</span>
    <button disabled={(page + 1) * size >= count} onClick={() => onPage(page + 1)}>Next {label.toLowerCase()} page</button>
  </nav>;
}
