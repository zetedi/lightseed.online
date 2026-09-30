// THE KEY-EPOCH LAW — the server's copy of src/domain/keyEpoch.ts (pure time and lineage
// semantics for a seal), held equal by tests/keyEpoch.test.ts. The spend gate re-verifies a
// decision's signatures on server ground, so the server must judge a key AT THE RECEIPT TIME of
// each signature exactly as the shell does.
export type KeyEventType = "anchor" | "rotate" | "freeze" | "recover";
export interface KeyEpoch { epochId: string; fingerprint: string; anchoredAtMs: number }
export interface KeyEvent {
    eventId: string;
    type: KeyEventType;
    epochId: string;
    keyFingerprint: string;
    recordedAtMs: number;
    previousFingerprint?: string;
    suspectedSinceMs?: number;
}
export interface RecordedKeyUse { epochId?: string; keyFingerprint?: string; recordedAtMs?: number }
export type KeyStanding = "current" | "historical" | "disputed" | "revoked_at_signing" | "not_yet_valid" | "unknown_epoch" | "unanchored";

const terminalEventsFor = (fingerprint: string, events: readonly KeyEvent[]): KeyEvent[] =>
    events
        .filter((event) =>
            (event.type === "rotate" || event.type === "recover")
                ? event.previousFingerprint === fingerprint
                : event.type === "freeze" && event.keyFingerprint === fingerprint)
        .sort((a, b) => a.recordedAtMs - b.recordedAtMs);

export function keyStandingAt(use: RecordedKeyUse, epochs: readonly KeyEpoch[], events: readonly KeyEvent[], currentFingerprint: string): KeyStanding {
    if (!use.epochId || !use.keyFingerprint || use.recordedAtMs === undefined) return "unanchored";
    const epoch = epochs.find((candidate) => candidate.epochId === use.epochId);
    if (!epoch || epoch.fingerprint !== use.keyFingerprint) return "unknown_epoch";
    if (use.recordedAtMs < epoch.anchoredAtMs) return "not_yet_valid";
    const terminalEvents = terminalEventsFor(use.keyFingerprint, events);
    if (terminalEvents.length) {
        const stoppedAt = terminalEvents[0].recordedAtMs;
        const disputedSince = terminalEvents
            .flatMap((event) => (event.suspectedSinceMs !== undefined && event.suspectedSinceMs <= event.recordedAtMs ? [event.suspectedSinceMs] : []))
            .sort((a, b) => a - b)[0];
        if (disputedSince !== undefined && use.recordedAtMs >= disputedSince && use.recordedAtMs < stoppedAt) return "disputed";
        if (use.recordedAtMs >= stoppedAt) return "revoked_at_signing";
    }
    return use.keyFingerprint === currentFingerprint && !terminalEvents.length ? "current" : "historical";
}

export function keyStandingCounts(standing: KeyStanding): boolean {
    return standing === "current" || standing === "historical";
}
