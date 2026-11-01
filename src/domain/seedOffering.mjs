// Draft fields only. Identity, standing, names, answer and seals come from the node.
const id=value=>typeof value==='string' && value.length>0 && value.length<=512 && !/[\u0000-\u001f\u007f]/.test(value);
export function seedOfferingCreation(value) {
  if(!value || typeof value!=='object' || Array.isArray(value))return null;
  if(value.action==='create') {
    const fields=['action','kind','title','body','appreciation','url','bedId','toKind','toId','fromTreeId','visibility','paths'];
    if(Object.keys(value).some(key=>!fields.includes(key)) || !['bed','service','code','product'].includes(value.kind)
      || typeof value.title!=='string' || !value.title.trim() || value.title.length>240 || /[\u0000-\u001f\u007f]/.test(value.title)
      || typeof value.body!=='string' || value.body.length>64000
      || !Number.isSafeInteger(value.appreciation) || value.appreciation<1
      || !['public','node','private'].includes(value.visibility??'public')
      || (value.url!==undefined && (typeof value.url!=='string' || value.url.length>300 || (value.url.trim() && !/^https?:\/\/\S+$/i.test(value.url.trim()))))
      || (value.kind==='code' && !value.url?.trim())
      || ['bedId','toId','fromTreeId'].some(key=>value[key]!==undefined && !id(value[key]))
      || (value.bedId!==undefined && value.kind!=='bed')
      || (['toKind','toId','fromTreeId'].some(key=>value[key]!==undefined)
        && (!['tree','vision'].includes(value.toKind) || !id(value.toId) || !id(value.fromTreeId)))
      || (value.paths!==undefined && (!Array.isArray(value.paths) || value.paths.length>100
        || value.paths.some(path=>!id(path)) || new Set(value.paths).size!==value.paths.length)))return null;
    return {...value,title:value.title.trim(),body:value.body.trim(),url:value.url?.trim()??'',visibility:value.visibility??'public',paths:value.paths?[...value.paths]:[]};
  }
  return null;
}
export function seedOfferingCommand(value) {
  if(value?.action==='create')return seedOfferingCreation(value);
  if(!value || typeof value!=='object' || Array.isArray(value) || !id(value.id))return null;
  if(value.action==='edit') {
    const fields=['action','id','title','body','appreciation','url','visibility','paths'];
    if(Object.keys(value).some(key=>!fields.includes(key)))return null;
    const draft=seedOfferingCreation({action:'create',kind:'service',title:value.title,body:value.body,
      appreciation:value.appreciation,url:value.url,visibility:value.visibility,paths:value.paths});
    return draft?{action:'edit',id:value.id,title:draft.title,body:draft.body,appreciation:draft.appreciation,
      url:draft.url,visibility:draft.visibility,...(value.paths===undefined?{}:{paths:draft.paths})}:null;
  }
  if(value.action==='set_active')return typeof value.active==='boolean' && Object.keys(value).every(key=>['action','id','active'].includes(key))
    ?{action:'set_active',id:value.id,active:value.active}:null;
  if(Object.keys(value).some(key=>!['action','id'].includes(key)) || !['accept','withdraw','decline'].includes(value.action))return null;
  return {action:value.action,id:value.id};
}
