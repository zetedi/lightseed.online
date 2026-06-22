import type { Decision } from '../decision';

// Governance as a prism: decisions + their vote-edges (a voice is a user→decision edge,
// stored today as a uid in `votes`) refracted into a per-viewer council view. Pure — no
// backend, no React. The voice threshold (`votesRequired`) decides when the circle passes.
export interface CouncilItem {
  id: string;
  title: string;
  nature: Decision['nature'];
  body?: string;
  passed: boolean;
  voted: boolean;        // the viewer has added their voice
  voiceCount: number;    // voices cast
  voicesRequired: number;
}

export function councilView(decisions: Decision[], viewerUid?: string | null): CouncilItem[] {
  return decisions.map(d => ({
    id: d.id,
    title: d.title,
    nature: d.nature,
    body: d.body,
    passed: d.status === 'passed',
    voted: !!viewerUid && (d.votes || []).includes(viewerUid),
    voiceCount: (d.votes || []).length,
    voicesRequired: d.votesRequired,
  }));
}
