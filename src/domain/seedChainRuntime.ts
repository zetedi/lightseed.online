// The independent runtime consumes this compiled entry from the same pure source
// as the browser. No Firebase mirror or browser service belongs in this boundary.
export {
  judgeBlockBirth,blockRecordOf,wateringResetOf,judgeBlockSignature,
  blockSignaturePayload,blockSignaturePreimage,isBlockSignatureClaim,
} from './chain/birth';
export {computeCanonicalHash,BLOCK_HASH_VERSION,blockContent} from './chain/verify';
export {touchMemoryOf} from './unmint';
export {publicNameOf} from './publicName';
export {judgeOfferingAccept,offeringProblem} from './offering';
export {createBlock} from './chain/hash';
export {offeringTwinRecords} from './offeringTwins';
export {beingPath} from './beingLink';
export {judgeAlignmentAcceptance,alignmentTwinContent} from './alignment';
export {eventDuplicationPayload} from './eventDuplication';
export {eventDraftContent} from './eventDraft';
export {judgeEventCircle,eventCircleDraft,eventCircleMemberUids} from './eventCircle';
export {rootsABeing} from './secretTree';
// THE ORGANS (ring 2026-11-02): the light mint, the spend, the unmint, the decision seal and the
// domain proofs, as the API's own law — the same source the browser and the functions mirror.
export {judgeWitness,kindleDayKeyFromMs,releaseRay,NODE_GLOW_HOME,prismSplit,DEFAULT_GLOW_SHARE_DENOMINATOR,RAY_UNITS} from './light';
export {judgeAppreciation,judgeSpend} from './spend';
export {unmintRefusal,STAFF_OVERRIDABLE_REFUSALS,touchRestoreOf} from './unmint';
export {decisionIdentity,decisionSignaturePayload,decisionEpochSignaturePayload,DECISION_DOMAIN,DECISION_EPOCH_DOMAIN} from './decision';
export {keyStandingAt,keyStandingCounts} from './keyEpoch';
export {signingPreimage} from './signing';
export {normalizeDoor,isDoorName,doorClaimRefusal,doorChallengeId} from './doors';
export {challengeRecordName,challengeRecordValue,txtProvesChallenge,challengeIsLive,DOMAIN_CHALLENGE_TTL_MS} from './domainVerification';
export {normalizeAnchorDomain} from './interbeingMatrix';
// THE CROSSING (ring 2026-11-02): the bundle law, the merge planner and the charter check, so the
// installation's export/import (seed/api/bundle.mjs) speaks the one law the browser and tests hold.
export {TRAVEL_PLAN,travelRuleFor,collectionSignature,buildCensus,manifestHashOf,verifyBundle,verifyBundleSeal,expectedBeingsIndex,localUidCensus,docContentHash,BUNDLE_SEAL_TAG,BUNDLE_FORMAT_VERSION} from './bundle';
export {planBundleMerge,mergeSnapshotDigest} from './bundleMerge';
export {independentCharterProblem} from './independentCharter';
// THE MAIL ORGAN (ring 2026-11-03): the voice, the letters, the audience and the sender's name, so the
// courier (seed/api/mail.mjs) writes the same letters the functions write for the origin node.
export {mailVoiceOf,dressMailText} from './mailVoice';
export {systemMailOf,systemLetterOf,reachRecipientsOf,reachThrottleIdOf,reachMayWrite,reachLetterOf,knockLetterOf,knockRecipientsOf,welcomeLetterOf,
  newsletterFooterOf,unsubscribeUrlOf,newsletterHeadersOf,mailSettlementOf,outboxIsStale,MAIL_DAILY_LIMIT,MAIL_MAX_ATTEMPTS} from './mailLetter';
export {audienceOf,newsletterSendRefusal,normalizePlaceDomain} from './newsletter';
export {notificationOf} from './push';
export {mailFromOf,charterOwnDomains,charterOrigin} from './charter';
