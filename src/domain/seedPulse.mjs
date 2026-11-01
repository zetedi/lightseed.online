const identifier=value=>typeof value==='string' && value.length>0 && value.length<=512 && !/[\u0000-\u001f\u007f]/.test(value);
export function seedPulseQuery(params) {
  const filters=['id','tree','vision','community','author','recipient','participant','type','domain'];
  if([...params.keys()].some(key=>![...filters,'after','limit'].includes(key) || params.getAll(key).length!==1)
    || filters.some(key=>params.has(key) && !identifier(params.get(key)))
    || (params.has('id') && params.size!==1)
    || (params.has('limit') && !/^(?:[1-9]|[1-9][0-9]|100)$/.test(params.get('limit'))))return null;
  let after=null;
  if(params.has('after')) {
    if(params.get('after').length>1024)return null;
    try {
      const cursor=JSON.parse(params.get('after'));
      if(!Array.isArray(cursor) || cursor.length!==2 || !identifier(cursor[1]) || typeof cursor[0]!=='string'
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(cursor[0]) || Number(cursor[0].slice(0,4))<1
        || !Number.isFinite(Date.parse(cursor[0])) || new Date(cursor[0]).toISOString()!==cursor[0].slice(0,23)+'Z')return null;
      after={moment:cursor[0],id:cursor[1]};
    }catch{return null;}
  }
  return {kind:'pulses',...Object.fromEntries(filters.map(key=>[key,params.get(key)])),after,limit:Number(params.get('limit')??50)};
}
