// Human-to-Human Translation — the NVC-grounded reading of a reach message.
//
// The translator is a reader, not a judge: it separates observation, feeling, inference,
// need and request (Nonviolent Communication), offered as an empathy guess through the
// reader's chosen intelligence. It never flattens emotion into politeness — a faithful
// reading is sometimes "a line was crossed".
//
// DEPTH is context depth — how much of the sender's living being the reading draws on
// (input breadth): the message alone, the visions, the tree's public growth (mints), the
// surrounding subgraph. Depth never licenses more speculation, only wider reading.
// Pure module (no services) so the fidelity commitments are testable.

export interface TranslationRequest {
  senderTreeName: string;
  receiverTreeName: string;
  message: string;
  // 1 message only · 2 + visions · 3 + public growth mints · 4 + subgraph (as provided).
  depth: number;
  context?: string; // the living context actually gathered by the caller
}

// The five distinctions — NVC's anatomy with inference (evaluation) separated out.
export interface TranslationResponse {
  happened: string;      // observation, free of evaluation
  feeling: string;       // the living emotional signal, at true strength
  inference: string;     // what the sender may fear or assume — unconfirmed, marked so
  need: string;          // the universal need(s) alive in the message
  asks: string;          // what the message asks of the receiver
  alternatives: string[]; // other honest readings
}

export const TRANSLATION_DEPTH_MIN = 1;
export const TRANSLATION_DEPTH_MAX = 4;

const DEPTH_READINGS: Record<number, string> = {
  1: 'Read the message alone — no context beyond its own words.',
  2: "Read the message in the light of both trees' visions.",
  3: "Read the message in the light of both trees' visions and the sender tree's public growth (its recent mints).",
  4: "Read the message in the light of the visions, the sender tree's public growth, and the surrounding subgraph (shared communities, links, relationships) as provided.",
};

export const clampTranslationDepth = (depth: number): number =>
  Math.min(TRANSLATION_DEPTH_MAX, Math.max(TRANSLATION_DEPTH_MIN, Math.round(depth || TRANSLATION_DEPTH_MIN)));

export const buildTranslationPrompt = (req: TranslationRequest): string => {
  const depth = clampTranslationDepth(req.depth);
  return `
You are the Translation engine of the Living Intelligence Network — a reader, not a judge.
Your purpose is to help life recognise life: to help the receiver hear what the sender is
actually saying, across hurt, conflict, difference and distance.

Ground the reading in Nonviolent Communication:
- separate OBSERVATION from evaluation;
- separate FEELINGS from thoughts dressed as feelings — when the speaker's word is a judgment
  ("betrayed", "ignored"), keep their word AND offer the possible feeling and need underneath
  it as a guess alongside, never a replacement;
- name the universal NEEDS beneath strategies;
- hear the REQUEST beneath the words, and whether it arrives as a request or a demand.

Fidelity commitments — these define a correct reading:
- Preserve intensity. Anger, grief and boundaries keep their true strength.
- Label inference as inference: unconfirmed fears or assumptions, clearly marked.
- Never decide who is right. Never counsel reconciliation, forgiveness or calm.
- A faithful reading is sometimes: "a line was crossed."
- Every reading is an empathy guess, offered tentatively — never a verdict.
- Use only the context provided; greater depth widens the context read, never the speculation.
- If the message itself does not cohere — the words simply don't add up to a readable
  meaning — say so plainly and kindly in "happened", offer the most charitable readable
  fragments as alternatives, and remind the receiver that confabulation is not a machine
  monopoly: humans hallucinate too, sometimes even heads of state. Confusion deserves the
  same warmth as clarity.

Sender: ${req.senderTreeName}
Receiver: ${req.receiverTreeName}
Message: "${req.message}"
Context depth ${depth}: ${DEPTH_READINGS[depth]}
Living context provided: ${req.context || 'None'}

Respond with a JSON object in exactly this structure:
{
  "happened": "What the message states or reports — observation, free of evaluation.",
  "feeling": "The living emotional signal, at its true strength (guessed where unstated).",
  "inference": "What the sender may fear or assume — unconfirmed, and marked so.",
  "need": "The universal need(s) that seem alive in this message.",
  "asks": "What the message asks of the receiver: acknowledgment, space, an answer, repair, a boundary respected…",
  "alternatives": ["another honest reading"]
}
`;
};
