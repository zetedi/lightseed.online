import type { Decision, DecisionStatus, Concern } from '../decision';

// Governance as a prism: decisions + their vote-edges (a voice is a user→decision edge,
// stored today as a uid in `votes`) refracted into a per-viewer council view. Pure — no
// backend, no React. The voice threshold (`votesRequired`) decides when the circle passes.
export interface CouncilItem {
  id: string;
  title: string;
  nature: Decision['nature'];
  body?: string;
  status: DecisionStatus;
  passed: boolean;
  closed: boolean;       // withdrawn / rejected / expired — no longer open
  listening: boolean;    // a concern was raised; the proposal is paused for reflection
  concerns: Concern[];
  voted: boolean;        // the viewer has added their voice
  voiceCount: number;    // voices cast
  voicesRequired: number;
  isProposer: boolean;
}

export function councilView(decisions: Decision[], viewerUid?: string | null): CouncilItem[] {
  return decisions.map(d => ({
    id: d.id,
    title: d.title,
    nature: d.nature,
    body: d.body,
    status: d.status,
    passed: d.status === 'passed',
    closed: ['withdrawn', 'rejected', 'expired'].includes(d.status),
    listening: !!d.listening,
    concerns: d.concerns || [],
    voted: !!viewerUid && (d.votes || []).includes(viewerUid),
    voiceCount: (d.votes || []).length,
    voicesRequired: d.votesRequired,
    isProposer: !!viewerUid && d.proposedBy === viewerUid,
  }));
}
