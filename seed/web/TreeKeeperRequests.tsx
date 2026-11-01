import {useEffect,useState} from 'react';
import {createIndependentGraphReads} from '../../src/adapters/independent';
import {seedPublicRead} from '../../src/services/independent/public';
import type {createSeedSession} from '../../src/services/independent/session';
export function TreeKeeperRequests({session,uid,tree,keeper,inviteMode,onChanged}:{session:ReturnType<typeof createSeedSession>;uid:string;
  tree:{id:string;treeType:string};keeper:boolean;inviteMode:'all'|'open'|null;onChanged:()=>void}) {
  const [requests,setRequests]=useState<{uid:string;name:string}[]>([]),[mine,setMine]=useState(false);
  const [role,setRole]=useState(tree.treeType==='SECRET'?'keeper':inviteMode==='all'?'steward':'guardian');
  const [busy,setBusy]=useState(true),[error,setError]=useState(false);
  useEffect(()=>{
    let active=true;
    void (async()=>{
      const graph=createIndependentGraphReads(session);
      const links=tree.treeType==='SECRET' ? (keeper || inviteMode==='all' ? await graph.secretLinksTo(tree.id):await graph.secretLinksFrom(uid))
        :await graph.linksTo(tree.id,'keeper_request');
      const pending=links.filter(link=>link.to===tree.id && link.rel==='keeper_request');
      const rows=inviteMode?await Promise.all(pending.map(async link=>{
        const result=await seedPublicRead('/v1/people?id='+encodeURIComponent(link.from)) as {person:{displayName?:string}|null};
        return {uid:link.from,name:result.person?.displayName || 'Unnamed person'};
      })):[];
      if(active){setMine(pending.some(link=>link.from===uid));setRequests(rows);}
    })().catch(()=>{if(active)setError(true);}).finally(()=>{if(active)setBusy(false);});
    return ()=>{active=false;};
  },[session,uid,tree.id,tree.treeType,keeper,inviteMode]);
  const act=(action:string,member?:string)=>{
    const identity=session.snapshot();if(identity.status!=='authenticated' || identity.uid!==uid)return;
    setBusy(true);setError(false);
    void session.treeCommand({action,id:tree.id,...(member?{member}:{}),...(action==='answer_keeper_request'?{role}:{})})
      .then(onChanged).catch(()=>setError(true)).finally(()=>setBusy(false));
  };
  const roles=tree.treeType==='SECRET'?['keeper']:inviteMode==='all'?['keeper','steward','guardian','observer']:['guardian','observer'];
  return <section><h4>Keepership requests</h4>
    {!keeper && <button disabled={busy} onClick={()=>act(mine?'cancel_keeper_request':'request_keeper')}>
      {mine?'Withdraw my request':'Ask to help keep this tree'}</button>}
    {inviteMode && <><label>Role to offer<select value={role} disabled={busy} onChange={event=>setRole(event.target.value)}>
      {roles.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      <ul>{requests.map(person=><li key={person.uid}>{person.name}
        <button disabled={busy} onClick={()=>act('answer_keeper_request',person.uid)}>Send invitation</button>
        {keeper && <button disabled={busy} onClick={()=>act('decline_keeper_request',person.uid)}>Decline request</button>}
      </li>)}</ul></>}
    {error && <p role="alert">Could not load or update keepership requests. Please try again.</p>}
  </section>;
}
