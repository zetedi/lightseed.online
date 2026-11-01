import { normalizePersonName, personNameProblem } from './personName.mjs';
import { seedMediaUploadPath } from './seedMedia.mjs';
export function seedProfileInput(value) {
  if(value && typeof value==='object' && !Array.isArray(value) && value.action==='set_picture') {
    if(Object.keys(value).some(key=>!['action','slot','path'].includes(key))
      || !['siteLogoUrl','siteHeroUrl'].includes(value.slot)
      || (value.path!==null && !seedMediaUploadPath(value.path)))return null;
    return {action:'set_picture',slot:value.slot,path:value.path};
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== 1 || typeof value.displayName !== 'string'
    || personNameProblem(value.displayName)) return null;
  return { displayName: normalizePersonName(value.displayName) };
}

export function seedPeopleQuery(params) {
  const id=value=>typeof value==='string' && value.length>0 && value.length<=128 && !/[\u0000-\u0020\u007f]/.test(value);
  if([...params.keys()].some(k=>!['id','q','after','limit'].includes(k) || params.getAll(k).length!==1)
    || (params.has('id') && (params.size!==1 || !id(params.get('id'))))
    || (params.has('after') && !id(params.get('after')))
    || (params.has('q') && (!params.get('q').trim() || params.get('q').length>60 || /[\u0000-\u001f\u007f]/.test(params.get('q'))))
    || (params.has('limit') && !/^(?:[1-9]|[1-9][0-9]|100)$/.test(params.get('limit'))))return null;
  return {kind:'people',id:params.get('id'),query:params.get('q'),after:params.get('after'),limit:Number(params.get('limit')??50)};
}
