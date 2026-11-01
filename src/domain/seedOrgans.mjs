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
