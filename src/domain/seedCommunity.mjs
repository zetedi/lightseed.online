// Commands are claims, never authority. The database derives the actor from the
// verified session and rechecks doors/keeper seats in the write transaction.
const identifier = value => typeof value === 'string' && value.length > 0 && value.length <= 128
  && !/[\u0000-\u0020\u007f]/.test(value);
const nameOf = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
export function seedNodeDomain(origin) {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password) return null;
    return url.hostname.toLowerCase().replace(/^www\./, '');
  } catch { return null; }
}
export function seedCommunityCommand(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { action } = value;
  if(action==='form_circle') {
    if(!identifier(value.id) || Object.keys(value).some(k=>!['action','id','name'].includes(k))
      || (value.name!==undefined && (typeof value.name!=='string' || value.name.length>120 || /[\u0000-\u001f\u007f]/.test(value.name))))return null;
    return {...value,...(value.name!==undefined ? {name:nameOf(value.name)} : {})};
  }
  const fields = action === 'create' ? ['action', 'name', 'domain', 'door']
    : action === 'edit' ? ['action', 'id', 'name', 'domain', 'door']
    : ['accept', 'decline', 'remove', 'grant_steward', 'revoke_steward', 'accept_keeper_request', 'decline_keeper_request', 'offer_keeper'].includes(action) ? ['action', 'id', 'member']
    : ['accept_keeper_offer','decline_keeper_offer'].includes(action) ? ['action','id','inviteId']
    : ['join', 'request', 'leave', 'cancel', 'resign_keeper', 'request_keeper', 'cancel_keeper_request'].includes(action) ? ['action', 'id'] : null;
  if (!fields || Object.keys(value).some(k => !fields.includes(k))) return null;
  if (action !== 'create' && !identifier(value.id)) return null;
  if (['accept', 'decline', 'remove', 'grant_steward', 'revoke_steward', 'accept_keeper_request', 'decline_keeper_request', 'offer_keeper'].includes(action) && !identifier(value.member)) return null;
  if (['accept_keeper_offer','decline_keeper_offer'].includes(action) && !identifier(value.inviteId)) return null;
  if (action === 'create' || action === 'edit') {
    const name = nameOf(value.name);
    if (!name || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name)
      || typeof value.domain !== 'string' || value.domain.length > 253
      || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value.domain)
      || !['open', 'invite', 'closed'].includes(value.door)) return null;
    return { ...value, name };
  }
  return { ...value };
}

export function seedKeeperInviteQuery(params) {
  const valid = value => typeof value==='string' && value.length>0 && value.length<=128 && !/[\u0000-\u0020\u007f]/.test(value);
  if ([...params.keys()].some(k=>!['community','mine','after','limit'].includes(k) || params.getAll(k).length!==1)
    || params.has('community')===params.has('mine') || (params.has('community') && !valid(params.get('community')))
    || (params.has('mine') && params.get('mine')!=='true') || (params.has('after') && !valid(params.get('after')))
    || (params.has('limit') && !/^(?:[1-9]|[1-9][0-9]|100)$/.test(params.get('limit')))) return null;
  return {kind:'keeperInvites',community:params.get('community'),mine:params.has('mine'),after:params.get('after'),limit:Number(params.get('limit')??50)};
}
