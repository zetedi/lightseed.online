import {seedPulseQuery} from './seedPulse.mjs';
const identifier=value=>typeof value==='string' && value.length>0 && value.length<=512 && !/[\u0000-\u001f\u007f]/.test(value);
// Target identity comes from the matched pulse, never a caller-supplied UID.
export function seedAlignmentCommand(value) {
  if(!value || typeof value!=='object' || Array.isArray(value))return null;
  if(value.action==='propose') {
    if(Object.keys(value).some(key=>!['action','fromTreeId','targetPulseId','initiatorPulseId'].includes(key))
      || !identifier(value.fromTreeId) || !identifier(value.targetPulseId)
      || (value.initiatorPulseId!==undefined && !identifier(value.initiatorPulseId)))return null;
    return {action:'propose',fromTreeId:value.fromTreeId,targetPulseId:value.targetPulseId,initiatorPulseId:value.initiatorPulseId??'PENDING_CREATION'};
  }
  if(!identifier(value.id))return null;
  if(value.action==='note') {
    if(Object.keys(value).some(key=>!['action','id','text'].includes(key)) || typeof value.text!=='string'
      || !value.text.trim() || value.text.trim().length>2000 || value.text.includes('\u0000'))return null;
    return {action:'note',id:value.id,text:value.text.trim()};
  }
  if(!['accept','reject'].includes(value.action)||Object.keys(value).some(key=>!['action','id'].includes(key)))return null;
  return {action:value.action,id:value.id};
}
export function seedAlignmentQuery(params) {
  const allowed=['id','tree','participant','target','status','after','limit'];
  if([...params.keys()].some(key=>!allowed.includes(key)||params.getAll(key).length!==1)
    || (params.has('id')&&params.size!==1)
    || ['participant','target'].some(key=>params.has(key)&&params.get(key)!=='me')
    || (params.has('status')&&!['PENDING','ACCEPTED','REJECTED'].includes(params.get('status'))))return null;
  const common=seedPulseQuery(new URLSearchParams([...params.entries()].filter(([key])=>['id','tree','after','limit'].includes(key))));
  return common?{kind:'alignments',id:common.id,tree:common.tree,after:common.after,limit:common.limit,
    participant:params.has('participant'),target:params.has('target'),status:params.get('status')}:null;
}
