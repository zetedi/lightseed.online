import { linkId, type Link, type LinkRel } from './link';
const relations: readonly LinkRel[] = ['guardian','keeper','steward','observer','member','joined','participant','join_request','rooted','shelters',
  'invited_by','welcomed_by','party','keeper_request','grows_in','collaborates_with','recognises','shares_resources_with','accepts_coin_of','descends_from'];
const identifier=(value:unknown):value is string=>typeof value==='string' && value.length>0 && value.length<=2048 && !/[\u0000-\u001f\u007f]/.test(value);

// HTTP timestamps become the backend-neutral Stamp expected by existing graph consumers.
export function seedGraphPage(value:unknown):{links:Link[];next:string|null} {
  if(!value || typeof value!=='object')throw new Error('invalid_graph_page');
  const page=value as Record<string,unknown>;
  if(!Array.isArray(page.links) || page.links.length>100 || (page.next!==null && !identifier(page.next)))throw new Error('invalid_graph_page');
  const links=page.links.map(raw=>{
    if(!raw || typeof raw!=='object')throw new Error('invalid_graph_link');
    const row=raw as Record<string,unknown>;
    if(!identifier(row.from) || !identifier(row.to) || !relations.includes(row.rel as LinkRel)
      || row.id!==linkId(row.from,row.rel as LinkRel,row.to) || typeof row.createdAt!=='string'
      || !Number.isFinite(Date.parse(row.createdAt)))throw new Error('invalid_graph_link');
    const ms=Date.parse(row.createdAt);
    return {...row,type:'link',createdAt:{toMillis:()=>ms,toDate:()=>new Date(ms)}} as Link;
  });
  return {links,next:page.next as string|null};
}
