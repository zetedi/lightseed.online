import type { Decision, DecisionStatus, Concern, DecisionMode, ConsensusStance, Position } from '../decision';

// Governance as a prism: decisions + their vote-edges (a voice is a user→decision edge,
// stored today as a uid in `votes`) refracted into a per-viewer council view. Pure — no
// backend, no React. The voice threshold (`votesRequired`) decides when the circle passes;
// consensus mode instead surfaces the meeting's unite/stand-aside/block positions.
export interface CouncilItem {
  id: string;
  title: string;
  nature: Decision['nature'];
  body?: string;
  status: DecisionStatus;
  mode: DecisionMode;
  passed: boolean;
  closed: boolean;       // withdrawn / rejected / expired — no longer open
  listening: boolean;    // a concern was raised; the proposal is paused for reflection
  concerns: Concern[];
  voted: boolean;        // the viewer has added their voice (threshold)
  voiceCount: number;    // voices cast (threshold)
  voicesRequired: number;
  isProposer: boolean;   // the clerk, in consensus terms
  // Consensus mode:
  positions: Position[];
  unites: number;
  standAsides: number;
  blocks: number;
  blocked: boolean;      // an unresolved block stands — the meeting is not in unity
  myStance?: ConsensusStance; // the viewer's current position, if any
}

export function councilView(decisions: Decision[], viewerUid?: string | null): CouncilItem[] {
  return decisions.map(d => {
    const positions = d.positions || [];
    const count = (s: ConsensusStance) => positions.filter(p => p.stance === s).length;
    return {
      id: d.id,
      title: d.title,
      nature: d.nature,
      body: d.body,
      status: d.status,
      mode: d.mode || 'threshold',
      passed: d.status === 'passed',
      closed: ['withdrawn', 'rejected', 'expired'].includes(d.status),
      listening: !!d.listening,
      concerns: d.concerns || [],
      voted: !!viewerUid && (d.votes || []).includes(viewerUid),
      voiceCount: (d.votes || []).length,
      voicesRequired: d.votesRequired,
      isProposer: !!viewerUid && d.proposedBy === viewerUid,
      positions,
      unites: count('unite'),
      standAsides: count('stand_aside'),
      blocks: count('block'),
      blocked: count('block') > 0,
      myStance: viewerUid ? positions.find(p => p.by === viewerUid)?.stance : undefined,
    };
  });
}
