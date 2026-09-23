// THE COMPOSITION ROOT (ring 2026-09-16). Firebase discovers functions by the exports of this
// file, so every name here is a deployed function's identity: the modules own the bodies, this
// file only re-exports them. ./core runs first: it initialises the admin app.
import "./core";
export { rotateSigningKey, beginSigningKeyRecovery, witnessSigningKeyRecovery, activateSigningKeyRecovery } from "./keys";
export { generateAIContent, saveProviderCredential, generateClaudeContent } from "./ai";
export { sendSystemEmail, onReachCreated } from "./mail";
export { onLifetreeCreated, onBedHomeMoved, onStayWritten, mintStayLeaves } from "./lifetrees";
export { witnessWatering, checkWateringSchedules, resetLight } from "./light";
export { onJoinRequestCreated, onNetworkInviteAccepted, acceptTreeInvite, acceptKeeperInvite, acceptKeeperRequest, resignKeeper, formCommunityFromCircle, requestInvite } from "./invites";
export { startDomainVerification, checkDomainVerification, startDoorClaim, checkDoorClaim, grantDoor, withdrawDoor, listDoorClaims } from "./domains";
export { sendNewsletterEmails, unsubscribe } from "./letters";
export { listUsersAsAdmin, deleteUserAsAdmin, deleteMyAccount, mintSsoToken } from "./accounts";
export { beingPreview, facePreview, sitemap, faceEvents } from "./preview";
export { deriveImageVariants, releasePicture } from "./pictures";
export { acceptOffering } from "./offeringCalls";
export { mintBlock, unmintBlock, acceptAlignment } from "./blocks";
export { indexPersonLid, indexTreeLid, indexVisionLid, indexLightHouseLid, indexCommunityLid, indexPulseLid, backfillLidIndex } from "./lidIndex";
