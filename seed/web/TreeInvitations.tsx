import { PersonPicker } from './PersonPicker';
import { useEffect, useState } from 'react';
import type { createSeedSession } from '../../src/services/independent/session';
import { seedPublicRead } from '../../src/services/independent/public';
import en from '../../src/utils/dictionaries/en';
type Session=ReturnType<typeof createSeedSession>;
type Invite={id:string;lifetreeId:string;lifetreeName?:string;invitedUserId:string;invitedByUserId:string;role:'keeper'|'steward'|'guardian'|'observer';status:string;open?:boolean};
const roleLabel=(role:Invite['role'])=>en[`role_${role}`];
export function TreeInvitationDoor({session,token,uid,onChanged}:{session:Session;token:string;uid:string|null;onChanged:()=>void}) {
  const [invite,setInvite]=useState<Invite|null>(null),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(false);
  const read=uid ? session.read : seedPublicRead;
  useEffect(()=>{let active=true;setInvite(null);setError(false);
    void read('/v1/tree-invites?id='+encodeURIComponent(token)).then(body=>{if(active)setInvite((body as {invite:Invite}).invite);}).catch(()=>{if(active)setError(true);});
    return ()=>{active=false;};
  },[read,token,revision]);
  const act=(action:string)=>{setBusy(true);setError(false);void session.treeInviteCommand({action,id:token})
    .then(()=>{setRevision(n=>n+1);if(action==='accept')onChanged();}).catch(()=>setError(true)).finally(()=>setBusy(false));};
  return <section><h2>{en.invitations}</h2>{error && <p role="alert">{en.err_save_retry}</p>}
    {invite && <><h3>{invite.lifetreeName}</h3><p>{roleLabel(invite.role)} · {invite.status}</p>
      {invite.status==='pending' && (uid ? invite.open ? <button disabled={busy} onClick={()=>act('claim')}>{en.join}</button>
        : invite.invitedUserId===uid && <><button disabled={busy} onClick={()=>act('accept')}>{en.accept}</button><button disabled={busy} onClick={()=>act('decline')}>{en.decline}</button></>
        : <button onClick={()=>{void session.login();}}>{en.sign_in}</button>)}
    </>}
  </section>;
}
export function TreeInvitations({session,uid,tree,onChanged}:{session:Session;uid:string;tree?:{id:string;treeType:string;inviteMode:'all'|'open'};onChanged:()=>void}) {
  const [rows,setRows]=useState<Invite[]>([]),[next,setNext]=useState<string|null>(null),[revision,setRevision]=useState(0);
  const [busy,setBusy]=useState(false),[error,setError]=useState(false),[member,setMember]=useState(''),[open,setOpen]=useState(true);
  const [role,setRole]=useState<Invite['role']>(tree?.treeType==='SECRET' ? 'keeper':'observer'),[share,setShare]=useState<string|null>(null);
  const query=tree ? 'tree='+encodeURIComponent(tree.id) : 'mine=true';
  useEffect(()=>{let active=true;setRows([]);setNext(null);setBusy(true);setError(false);
    void session.read('/v1/tree-invites?'+query).then(body=>{if(!active)return;const page=body as {invites:Invite[];next:string|null};setRows(page.invites);setNext(page.next);})
      .catch(()=>{if(active)setError(true);}).finally(()=>{if(active)setBusy(false);});return ()=>{active=false;};
  },[session,query,revision]);
  const act=(value:object)=>{setBusy(true);setError(false);void session.treeInviteCommand(value).then(body=>{
    const result=body as {invite:Invite};if(result.invite.open && result.invite.status==='pending')setShare(window.location.origin+'/?treeInvite='+encodeURIComponent(result.invite.id));
    setRevision(n=>n+1);if(result.invite.status==='accepted')onChanged();
  }).catch(()=>setError(true)).finally(()=>setBusy(false));};
  return <section><h3>{en.invitations}</h3>{error && <p role="alert">{en.err_save_retry}</p>}
    {tree && <form onSubmit={event=>{event.preventDefault();act({action:'mint',treeId:tree.id,open,role,...(!open ? {member}: {})});}}>
      <label><input type="checkbox" checked={open} onChange={e=>{setOpen(e.target.checked);setMember('');}} disabled={busy}/>{en.invite_mint_hint}</label>
      {!open && <PersonPicker disabled={busy} onSelect={setMember}/>}
      <select aria-label={en.role_keeper} value={role} onChange={e=>setRole(e.target.value as Invite['role'])} disabled={busy}>
        {(tree.treeType==='SECRET' ? ['keeper'] : tree.inviteMode==='all' ? ['keeper','steward','guardian','observer'] : ['guardian','observer']).map(value=><option key={value} value={value}>{roleLabel(value as Invite['role'])}</option>)}
      </select><button disabled={busy || (!open && !member)}>{en.invite}</button>
    </form>}
    {share && <p><a href={share}>{share}</a></p>}
    <ul>{rows.map(invite=><li key={invite.id}>{invite.lifetreeName} · {roleLabel(invite.role)}
      {invite.invitedUserId===uid && <><button disabled={busy} onClick={()=>act({action:'accept',id:invite.id})}>{en.accept}</button><button disabled={busy} onClick={()=>act({action:'decline',id:invite.id})}>{en.decline}</button></>}
      {(invite.invitedByUserId===uid || tree?.inviteMode==='all') && <button disabled={busy} onClick={()=>act({action:'revoke',id:invite.id})}>{en.revoke}</button>}
    </li>)}</ul>
    {next && <button disabled={busy} onClick={()=>{setBusy(true);setError(false);void session.read('/v1/tree-invites?'+query+'&after='+encodeURIComponent(next)).then(body=>{
      const page=body as {invites:Invite[];next:string|null};setRows(old=>[...old,...page.invites.filter(row=>!old.some(prior=>prior.id===row.id))]);setNext(page.next);
    }).catch(()=>setError(true)).finally(()=>setBusy(false));}}>{en.more}</button>}
  </section>;
}
