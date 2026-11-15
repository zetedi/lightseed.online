// THE ONE LAW (2026-11-14). THE OFFERING's law (the answer's judgment, the twins' source) is src/domain/offering's.
// The functions build compiles the shared domain itself (tsconfig rootDir '..'): the server judges by the
// very source the shell and the independent node judge by. Add law to src/domain, never here.
import { offeringTwinRecords, type OfferingTwinSource as TwinSource } from '../../src/domain/offeringTwins';
export { type OfferedToKind, type OfferingStatus, OFFERING_STATUSES, isOfferingStatus, isOfferedToKind, type OfferingAcceptFacts, type OfferingAcceptJudgment, judgeOfferingAccept } from '../../src/domain/offering';

// What the two chains record on acceptance. The SHAPE of the twins is the law's
// (domain/offeringTwins: each names the other and the offering, so either chain alone proves the
// agreement); the PROSE is this server's — the three names it needs ride on the source.
export interface OfferingTwinSource extends TwinSource { title: string; toName: string; fromTreeName: string }

export const offeringTwinBlocks = (o: OfferingTwinSource, acceptor: { uid: string; name: string }) => {
    const { title, toName, fromTreeName, ...source } = o;
    return offeringTwinRecords(source, acceptor, {
        title: 'Offering accepted',
        fromBody: `${title} — offered to ${toName}, accepted.`,
        toBody: `${title} — offered by ${fromTreeName}, accepted.`,
    });
};
