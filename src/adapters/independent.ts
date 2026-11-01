import type { Store } from '../domain/store';
import type { Link, LinkRel } from '../domain/link';
import { seedGraphPage } from '../domain/seedGraph';
import type { createSeedSession } from '../services/independent/session';
import { seedPublicRead } from '../services/independent/public';

type Session=Pick<ReturnType<typeof createSeedSession>,'read'|'snapshot'>;
export type IndependentGraphReads=Pick<Store,'linksTo'|'linksFrom'|'linksByRel'|'secretLinksTo'|'secretLinksFrom'>;
// Writes remain explicit server commands; this adapter does not pretend to implement them.
export function createIndependentGraphReads(session:Session,publicRead=seedPublicRead):IndependentGraphReads {
  async function all(path:string,filters:Record<string,string>,privateUid?:string):Promise<Link[]> {
    const identity=session.snapshot(),authenticated=identity.status==='authenticated';
    if(path!=='/v1/links' && !authenticated)throw new Error('authentication_required');
    if(privateUid!==undefined && (!authenticated || identity.uid!==privateUid))throw new Error('forbidden');
    const read=authenticated ? session.read : publicRead;
    const links:Link[]=[],seen=new Set<string>();let after:string|null=null;
    do {
      if(session.snapshot()!==identity)throw new Error('session_changed');
      const params=new URLSearchParams({...filters,limit:'100',...(after?{after}:{})});
      const page=seedGraphPage(await read(path+'?'+params));
      if(session.snapshot()!==identity)throw new Error('session_changed');
      links.push(...page.links);after=page.next;
      if(after){if(seen.has(after))throw new Error('invalid_graph_cursor');seen.add(after);}
    }while(after);
    return links;
  }
  const filter=(key:string,id:string,rel?:LinkRel)=>({[key]:id,...(rel?{rel}:{})});
  return {
    linksTo:(id,rel)=>all('/v1/links',filter('to',id,rel)),
    linksFrom:(id,rel)=>all('/v1/links',filter('from',id,rel)),
    linksByRel:rel=>all('/v1/links',{rel}),
    secretLinksTo:id=>all('/v1/secret-circle-links',{to:id}),
    secretLinksFrom:uid=>all('/v1/me/secret-links',{},uid),
  };
}
