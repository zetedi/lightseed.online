// Write policy — the authorization mirror of the read projections: who may ACT on the LIN.
// Thin today (tending a tree's circle and joining a vision are self-service for any signed-in
// soul), but this is its home as it grows (e.g. validated-only reaches, member-only votes).
// Event/edit authorization already lives in pulseVisibility.ts (canEditEvent).

export const canTendTree = (viewerUid?: string | null): viewerUid is string => !!viewerUid;
export const canJoinVision = (viewerUid?: string | null): viewerUid is string => !!viewerUid;
