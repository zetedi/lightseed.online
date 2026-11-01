import {useEffect,useState} from 'react';
import {createIndependentGraphReads} from '../../src/adapters/independent';
import type {createSeedSession} from '../../src/services/independent/session';
import type {LinkRel} from '../../src/domain/link';
export function TreeCare({session,uid,tree,onChanged}:{session:ReturnType<typeof createSeedSession>;uid:string;
  tree:{id:string;treeType:string;visibility?:string};onChanged:()=>void}) {
  const [roles,setRoles]=useState<LinkRel[]>([]),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(false);
  useEffect(()=>{
    let active=true;
    void createIndependentGraphReads(session).linksFrom(uid).then(links=>{
      if(active){setRoles(links.filter(link=>link.to===tree.id).map(link=>link.rel));setReady(true);}
    }).catch(()=>{if(active)setError(true);});
    return ()=>{active=false;};
  },[session,uid,tree.id]);
  const change=(rel:LinkRel,remove:boolean)=>{
    const identity=session.snapshot();if(identity.status!=='authenticated' || identity.uid!==uid)return;
    setBusy(true);setError(false);
    void session.linkCommand({action:remove?'unlink':'link',from:uid,rel,to:tree.id})
      .then(()=>{setRoles(old=>remove?old.filter(item=>item!==rel):[...old,rel]);onChanged();})
      .catch(()=>setError(true)).finally(()=>setBusy(false));
  };
  const following=roles.includes('guardian');
  return <section aria-label="Your tree circle">
    {ready && (following || (tree.treeType!=='SECRET' && tree.visibility!=='private')) &&
      <button disabled={busy} onClick={()=>change('guardian',following)}>{following?'Stop following this tree':'Follow this tree'}</button>}
    {ready && (['observer','steward'] as const).filter(role=>roles.includes(role)).map(role=>
      <button key={role} disabled={busy} onClick={()=>change(role,true)}>Leave {role} role</button>)}
    {error && <p role="alert">Could not update your place in this circle. Please try again.</p>}
  </section>;
}
