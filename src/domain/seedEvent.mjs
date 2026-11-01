// Requests describe an action; server-held facts supply identity, authority,
// lineage and circle membership. Callers cannot submit raw stored records.
export function seedEventCommand(value) {
  if(value?.action==='form_circle')return seedEventCircleCommand(value);
  if(value?.action==='create'||value?.action==='edit')return seedEventDraft(value);
  if(!value||typeof value!=='object'||Array.isArray(value)||value.action!=='duplicate'
    ||Object.keys(value).some(key=>!['action','id'].includes(key))||typeof value.id!=='string'
    ||value.id.length<1||value.id.length>512||/[\u0000-\u001f\u007f]/.test(value.id))return null;
  return {action:'duplicate',id:value.id};
}

// Omitted pictures on edit preserve imported references.
const identifier=value=>typeof value==='string'&&value.length>0&&value.length<=512&&!/[\u0000-\u001f\u007f]/.test(value);
export function seedEventDraft(value) {
  if(!value||typeof value!=='object'||Array.isArray(value)||!['create','edit'].includes(value.action))return null;
  const fields=['action','title','body','eventDate','eventEndDate','eventLocation','eventMaxParticipants','webLinks','visibility','communityId','paths',...(value.action==='edit'?['id']:[])];
  if(Object.keys(value).some(key=>!fields.includes(key))||(value.action==='edit'&&!identifier(value.id))
    ||typeof value.title!=='string'||!value.title.trim()||value.title.length>240||/[\u0000-\u001f\u007f]/.test(value.title)
    ||typeof value.body!=='string'||value.body.length>64000||value.body.includes('\u0000')
    ||!['public','node','community','private'].includes(value.visibility??'public')
    ||['eventDate','eventEndDate'].some(key=>value[key]!==undefined&&(typeof value[key]!=='string'||value[key].length>64||/[\u0000-\u001f\u007f]/.test(value[key])))
    ||(value.eventLocation!==undefined&&(typeof value.eventLocation!=='string'||value.eventLocation.length>2000||value.eventLocation.includes('\u0000')))
    ||(value.eventMaxParticipants!==undefined&&value.eventMaxParticipants!==null&&(!Number.isSafeInteger(value.eventMaxParticipants)||value.eventMaxParticipants<1))
    ||(value.communityId!==undefined&&!identifier(value.communityId))
    ||(value.paths!==undefined&&(!Array.isArray(value.paths)||value.paths.length>100||value.paths.some(path=>!identifier(path))||new Set(value.paths).size!==value.paths.length))
    ||(value.webLinks!==undefined&&(!Array.isArray(value.webLinks)||value.webLinks.length>12||value.webLinks.some(row=>
      !row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(key=>!['url','label'].includes(key))
      ||typeof row.url!=='string'||row.url.length>4096||(row.label!==undefined&&(typeof row.label!=='string'||row.label.length>80))))))return null;
  return {...value,title:value.title.trim(),body:value.body.trim(),eventDate:value.eventDate?.trim()??'',eventEndDate:value.eventEndDate?.trim()??'',
    eventLocation:value.eventLocation?.trim()??'',eventMaxParticipants:value.eventMaxParticipants??null,visibility:value.visibility??'public',
    webLinks:(value.webLinks??[]).map(row=>({...row})),...(value.paths===undefined?(value.action==='create'?{paths:[]}:{}):{paths:[...value.paths]})};
}

// A formation request names the event; membership is derived under database locks.
export function seedEventCircleCommand(value) {
  if(!value||typeof value!=='object'||Array.isArray(value)||value.action!=='form_circle'||!identifier(value.id)
    ||Object.keys(value).some(key=>!['action','id','name'].includes(key))
    ||(value.name!==undefined&&(typeof value.name!=='string'||value.name.length>120||/[\u0000-\u001f\u007f]/.test(value.name))))return null;
  return {action:'form_circle',id:value.id,name:value.name?.trim()??''};
}
