// THE ORGANS' COMMANDS (ring 2026-11-02): the shapes a hand may ask of the light mint, the staff
// roster, its own account and the domain proofs. Claims only — identity, standing, the day and the
// amounts are the node's to derive and judge (seed/api/organs.mjs over seed/schema/054).
const identifier = (value, max = 512) => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);

// /v1/light/command — witness a watering, appreciate a received offering, carry out a purchase, reset.
export function seedLightCommand(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  switch (value.action) {
    case 'witness': return Object.keys(value).every(k => ['action', 'pulseId'].includes(k)) && identifier(value.pulseId) ? { action: 'witness', pulseId: value.pulseId } : null;
    case 'appreciate': return Object.keys(value).every(k => ['action', 'offeringId', 'units'].includes(k)) && identifier(value.offeringId)
      && typeof value.units === 'number' && Number.isFinite(value.units) ? { action: 'appreciate', offeringId: value.offeringId, units: value.units } : null;
    case 'spend': return Object.keys(value).every(k => ['action', 'decisionId'].includes(k)) && identifier(value.decisionId) ? { action: 'spend', decisionId: value.decisionId } : null;
    case 'reset': return Object.keys(value).length === 1 ? { action: 'reset' } : null;
    default: return null;
  }
}
// /v1/staff/command — the superadmin grants or revokes a staff hand.
export function seedStaffCommand(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !['grant_admin', 'revoke_admin'].includes(value.action)
    || Object.keys(value).some(k => !['action', 'uid'].includes(k)) || !identifier(value.uid, 128)) return null;
  return { action: value.action, uid: value.uid };
}
// /v1/account/command — a being erases itself (naming an heir for its light), or staff erase one.
export function seedAccountCommand(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (value.action === 'delete_mine') {
    if (Object.keys(value).some(k => !['action', 'heirUid'].includes(k)) || (value.heirUid !== undefined && value.heirUid !== null && value.heirUid !== '' && !identifier(value.heirUid, 128))) return null;
    return { action: 'delete_mine', ...(value.heirUid ? { heirUid: value.heirUid } : {}) };
  }
  if (value.action === 'delete_as_staff') {
    if (Object.keys(value).some(k => !['action', 'uid'].includes(k)) || !identifier(value.uid, 128)) return null;
    return { action: 'delete_as_staff', uid: value.uid };
  }
  return null;
}
// /v1/domains/command — the anchor's DNS proof and the doors of a place.
export function seedDomainCommand(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !identifier(value.communityId, 128)) return null;
  const withDoor = ['start_door', 'check_door', 'grant_door', 'withdraw_door'].includes(value.action);
  if (['start_verification', 'check_verification', 'list_doors'].includes(value.action)) {
    return Object.keys(value).every(k => ['action', 'communityId'].includes(k)) ? { action: value.action, communityId: value.communityId } : null;
  }
  if (!withDoor || Object.keys(value).some(k => !['action', 'communityId', 'door'].includes(k)) || !identifier(value.door, 253)) return null;
  return { action: value.action, communityId: value.communityId, door: value.door };
}
// /v1/mail/command — THE MAIL ORGAN (ring 2026-11-03): a system letter (the node composes it), the
// letter of a place, and a look at one's own letter's delivery. Addresses and words are claims the
// organ cleans and bounds (domain/mailLetter systemMailOf); the sender, the voice and the quota are the node's.
const MAIL_KEYS = { send_system: ['action', 'to', 'subject', 'text', 'ctaUrl', 'ctaLabel', 'domain'], send_newsletter: ['action', 'communityId', 'subject', 'html'], status: ['action', 'id'] };
export function seedMailCommand(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.hasOwn(MAIL_KEYS, value.action)
    || Object.keys(value).some(k => !MAIL_KEYS[value.action].includes(k))) return null;
  const optional = (v, max) => v === undefined || v === null || (typeof v === 'string' && v.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v));
  if (value.action === 'send_system') {
    const to = Array.isArray(value.to) ? value.to : [value.to];
    if (to.length === 0 || to.length > 5 || !to.every(t => identifier(t, 254)) || !optional(value.subject, 200) || !optional(value.text, 4000)
      || !optional(value.ctaUrl, 500) || !optional(value.ctaLabel, 80) || !optional(value.domain, 253)) return null;
    return { action: 'send_system', to, ...(value.subject ? { subject: value.subject } : {}), ...(value.text ? { text: value.text } : {}),
      ...(value.ctaUrl ? { ctaUrl: value.ctaUrl } : {}), ...(value.ctaLabel ? { ctaLabel: value.ctaLabel } : {}), ...(value.domain ? { domain: value.domain } : {}) };
  }
  if (value.action === 'send_newsletter') {
    if (!identifier(value.communityId, 128) || typeof value.subject !== 'string' || !value.subject.trim() || value.subject.length > 200
      || typeof value.html !== 'string' || !value.html.trim() || value.html.length > 400000) return null;
    return { action: 'send_newsletter', communityId: value.communityId, subject: value.subject.trim(), html: value.html.trim() };
  }
  return identifier(value.id, 128) ? { action: 'status', id: value.id } : null;
}
// POST /v1/invite-requests — a stranger asks for an invitation (functions requestInvite): an address and a reason.
export function seedInviteRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !['email', 'reason'].includes(k))
    || typeof value.email !== 'string' || value.email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.email.trim().toLowerCase())
    || (value.reason !== undefined && (typeof value.reason !== 'string' || value.reason.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value.reason)))) return null;
  return { email: value.email.trim().toLowerCase(), reason: (value.reason ?? '').trim() };
}
