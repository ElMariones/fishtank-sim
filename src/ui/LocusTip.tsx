import { useId, type ReactNode } from 'react';

type Props = { label: string; description: string; inheritance: string; children?: ReactNode };

/**
 * A locus name with a small descriptor shown on hover or keyboard focus. The note is always in the accessibility tree
 * through aria-describedby, so screen readers hear it without hovering.
 */
export function LocusTip({ label, description, inheritance, children }: Props) {
  const id = useId();
  return <span className="locus-name" tabIndex={0} aria-describedby={id}>
    {label}{children}
    <span className="locus-tip" role="tooltip" id={id}><strong>{label}</strong>{description}<em>{inheritance}</em></span>
  </span>;
}
