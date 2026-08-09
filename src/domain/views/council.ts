import type { Decision, DecisionStatus, Concern, DecisionMode, ConsensusStance, Position } from '../decision';

// Governance as a prism: decisions + their SIGNATURES (a voice is a signature doc in
// pulses/{id}/signatures — the votes[] array is retired; ring 2026-08-10) refracted into a
// per-viewer council view. Pure — no backend, no React. The voice threshold (`votesRequired`)
// decides when the circle passes; consensus mode instead surfaces the meeting's
// unite/stand-aside/block positions.
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
  voted: boolean;        // the viewer has added their voice (a signature; legacy votes read too)
  voiceCount: number;    // VERIFIED signatures (legacy unsigned voices only where no crypto exists)
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

// A decision's crypto standing, as the caller measured it (CommunityCouncil re-verifies the raw
// signatures per decision). `signedUids` = who holds a signature slot; `verifiedCount` = how many
// verify against the frozen identity. Absent entry = the signatures could not be read (offline) —
// then the LEGACY votes array is the only witness left, and the view says what it can prove.
export interface DecisionSigInfo {
  signedUids: ReadonlySet<string>;
  verifiedCount: number;
}

export function councilView(
  decisions: Decision[],
  viewerUid?: string | null,
  sigInfoById?: Record<string, DecisionSigInfo>,
): CouncilItem[] {
  return decisions.map(d => {
    const positions = d.positions || [];
    const count = (s: ConsensusStance) => positions.filter(p => p.stance === s).length;
    const sig = sigInfoById?.[d.id];
    // Legacy pre-crypto voices (the retired votes[] array, still on old documents): read, never
    // written. Where signatures exist they are the truth; where none do, history still counts.
    const legacyVotes = d.votes || [];
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
      voted: !!viewerUid && (!!sig?.signedUids.has(viewerUid) || legacyVotes.includes(viewerUid)),
      voiceCount: sig ? Math.max(sig.verifiedCount, sig.signedUids.size === 0 ? legacyVotes.length : 0) : legacyVotes.length,
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
