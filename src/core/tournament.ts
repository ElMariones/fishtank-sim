/**
 * Tournament format 2 (FS-133, world v22): judging briefs, special awards, show-day incidents and player preparations.
 * Everything here is a pure function of the seed, the event and the saved entrant snapshots; the incident and brief come from
 * their own `circuit:2` stream, independent of every inheritance stream, and are known before entry so the player can plan.
 * Format-1 runs (FS-124) never pass through this module.
 */
import { COMPETITION_TIERS, competitionScores, type CompetitionEvent, type CompetitionParticipant } from './competitions';
import { express } from './genetics';
import { clamp, hash, random } from './random';
import type { Fish } from './types';

export type Scores = CompetitionParticipant['scores'];
export const BRIEF_IDS = ['classic', 'form', 'colour', 'keepers'] as const;
export const AWARD_IDS = ['rising-star', 'heavyweight', 'spirit', 'finest-colour'] as const;
export const INCIDENT_IDS = ['calm', 'heatwave', 'flicker', 'crowd', 'guest-judge', 'delay'] as const;
export const TACTIC_IDS = ['acclimate', 'lighting', 'spotlight'] as const;
export type BriefId = typeof BRIEF_IDS[number];
export type AwardId = typeof AWARD_IDS[number];
export type IncidentId = typeof INCIDENT_IDS[number];
export type TacticId = typeof TACTIC_IDS[number];
/** Saved with every format-2 run. `tactic` and `awardWinner` stay null until judging. */
export type ShowFormat = { model: 2; brief: BriefId; award: AwardId; incident: IncidentId; tactic: TacticId | null; awardWinner: string | null };

export const BRIEFS: Record<BriefId, { name: string; weights: [number, number, number]; blurb: string; focus: keyof Scores | null }> = {
  classic: { name: 'Grand Classic', weights: [1 / 3, 1 / 3, 1 / 3], blurb: 'Presentation, pattern and condition count equally.', focus: null },
  form: { name: 'Form & Carriage', weights: [0.5, 0.25, 0.25], blurb: 'Silhouette, fins and poise carry half the score.', focus: 'presentation' },
  colour: { name: 'Colour Masters', weights: [0.25, 0.5, 0.25], blurb: 'Pigment, markings and ornament carry half the score.', focus: 'pattern' },
  keepers: { name: "Keeper's Cup", weights: [0.25, 0.25, 0.5], blurb: 'Husbandry wins here: condition carries half the score.', focus: 'condition' },
};
export const AWARDS: Record<AwardId, { name: string; blurb: string }> = {
  'rising-star': { name: 'Rising Star', blurb: 'The youngest exhibit in the hall.' },
  heavyweight: { name: 'Heavyweight', blurb: 'The longest exhibit in the hall.' },
  spirit: { name: 'Spirit of the Show', blurb: 'The boldest, most outgoing exhibit.' },
  'finest-colour': { name: 'Finest Colour', blurb: 'The highest final pattern score.' },
};
export const INCIDENTS: Record<IncidentId, { name: string; blurb: string; counter: string | null }> = {
  calm: { name: 'Perfect conditions', blurb: 'Stable water, soft light and a quiet hall. Nothing will interfere with the judging.', counter: null },
  heatwave: { name: 'Heatwave in the hall', blurb: 'The hall is warming. Exhibits entered below 85% condition lose 5 condition points.', counter: 'Quiet acclimation protects your entrants. Show lighting adds heat: a further −2 condition.' },
  flicker: { name: 'Flickering lights', blurb: 'The venue lighting rig is failing. Every exhibit loses 4 pattern points.', counter: 'Show lighting brings your own lamps and cancels the penalty.' },
  crowd: { name: 'Roaring crowd', blurb: 'A record audience. Shy animals lose 4 presentation points; bold ones gain 2.', counter: 'Quiet acclimation cancels the shy penalty. Spotlight staging doubles the crowd effect.' },
  'guest-judge': { name: 'A guest judge who loves size', blurb: 'A celebrity guest joins the panel. The three longest exhibits gain 3 presentation points.', counter: null },
  delay: { name: 'Late transport', blurb: 'Exhibit transport ran hours late. Every exhibit loses 3 condition points.', counter: 'Quiet acclimation settles your entrants and cancels the penalty.' },
};
export const TACTICS: Record<TacticId, { name: string; blurb: string }> = {
  acclimate: { name: 'Quiet acclimation', blurb: '+1.5 condition. Shields against heat, crowds and transport stress.' },
  lighting: { name: 'Show lighting', blurb: '+2.5 pattern. Cancels failing venue lights, but adds heat.' },
  spotlight: { name: 'Spotlight staging', blurb: '+3 presentation for bold animals, −2 for shy ones. Doubles crowd effects.' },
};
const pick = <T>(values: readonly T[], rng: () => number) => values[Math.floor(rng() * values.length)];
const round = (value: number) => Math.round(value * 10) / 10;

/** The brief, award and incident of an event (format 2). Amateur shows never draw the harshest incidents. */
export function showFormat(seed: number, event: CompetitionEvent): Omit<ShowFormat, 'tactic' | 'awardWinner'> & { model: 2 } {
  const rng = random(hash(`${seed}:circuit:2:${event.id}`));
  const brief = event.tier === 'amateur' ? 'classic' : pick(BRIEF_IDS, rng);
  const award = pick(AWARD_IDS, rng);
  const incident = pick(event.tier === 'amateur' ? (['calm', 'flicker', 'guest-judge', 'delay'] as const) : INCIDENT_IDS, rng);
  return { model: 2, brief, award, incident };
}
export function weightedTotal(scores: Scores, brief: BriefId): number {
  const [p, pa, c] = BRIEFS[brief].weights;
  return round(scores.presentation * p + scores.pattern * pa + scores.condition * c);
}
/** Boldness on 0–1 for every species. */
export function temperament(fish: Fish): number {
  const p = express(fish.genome);
  return p.guppy?.bold ?? p.goldfish?.bold ?? p.axolotl?.bold ?? p.bold;
}
/** A short descriptor a judge would use: variety, strain, morph or koi colours. */
export function exhibitLabel(fish: Fish): string {
  const p = express(fish.genome);
  if (p.guppy) return p.guppy.strain.name;
  if (p.goldfish) return p.goldfish.variety.name;
  if (p.axolotl) return `${p.axolotl.pigmentation.morph} axolotl`.replace(/^./, c => c.toUpperCase());
  return `${p.appearance.base.join(' and ')} koi`.replace(/^./, c => c.toUpperCase());
}

export type Adjustment = { delta: Scores; notes: string[] };
type Context = { bold: number; lengthRank: number; baseCondition: number; isPlayer: boolean };
/** Published, per-exhibit show-day effects. Preparations apply only to the player's entrants. */
export function showAdjustment(incident: IncidentId, tactic: TacticId | null, c: Context): Adjustment {
  const d: Scores = { presentation: 0, pattern: 0, condition: 0 }, notes: string[] = [];
  const t = c.isPlayer ? tactic : null, shy = c.bold < 0.45, bold = c.bold > 0.6;
  if (incident === 'heatwave' && c.baseCondition < 85) {
    if (t === 'acclimate') notes.push('Acclimation kept it cool in the heat'); else { d.condition -= 5; notes.push('Heat stress −5 condition'); }
  }
  if (incident === 'heatwave' && t === 'lighting') { d.condition -= 2; notes.push('Lamp heat −2 condition'); }
  if (incident === 'flicker') {
    if (t === 'lighting') notes.push('Own lamps beat the flicker'); else { d.pattern -= 4; notes.push('Failing lights −4 pattern'); }
  }
  if (incident === 'crowd' && (shy || bold)) {
    const factor = t === 'spotlight' ? 2 : 1;
    if (shy && t === 'acclimate') notes.push('Acclimation calmed a shy animal');
    else if (shy) { d.presentation -= 4 * factor; notes.push(`Crowd-shy −${4 * factor} presentation`); }
    else { d.presentation += 2 * factor; notes.push(`Played to the crowd +${2 * factor} presentation`); }
  }
  if (incident === 'guest-judge' && c.lengthRank < 3) { d.presentation += 3; notes.push('Guest judge admired its size +3 presentation'); }
  if (incident === 'delay') {
    if (t === 'acclimate') notes.push('Acclimation settled it after transport'); else { d.condition -= 3; notes.push('Transport stress −3 condition'); }
  }
  if (t === 'acclimate') { d.condition += 1.5; notes.push('Acclimation +1.5 condition'); }
  if (t === 'lighting') { d.pattern += 2.5; notes.push('Show lighting +2.5 pattern'); }
  if (t === 'spotlight') {
    if (c.bold >= 0.5) { d.presentation += 3; notes.push('Spotlight +3 presentation'); } else { d.presentation -= 2; notes.push('Spotlight unsettled it −2 presentation'); }
  }
  return { delta: { presentation: round(d.presentation), pattern: round(d.pattern), condition: round(d.condition) }, notes };
}
const applied = (base: Scores, delta: Scores): Scores => ({
  presentation: round(clamp(base.presentation + delta.presentation, 0, 100)), pattern: round(clamp(base.pattern + delta.pattern, 0, 100)), condition: round(clamp(base.condition + delta.condition, 0, 100)),
});

export type ScoredEntry = { fish: Fish; isPlayer: boolean; owner: string; base: Scores; adjust: Scores; scores: Scores; total: number; notes: string[] };
/**
 * Scores a format-2 field. Before judging (`tactic === undefined`) every exhibit carries its base scores and no adjustment;
 * after judging the incident and the chosen preparation apply. Order: total descending, then animal ID.
 */
export function scoreField(event: CompetitionEvent, show: Pick<ShowFormat, 'brief' | 'incident'>, entries: { fish: Fish; isPlayer: boolean; owner: string }[], tactic?: TacticId): ScoredEntry[] {
  const byLength = [...entries].sort((a, b) => b.fish.life.lengthCm - a.fish.life.lengthCm || a.fish.id.localeCompare(b.fish.id)).map(e => e.fish.id);
  const scored = entries.map(entry => {
    const base = competitionScores(entry.fish, event);
    const adjustment = tactic === undefined ? { delta: { presentation: 0, pattern: 0, condition: 0 }, notes: [] }
      : showAdjustment(show.incident, tactic, { bold: temperament(entry.fish), lengthRank: byLength.indexOf(entry.fish.id), baseCondition: base.condition, isPlayer: entry.isPlayer });
    // The saved adjustment is the effective change after the 0–100 clamp, so a published "+1.5" always moved the score.
    const scores = applied(base, adjustment.delta);
    const adjust = { presentation: round(scores.presentation - base.presentation), pattern: round(scores.pattern - base.pattern), condition: round(scores.condition - base.condition) };
    return { ...entry, base, adjust, scores, total: weightedTotal(scores, show.brief), notes: adjustment.notes };
  });
  return scored.sort((a, b) => b.total - a.total || a.fish.id.localeCompare(b.fish.id));
}
/** The special award winner among final scores. Ties fall to the lower animal ID. */
export function awardWinner(award: AwardId, field: ScoredEntry[]): string {
  const metric = (e: ScoredEntry) => award === 'rising-star' ? -e.fish.life.ageDays : award === 'heavyweight' ? e.fish.life.lengthCm
    : award === 'spirit' ? temperament(e.fish) : e.scores.pattern;
  return [...field].sort((a, b) => metric(b) - metric(a) || a.fish.id.localeCompare(b.fish.id))[0].fish.id;
}

const OPENINGS = [
  (n: string, l: string) => `${n} brought a confident ${l} to the glass.`,
  (n: string, l: string) => `A ${l} with real character — ${n} held the panel's attention.`,
  (n: string, l: string) => `${n} showed the panel what a ${l} can be.`,
  (n: string, l: string) => `The judges lingered over ${n}, a ${l} of clear intent.`,
  (n: string, l: string) => `${n} arrived as a ${l} with something to prove.`,
  (n: string, l: string) => `An assured ${l}: ${n} never looked out of place.`,
];
const FINISH: Record<'gold' | 'podium' | 'field' | 'back', string[]> = {
  gold: ['Best in show, and deservedly so.', 'A champion on every card that mattered.', 'The panel was unanimous: this is the winner.'],
  podium: ['A podium place against a strong field.', 'Close enough to the top to worry the champion.', 'A medal well earned.'],
  field: ['A solid mid-field showing with clear room to climb.', 'Respectable today; one stronger category would change everything.', 'In the hunt, just short of the medals.'],
  back: ['A learning day — the next show is a fresh start.', 'The field was deep today; this one will be back.', 'Not its day, but the potential is there.'],
};
const FOCUS_LINE: Record<keyof Scores, string> = { presentation: 'form and carriage', pattern: 'colour and markings', condition: 'condition and husbandry' };
/** The panel's note, stored with the result so future text changes never rewrite history. */
export function judgeComment(event: CompetitionEvent, show: ShowFormat, entry: ScoredEntry, rank: number): string {
  const rng = random(hash(`${event.id}:${entry.fish.id}:comment:2`));
  const ordered = (Object.keys(entry.scores) as (keyof Scores)[]).sort((a, b) => entry.scores[b] - entry.scores[a] || a.localeCompare(b));
  const brief = BRIEFS[show.brief], best = ordered[0], worst = ordered[2];
  const parts = [pick(OPENINGS, rng)(entry.fish.name, exhibitLabel(entry.fish).toLowerCase())];
  parts.push(brief.focus && brief.focus === best ? `Its ${FOCUS_LINE[best]} (${entry.scores[best].toFixed(1)}) was exactly what this ${brief.name} brief rewards.`
    : brief.focus && brief.focus === worst ? `In a ${brief.name} show, its ${FOCUS_LINE[worst]} (${entry.scores[worst].toFixed(1)}) cost it dearly.`
    : `Strongest in ${FOCUS_LINE[best]} (${entry.scores[best].toFixed(1)}), weakest in ${FOCUS_LINE[worst]} (${entry.scores[worst].toFixed(1)}).`);
  const shift = entry.adjust.presentation + entry.adjust.pattern + entry.adjust.condition;
  if (shift <= -3) parts.push(`${INCIDENTS[show.incident].name} took its toll.`);
  else if (entry.isPlayer && show.tactic && shift > 0) parts.push(`The ${TACTICS[show.tactic].name.toLowerCase()} paid off.`);
  else if (shift >= 2) parts.push('It rose to the occasion on show day.');
  parts.push(pick(rank === 1 ? FINISH.gold : rank <= 3 ? FINISH.podium : rank <= 6 ? FINISH.field : FINISH.back, rng));
  return parts.join(' ');
}
export const tierLevel = (event: CompetitionEvent) => COMPETITION_TIERS.indexOf(event.tier);
