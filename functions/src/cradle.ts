// THE CRADLE AT A HOST, server side — the pure half. MIRRORS src/domain/domainVerification.ts
// (hostWearingOf, wearsHost) and src/domain/communityDoor.ts (cradleRankOf, chooseCradle), with
// interbeingMatrix.normalizeAnchorDomain; tests/communityDoor.test.ts holds the mirror equal to the
// law. core.ts owns the plumbing — the two reads (by domain, by alias) and the choice (`cradleAt`) —
// so that the mail's place, the ray's home and the face feed answer by ONE law: a host is worn by a
// DNS-proven domain or a steward-granted alias; a domain merely written into a record is a claim,
// which answers only when nothing is worn (the node refuses even that: seed.wears_host, 063).
export const normalizeAnchorDomain = (value: string): string => {
    const withoutScheme = value.trim().toLowerCase().replace(/^https?:\/\//, "");
    const authority = withoutScheme.split(/[/?#]/, 1)[0] || "";
    return authority.replace(/^www\./, "").replace(/:\d+$/, "");
};
export type HostWearing = "domain" | "alias";
export interface CradleFacts {
    domain?: string | null;
    domainAliases?: readonly string[] | null;
    domainVerification?: { domain?: string } | null;
    createdAtMs: number;
}
export const hostWearingOf = (
    community: { domain?: string | null; domainAliases?: readonly string[] | null; domainVerification?: { domain?: string } | null },
    host: string,
): HostWearing | null => {
    const h = normalizeAnchorDomain(host || "");
    if (!h) return null;
    if (normalizeAnchorDomain(community.domain || "") === h && community.domainVerification?.domain === h) return "domain";
    if ((community.domainAliases || []).map(normalizeAnchorDomain).includes(h)) return "alias";
    return null;
};
export const wearsHost = (
    community: { domain?: string | null; domainAliases?: readonly string[] | null; domainVerification?: { domain?: string } | null },
    host: string,
): boolean => hostWearingOf(community, host) !== null;
export type CradleRank = 0 | 1 | 2;
export const cradleRankOf = (facts: CradleFacts, host: string): CradleRank => {
    const wearing = hostWearingOf(facts, host);
    return wearing === "domain" ? 0 : wearing === "alias" ? 1 : 2;
};
export const chooseCradle = <T>(
    candidates: readonly T[],
    host: string,
    facts: (candidate: T) => CradleFacts,
    options: { claimsAnswer?: boolean } = {},
): T | null => {
    let best: { candidate: T; rank: CradleRank; createdAtMs: number } | null = null;
    for (const candidate of candidates) {
        const f = facts(candidate);
        const rank = cradleRankOf(f, host);
        if (rank === 2 && options.claimsAnswer === false) continue;
        if (!best || rank < best.rank || (rank === best.rank && f.createdAtMs < best.createdAtMs)) {
            best = { candidate, rank, createdAtMs: f.createdAtMs };
        }
    }
    return best?.candidate ?? null;
};
