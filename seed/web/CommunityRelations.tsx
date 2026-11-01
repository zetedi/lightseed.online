import {useEffect,useState} from 'react';
import {createIndependentGraphReads} from '../../src/adapters/independent';
import {INTERBEING_RELATIONS,interbeingRelationState,interbeingRelationKey,type InterbeingRelation} from '../../src/domain/interbeingMatrix';
import type {Link} from '../../src/domain/link';
import type {createSeedSession} from '../../src/services/independent/session';
import {seedPublicRead} from '../../src/services/independent/public';
import en from '../../src/utils/dictionaries/en';
type Community={id:string;name:string};
export function CommunityRelations({session,community,editable,uid,onChanged}:{session:ReturnType<typeof createSeedSession>;
  community:Community;editable:boolean;uid:string|null;onChanged:()=>void}) {
  const [others,setOthers]=useState<Community[]>([]),[links,setLinks]=useState<Link[]>([]);
  const [target,setTarget]=useState(''),[relation,setRelation]=useState<InterbeingRelation>('collaborates_with');
  const [busy,setBusy]=useState(true),[error,setError]=useState(false);
  useEffect(()=>{
    let active=true;
    void (async()=>{
      const graph=createIndependentGraphReads(session);
      const [outgoing,incoming]=await Promise.all([graph.linksFrom(community.id),graph.linksTo(community.id)]);
      const communities:Community[]=[],seen=new Set<string>();let after:string|null=null;
      do {
        const page=await seedPublicRead('/v1/communities?limit=100'+(after?'&after='+encodeURIComponent(after):'')) as {communities:Community[];next:string|null};
        if(!active)return;communities.push(...page.communities);after=page.next;
        if(after){if(seen.has(after))throw new Error('invalid_cursor');seen.add(after);}
      }while(after);
      if(active){setOthers(communities.filter(item=>item.id!==community.id));setLinks([...outgoing,...incoming]);}
    })().catch(()=>{if(active)setError(true);}).finally(()=>{if(active)setBusy(false);});
    return ()=>{active=false;};
  },[session,community.id]);
  const change=(to:string,rel:InterbeingRelation,remove:boolean)=>{
    const identity=session.snapshot();if(identity.status!=='authenticated' || identity.uid!==uid)return;
    setBusy(true);setError(false);
    void session.linkCommand({action:remove?'unlink':'link',from:community.id,rel,to})
      .then(onChanged).catch(()=>setError(true)).finally(()=>setBusy(false));
  };
  const stateLabel={proposed:en.interbeing_state_proposed,received:en.interbeing_state_received,reciprocal:en.interbeing_state_reciprocal};
  return <section><h4>Community relationships</h4>
    <ul>{others.flatMap(other=>INTERBEING_RELATIONS.map(rel=>{
      const state=interbeingRelationState(community.id,other.id,rel,links);
      return state==='none'?null:<li key={other.id+rel}>{other.name}: {en[interbeingRelationKey(rel)]} · {stateLabel[state]}
        {editable && state!=='received' && <button disabled={busy} onClick={()=>change(other.id,rel,true)}>Withdraw our statement</button>}
      </li>;
    }))}</ul>
    {editable && <form onSubmit={event=>{event.preventDefault();if(target)change(target,relation,false);}}>
      <label>Community<select required disabled={busy} value={target} onChange={event=>setTarget(event.target.value)}>
        <option value="">Choose a community</option>{others.map(other=><option key={other.id} value={other.id}>{other.name}</option>)}
      </select></label>
      <label>Relationship<select disabled={busy} value={relation} onChange={event=>setRelation(event.target.value as InterbeingRelation)}>
        {INTERBEING_RELATIONS.map(rel=><option key={rel} value={rel}>{en[interbeingRelationKey(rel)]}</option>)}
      </select></label><button disabled={busy || !target}>Add our statement</button>
    </form>}
    {error && <p role="alert">Could not load or save community relationships. Please try again.</p>}
  </section>;
}
