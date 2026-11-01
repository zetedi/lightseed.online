import {seedMediaUploadPath} from './seedMedia.mjs';
const identifier=value=>typeof value==='string' && value.length>0 && value.length<=512 && !/[\u0000-\u001f\u007f]/.test(value);
export function seedVisionQuery(params) {
  if([...params.keys()].some(k=>!['id','domain','author','tree','joined','after','limit'].includes(k) || params.getAll(k).length!==1)
    || ['id','domain','author','tree','joined'].some(k=>params.has(k) && !identifier(params.get(k)))
    || (params.has('id') && params.size!==1)
    || (params.has('limit') && !/^(?:[1-9]|[1-9][0-9]|100)$/.test(params.get('limit'))))return null;
  let after=null;
  if(params.has('after')) {
    if(params.get('after').length>1024)return null;
    try {
      const cursor=JSON.parse(params.get('after'));
      if(!Array.isArray(cursor) || cursor.length!==2 || typeof cursor[0]!=='string' || !identifier(cursor[1])
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(cursor[0])
        || Number(cursor[0].slice(0,4))<1
        || !Number.isFinite(Date.parse(cursor[0])) || new Date(cursor[0]).toISOString()!==cursor[0].slice(0,23)+'Z')return null;
      after={moment:cursor[0],id:cursor[1]};
    }catch{return null;}
  }
  return {kind:'visions',id:params.get('id'),domain:params.get('domain'),author:params.get('author'),tree:params.get('tree'),joined:params.get('joined'),after,limit:Number(params.get('limit')??50)};
}

// Editable prose only. Identity, grounding and chain heads are server-owned.
export function seedVisionCommand(value) {
  if(value && typeof value==='object' && !Array.isArray(value) && value.action==='release') {
    return identifier(value.id) && Object.keys(value).every(key=>['action','id'].includes(key)) ? {action:'release',id:value.id}:null;
  }
  if(value && typeof value==='object' && !Array.isArray(value) && value.action==='set_pictures') {
    if(!identifier(value.id) || Object.keys(value).some(key=>!['action','id','paths'].includes(key))
      || !Array.isArray(value.paths) || value.paths.length>100 || value.paths.some(path=>!seedMediaUploadPath(path))
      || new Set(value.paths).size!==value.paths.length)return null;
    return {action:'set_pictures',id:value.id,paths:[...value.paths]};
  }
  if(!value || typeof value!=='object' || Array.isArray(value)
    || !['create','edit'].includes(value.action)
    || Object.keys(value).some(key=>!['action','id','title','body','visibility'].includes(key))
    || typeof value.title!=='string' || value.title.length>240 || !value.title.trim() || /[\u0000-\u001f\u007f]/.test(value.title)
    || typeof value.body!=='string' || value.body.length>64000 || value.body.includes('\u0000')
    || !['public','node','private'].includes(value.visibility)
    || (value.action==='create' ? 'id' in value : !identifier(value.id)))return null;
  return {...value};
}
