import { seedMediaUploadPath } from './seedMedia.mjs';
// Tree filters never carry authority: RLS independently derives the reader.
export function seedTreeQuery(params) {
  const allowed = ['id','domain','anchor','kind','garden','participating','editable','after','limit'];
  const identifier = value => typeof value === 'string' && value.length > 0 && value.length <= 512 && !/[\u0000-\u001f\u007f]/.test(value);
  if ([...params.keys()].some(k => !allowed.includes(k) || params.getAll(k).length !== 1)
    || (params.has('id') && (params.size !== 1 || !identifier(params.get('id'))))
    || ['domain','anchor','garden','participating','after'].some(k => params.has(k) && !identifier(params.get(k)))
    || (params.has('editable') && params.get('editable')!=='true')
    || (params.has('kind') && !['LIFETREE','GUARDED','BED','SECRET'].includes(params.get('kind')))
    || (params.has('limit') && !/^(?:[1-9]|[1-9][0-9]|100)$/.test(params.get('limit')))) return null;
  return { kind: 'trees', id: params.get('id'), domain: params.get('domain'), anchor: params.get('anchor'),
    treeType: params.get('kind'), editable:params.has('editable'), garden:params.get('garden'), participating:params.get('participating'), after: params.get('after'), limit: Number(params.get('limit') ?? 50) };
}

export function seedTreeCommand(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if(['request_keeper','cancel_keeper_request','decline_keeper_request','answer_keeper_request'].includes(value.action)) {
    const other=['decline_keeper_request','answer_keeper_request'].includes(value.action);
    const fields=['action','id',...(other?['member']:[]),...(value.action==='answer_keeper_request'?['role']:[])];
    if(Object.keys(value).some(k=>!fields.includes(k)))return null;
    for(const key of ['id',...(other?['member']:[])])if(typeof value[key]!=='string' || !value[key] || value[key].length>128 || /[\u0000-\u0020\u007f]/.test(value[key]))return null;
    if(value.action==='answer_keeper_request' && !['keeper','steward','guardian','observer'].includes(value.role))return null;
    return {...value};
  }
  if (value.action==='set_pictures') {
    if (Object.keys(value).some(k=>!['action','id','paths'].includes(k)) || typeof value.id!=='string'
      || !value.id || value.id.length>512 || /[\u0000-\u0020\u007f]/.test(value.id)
      || !Array.isArray(value.paths) || value.paths.length>100 || value.paths.some(path=>!seedMediaUploadPath(path))
      || new Set(value.paths).size!==value.paths.length) return null;
    return {action:value.action,id:value.id,paths:[...value.paths]};
  }
  if (value.action==='resign_keeper') {
    if (Object.keys(value).some(k=>!['action','id'].includes(k)) || typeof value.id!=='string' || !value.id || value.id.length>512 || /[\u0000-\u0020\u007f]/.test(value.id)) return null;
    return {...value};
  }
  const create = value.action === 'plant', edit = value.action === 'edit';
  if (!create && !edit) return null;
  const fields = ['action','name','body','latitude','longitude','locationName', ...(create ? ['treeType','visibility'] : ['id'])];
  if (Object.keys(value).some(k => !fields.includes(k))) return null;
  const name = typeof value.name === 'string' ? value.name.replace(/\s+/g,' ').trim() : '';
  if (!name || name.length>120 || /[\u0000-\u001f\u007f]/.test(name)
    || typeof value.body !== 'string' || value.body.length>64000 || value.body.includes('\u0000')) return null;
  if (create && (!['LIFETREE','GUARDED','SECRET'].includes(value.treeType)
    || !['public','node','private'].includes(value.visibility)
    || (value.treeType==='SECRET' && value.visibility!=='private'))) return null;
  if (edit && (typeof value.id!=='string' || !value.id || value.id.length>512 || /[\u0000-\u0020\u007f]/.test(value.id))) return null;
  if ((value.latitude===undefined)!==(value.longitude===undefined)) return null;
  const clearPlace = edit && value.latitude===null && value.longitude===null;
  if (!clearPlace && value.latitude!==undefined && (typeof value.latitude!=='number' || !Number.isFinite(value.latitude) || Math.abs(value.latitude)>90
    || typeof value.longitude!=='number' || !Number.isFinite(value.longitude) || Math.abs(value.longitude)>180)) return null;
  if (value.locationName!==undefined && (typeof value.locationName!=='string' || value.locationName.length>240 || /[\u0000-\u001f\u007f]/.test(value.locationName))) return null;
  return { ...value,name };
}
