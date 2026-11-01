import {useEffect,useState} from 'react';
import {createIndependentGraphReads} from '../../src/adapters/independent';
import {seedPublicRead} from '../../src/services/independent/public';
import type {createSeedSession} from '../../src/services/independent/session';
type Community={id:string;name:string;door?:string};
export function TreeGardens({session,uid,treeId,onChanged}:{session:ReturnType<typeof createSeedSession>;uid:string;treeId:string;onChanged:()=>void}) {
  const [communities,setCommunities]=useState<Community[]>([]),[standing,setStanding]=useState<string[]>([]),[target,setTarget]=useState('');
  const [busy,setBusy]=useState(true),[error,setError]=useState(false);
  useEffect(()=>{
    let active=true;
    void (async()=>{
      const links=await createIndependentGraphReads(session).linksFrom(treeId,'grows_in');
      const items:Community[]=[],seen=new Set<string>();let after:string|null=null;
      do {
        const page=await seedPublicRead('/v1/communities?limit=100'+(after?'&after='+encodeURIComponent(after):'')) as {communities:Community[];next:string|null};
        if(!active)return;items.push(...page.communities);after=page.next;
        if(after){if(seen.has(after))throw new Error('invalid_cursor');seen.add(after);}
      }while(after);
      if(active){setCommunities(items);setStanding(links.map(link=>link.to));}
    })().catch(()=>{if(active)setError(true);}).finally(()=>{if(active)setBusy(false);});
    return ()=>{active=false;};
  },[session,treeId]);
  const change=(to:string,remove:boolean)=>{
    const identity=session.snapshot();if(identity.status!=='authenticated' || identity.uid!==uid)return;
    setBusy(true);setError(false);
    void session.linkCommand({action:remove?'unlink':'link',from:treeId,rel:'grows_in',to})
      .then(onChanged).catch(()=>setError(true)).finally(()=>setBusy(false));
  };
  return <section><h4>Community gardens</h4><p>Joining a garden keeps this tree's home and privacy unchanged.</p>
    <ul>{communities.filter(item=>standing.includes(item.id)).map(item=><li key={item.id}>{item.name}
      <button disabled={busy} onClick={()=>change(item.id,true)}>Withdraw tree</button></li>)}</ul>
    <form onSubmit={event=>{event.preventDefault();if(target)change(target,false);}}>
      <label>Garden<select required disabled={busy} value={target} onChange={event=>setTarget(event.target.value)}>
        <option value="">Choose a community</option>{communities.filter(item=>!standing.includes(item.id)).map(item=>
          <option key={item.id} value={item.id}>{item.name}{item.door==='open'?'':' · welcome required'}</option>)}
      </select></label><button disabled={busy || !target}>Place tree in garden</button>
    </form>
    {error && <p role="alert">Could not place or withdraw the tree. A closed garden needs its door-keeper's welcome.</p>}
  </section>;
}
