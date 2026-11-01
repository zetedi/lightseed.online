import { PersonPicker } from './PersonPicker';
import { useEffect, useState } from 'react';
import type { createSeedSession } from '../../src/services/independent/session';
import en from '../../src/utils/dictionaries/en';
type Offer = {id:string;communityId:string;communityName?:string;invitedUserId:string;invitedByUserId:string};
export function KeeperOffers({session,uid,communityId,onChanged}:{session:ReturnType<typeof createSeedSession>;uid:string;communityId?:string;onChanged:()=>void}) {
  const [rows,setRows]=useState<Offer[]>([]),[next,setNext]=useState<string|null>(null);
  const [revision,setRevision]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(false);
  const [member,setMember]=useState('');
  const query=communityId ? 'community='+encodeURIComponent(communityId) : 'mine=true';
  useEffect(()=>{
    let active=true;setRows([]);setNext(null);setBusy(true);setError(false);
    void session.read('/v1/keeper-invites?'+query).then(body=>{
      if(!active)return;const page=body as {invites:Offer[];next:string|null};setRows(page.invites);setNext(page.next);
    }).catch(()=>{if(active)setError(true);}).finally(()=>{if(active)setBusy(false);});
    return ()=>{active=false;};
  },[session,query,revision]);
  const act=(offer:Offer,action:string)=>{
    setBusy(true);setError(false);
    void session.communityCommand({action,id:offer.communityId,inviteId:offer.id}).then(()=>{setRevision(n=>n+1);onChanged();})
      .catch(()=>setError(true)).finally(()=>setBusy(false));
  };
  return <section><h3>{en.invitations}</h3>
    {communityId && <form onSubmit={event=>{event.preventDefault();setBusy(true);setError(false);
      void session.communityCommand({action:'offer_keeper',id:communityId,member}).then(()=>{setRevision(n=>n+1);onChanged();}).catch(()=>setError(true)).finally(()=>setBusy(false));
    }}><PersonPicker disabled={busy} onSelect={setMember}/><button disabled={busy || !member}>{en.offer_keepership}</button></form>}
    {error && <p role="alert">{en.err_save_retry}</p>}
    <ul>{rows.map(offer=><li key={offer.id}>{offer.communityName || offer.communityId} — {offer.invitedUserId}
      {offer.invitedUserId===uid && <button disabled={busy} onClick={()=>act(offer,'accept_keeper_offer')}>{en.accept}</button>}
      {(offer.invitedUserId===uid || offer.invitedByUserId===uid) && <button disabled={busy} onClick={()=>act(offer,'decline_keeper_offer')}>{en.decline}</button>}
    </li>)}</ul>
    {next && <button disabled={busy} onClick={()=>{
      setBusy(true);setError(false);
      void session.read('/v1/keeper-invites?'+query+'&after='+encodeURIComponent(next)).then(body=>{
        const page=body as {invites:Offer[];next:string|null};setRows(old=>[...old,...page.invites.filter(row=>!old.some(prior=>prior.id===row.id))]);setNext(page.next);
      }).catch(()=>setError(true)).finally(()=>setBusy(false));
    }}>{en.more}</button>}
  </section>;
}
