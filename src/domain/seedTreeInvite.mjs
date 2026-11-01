// An invitation names a proposed role, never supplies the inviter's authority.
const identifier=value=>typeof value==='string' && value.length>0 && value.length<=128 && !/[\u0000-\u0020\u007f]/.test(value);
export function seedTreeInviteCommand(value) {
  if(!value || typeof value!=='object' || Array.isArray(value))return null;
  const mint=value.action==='mint';
  const fields=mint ? ['action','treeId','member','open','role','message','expiresAt']
    : ['claim','accept','decline','revoke'].includes(value.action) ? ['action','id'] : null;
  if(!fields || Object.keys(value).some(k=>!fields.includes(k)) || !identifier(mint ? value.treeId : value.id))return null;
  if(mint) {
    if(!['keeper','steward','guardian','observer'].includes(value.role) || typeof value.open!=='boolean'
      || (value.open ? value.member!==undefined : !identifier(value.member)))return null;
    if(value.message!==undefined && (typeof value.message!=='string' || value.message.length>1000 || value.message.includes('\u0000')))return null;
    if(value.expiresAt!==undefined && value.expiresAt!==null && (typeof value.expiresAt!=='string'
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.expiresAt)
      || !Number.isFinite(Date.parse(value.expiresAt)) || new Date(value.expiresAt).toISOString()!==value.expiresAt))return null;
  }
  return {...value};
}
export function seedTreeInviteQuery(params) {
  if([...params.keys()].some(k=>!['id','tree','mine','after','limit'].includes(k) || params.getAll(k).length!==1)
    || ['id','tree','mine'].filter(k=>params.has(k)).length!==1
    || ['id','tree','after'].some(k=>params.has(k) && !identifier(params.get(k)))
    || (params.has('mine') && params.get('mine')!=='true')
    || (params.has('id') && params.size!==1)
    || (params.has('limit') && !/^(?:[1-9]|[1-9][0-9]|100)$/.test(params.get('limit'))))return null;
  return {kind:'treeInvites',id:params.get('id'),tree:params.get('tree'),mine:params.has('mine'),after:params.get('after'),limit:Number(params.get('limit')??50)};
}
