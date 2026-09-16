import { useState } from 'react';
import type { GuideStep, GuideStepId } from '../core/onboarding';

type Props = { steps: GuideStep[]; onShow: (id: GuideStepId) => void; onHide: () => void };

/** FS-504 first-session guide: the next step with a pointer to its control, and every step on request. */
export function OnboardingGuide({ steps, onShow, onHide }: Props) {
  const [expanded, setExpanded] = useState(false);
  const done = steps.filter(step => step.done).length, next = steps.find(step => !step.done);
  return <section className="guide-panel" aria-labelledby="guide-title">
    <div className="guide-heading">
      <div>
        <div className="eyebrow">FIRST SESSION GUIDE · {done} OF {steps.length} DONE</div>
        <h2 id="guide-title">{next ? `Step ${steps.indexOf(next) + 1}: ${next.title}` : 'Guide complete'}</h2>
        <p>{next ? next.detail : 'Continue your lineage at any pace. When offspring you do not keep grow up, select them in the collection to sell them to NPC buyers or rehome them for free; the credits button explains every buyer and your ledger. Fish never die in this lab, and sold or rehomed fish keep their family records.'}</p>
      </div>
      <div className="guide-actions">
        {next ? <button className="primary" onClick={() => onShow(next.id)}>Show me</button> : null}
        <button aria-expanded={expanded} aria-controls="guide-steps" onClick={() => setExpanded(value => !value)}>{expanded ? 'Hide steps' : 'All steps'}</button>
        <button className="quiet" onClick={onHide}>Hide guide</button>
      </div>
    </div>
    <progress max={steps.length} value={done} aria-label={`${done} of ${steps.length} guide steps done`} />
    {expanded ? <ol id="guide-steps" className="guide-steps">{steps.map((step, i) => <li key={step.id} className={step.done ? 'done' : step === next ? 'next' : undefined}>
      <span className="guide-mark" aria-hidden="true">{step.done ? '✓' : i + 1}</span>
      <div><strong>{step.title}</strong><small>{step.done ? 'Done' : step === next ? 'Next' : 'Not yet'} · {step.detail}</small></div>
      {step.done ? null : <button className="quiet" onClick={() => onShow(step.id)}>Show me<span className="visually-hidden">: {step.title}</span></button>}
    </li>)}</ol> : null}
  </section>;
}
