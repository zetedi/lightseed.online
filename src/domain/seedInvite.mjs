export function seedInviteCommand(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const fields = value.action === 'mint' ? ['action', 'communityId', 'label', 'expiresAt']
    : ['accept', 'revoke'].includes(value.action) ? ['action', 'id'] : null;
  if (!fields || Object.keys(value).some(k => !fields.includes(k))) return null;
  const id = value.action === 'mint' ? value.communityId : value.id;
  if (typeof id !== 'string' || !id || id.length > 128 || /[\u0000-\u0020\u007f]/.test(id)) return null;
  if (value.label !== undefined && (typeof value.label !== 'string' || value.label.length > 120 || /[\u0000-\u001f\u007f]/.test(value.label))) return null;
  if (value.expiresAt !== undefined && value.expiresAt !== null
    && (typeof value.expiresAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.expiresAt)
      || !Number.isFinite(Date.parse(value.expiresAt)) || new Date(value.expiresAt).toISOString() !== value.expiresAt)) return null;
  return { ...value };
}
