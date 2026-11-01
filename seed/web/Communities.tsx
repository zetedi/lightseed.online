import { KeeperOffers } from './KeeperOffers';
import {CommunityRelations} from './CommunityRelations';
import {CommunityGarden} from './CommunityGarden';
import { CommunityInvitations } from './Invitations';
import { useEffect, useState } from 'react';
import type { createSeedSession } from '../../src/services/independent/session';
import { seedPublicRead } from '../../src/services/independent/public';
import en from '../../src/utils/dictionaries/en';

type Session = ReturnType<typeof createSeedSession>;
type Community = { id: string; name: string; domain: string; door?: string; lid: string };
type Access = { keeper: boolean; steward: boolean; joined: boolean; requested: boolean; keeperRequested: boolean; canFormCircle: boolean };
function FormCircle({id,name,save}:{id:string;name:string;save:(value:object)=>Promise<void>}) {
  const [chosen,setChosen]=useState(name),[busy,setBusy]=useState(false),[error,setError]=useState(false);
  return <form onSubmit={event=>{event.preventDefault();setBusy(true);setError(false);
    void save({action:'form_circle',id,name:chosen}).catch(()=>setError(true)).finally(()=>setBusy(false));
  }}><h4>{en.circle_form_title}</h4><p>{en.circle_form_desc}</p>
    <label>{en.name}<input value={chosen} maxLength={120} disabled={busy} onChange={e=>setChosen(e.target.value)}/></label>
    <button disabled={busy}>{en.circle_form_button}</button>{error && <p role="alert">{en.err_save_retry}</p>}
  </form>;
}
function CommunityForm({ community, save }: { community?: Community; save: (value: object) => Promise<void> }) {
  const [name, setName] = useState(community?.name ?? '');
  const [domain, setDomain] = useState(community?.domain ?? '');
  const [door, setDoor] = useState(community?.door ?? 'invite');
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  return <form onSubmit={event => {
    event.preventDefault(); setBusy(true); setError(false);
    void save({ action: community ? 'edit' : 'create', ...(community ? { id: community.id } : {}), name, domain, door })
      .then(() => { if (!community) { setName(''); setDomain(''); } })
      .catch(() => setError(true)).finally(() => setBusy(false));
  }}>
    <label>{en.community_name}<input required maxLength={120} value={name} disabled={busy} onChange={e => setName(e.target.value)} /></label>
    <label>{en.domain}<input required maxLength={253} value={domain} disabled={busy} onChange={e => setDomain(e.target.value.toLowerCase())} /></label>
    <label>{en.doors_title}<select value={door} disabled={busy} onChange={e => setDoor(e.target.value)}>
      <option value="open">{en.door_hint_open}</option><option value="invite">{en.door_invitation}</option><option value="closed">{en.door_closed_label}</option>
    </select></label>
    <button disabled={busy}>{busy ? en.saving : en.save}</button>
    {error && <p role="alert">{en.err_save_retry}</p>}
  </form>;
}
function CommunityMembers({ id, session, command, revision, keeper }: { keeper: boolean; id: string; session: Session; command: (value: object) => Promise<void>; revision: number }) {
  const [rows, setRows] = useState<{ from: string; rel: string; id: string }[]>([]);
  const [next, setNext] = useState<string | null>(null), [error, setError] = useState(false), [busy, setBusy] = useState(false);
  const [relation, setRelation] = useState('join_request');
  useEffect(() => {
    let active = true; setRows([]); setNext(null); setError(false); setBusy(true);
    void session.read('/v1/links?to=' + encodeURIComponent(id) + '&rel=' + relation).then(body => {
      if (!active) return;
      const page = body as { links: typeof rows; next: string | null }; setRows(page.links); setNext(page.next);
    }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [id, relation, revision, session]);
  const act = (action: string, member: string) => {
    setBusy(true); setError(false);
    void command({ action, id, member }).catch(() => setError(true)).finally(() => setBusy(false));
  };
  return <section><h4>{en.members}</h4>
    <button disabled={busy} onClick={() => setRelation('join_request')}>{en.invite_requests}</button>
    <button disabled={busy} onClick={() => setRelation('member')}>{en.members}</button>
    <button disabled={busy} onClick={() => setRelation('steward')}>{en.role_steward}</button>
    {keeper && <button disabled={busy} onClick={() => setRelation('keeper_request')}>{en.keeper_requests}</button>}
    {error && <p role="alert">{en.err_save_retry}</p>}
    <ul>{rows.map(row => <li key={row.id}>{row.from}{['join_request','keeper_request'].includes(relation) ? <>
      <button disabled={busy} onClick={() => act(relation === 'keeper_request' ? 'accept_keeper_request' : 'accept', row.from)}>{en.accept}</button>
      <button disabled={busy} onClick={() => act(relation === 'keeper_request' ? 'decline_keeper_request' : 'decline', row.from)}>{en.decline}</button>
    </> : relation === 'steward' ? keeper && <button disabled={busy} onClick={() => act('revoke_steward', row.from)}>{en.unsteward}</button> : <>
      <button disabled={busy} onClick={() => act('remove', row.from)}>{en.remove}</button>
      {keeper && <><button disabled={busy} onClick={() => act('grant_steward', row.from)}>{en.make_steward}</button><button disabled={busy} onClick={() => act('offer_keeper', row.from)}>{en.offer_keepership}</button></>}
    </>}</li>)}</ul>
    {next && <button disabled={busy} onClick={() => {
      setBusy(true); setError(false);
      void session.read('/v1/links?to=' + encodeURIComponent(id) + '&rel=' + relation + '&after=' + encodeURIComponent(next)).then(body => {
        const page = body as { links: typeof rows; next: string | null };
        setRows(old => [...old, ...page.links.filter(row => !old.some(prior => prior.id === row.id))]); setNext(page.next);
      }).catch(() => setError(true)).finally(() => setBusy(false));
    }}>{en.load_more}</button>}
  </section>;
}
export function Communities({ session, uid }: { session: Session; uid: string | null }) {
  const [items, setItems] = useState<Community[]>([]), [next, setNext] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ community: Community; access?: Access } | null>(null);
  const [revision, setRevision] = useState(0), [error, setError] = useState(false), [busy, setBusy] = useState(false);
  const read = uid ? session.read : seedPublicRead;
  useEffect(() => {
    let active = true; setError(false); setBusy(true);
    void seedPublicRead('/v1/communities?limit=20').then(body => {
      if (!active) return;
      const page = body as { communities: Community[]; next: string | null }; setItems(page.communities); setNext(page.next);
    }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [revision]);
  useEffect(() => {
    let active = true; setDetail(null);
    if (selected) void read('/v1/communities?id=' + encodeURIComponent(selected)).then(body => {
      if (active) setDetail(body as { community: Community; access?: Access });
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [selected, revision, read]);
  const command = async (value: object) => {
    await session.communityCommand(value); setRevision(n => n + 1);
  };
  const act = (action: string) => {
    setBusy(true); setError(false);
    void command({ action, id: selected }).catch(() => setError(true)).finally(() => setBusy(false));
  };
  return <section aria-labelledby="communities-title">
    <h2 id="communities-title">{en.communities}</h2>
    {error && <p role="alert">{en.err_save_retry}</p>}
    <ul>{items.map(c => <li key={c.id}><button onClick={() => setSelected(c.id)}>{c.name}</button></li>)}</ul>
    {next && <button disabled={busy} onClick={() => {
      setBusy(true); setError(false);
      void seedPublicRead('/v1/communities?limit=20&after=' + encodeURIComponent(next)).then(body => {
        const page = body as { communities: Community[]; next: string | null };
        setItems(old => [...old, ...page.communities.filter(c => !old.some(p => p.id === c.id))]); setNext(page.next);
      }).catch(() => setError(true)).finally(() => setBusy(false));
    }}>{en.more}</button>}
    {uid && <KeeperOffers session={session} uid={uid} onChanged={()=>setRevision(n=>n+1)} />}
    {detail && <article>
      <h3>{detail.community.name}</h3><p>{detail.community.domain}</p>
      <CommunityGarden key={'garden:'+uid+detail.community.id+revision} session={session} uid={uid} id={detail.community.id}/>
      <CommunityRelations key={'relations:'+uid+detail.community.id+revision} session={session} community={detail.community}
        uid={uid} editable={!!detail.access?.keeper} onChanged={()=>setRevision(n=>n+1)}/>
      <p>{detail.community.door === 'open' ? en.door_hint_open : detail.community.door === 'closed' ? en.door_hint_closed : en.door_hint_invite}</p>
      {detail.access?.canFormCircle && <FormCircle id={detail.community.id} name={detail.community.name} save={command}/>}
      {detail.access?.keeper && <CommunityForm key={detail.community.id + revision} community={detail.community} save={command} />}
      {detail.access?.keeper && uid && <KeeperOffers key={detail.community.id+revision} session={session} uid={uid} communityId={detail.community.id} onChanged={()=>setRevision(n=>n+1)} />}
      {detail.access?.keeper && <button disabled={busy} onClick={() => act('resign_keeper')}>{en.resign_keeper}</button>}
      {detail.access?.steward && <button disabled={busy} onClick={() => {
        setBusy(true); setError(false);
        void command({ action: 'revoke_steward', id: selected, member: uid }).catch(() => setError(true)).finally(() => setBusy(false));
      }}>{en.unsteward}</button>}
      {detail.access && !detail.access.keeper && <div>
        <button disabled={busy} onClick={() => act(detail.access?.keeperRequested ? 'cancel_keeper_request' : 'request_keeper')}>{detail.access.keeperRequested ? en.withdraw_ask : en.ask_to_keep}</button>
        {detail.access.joined ? <button disabled={busy} onClick={() => act('leave')}>{en.leave}</button>
          : detail.access.requested ? <button disabled={busy} onClick={() => act('cancel')}>{en.cancel}</button>
          : detail.community.door !== 'closed' && <button disabled={busy} onClick={() => act(detail.community.door === 'open' ? 'join' : 'request')}>{en.join}</button>}
      </div>}
      {(detail.access?.keeper || detail.access?.steward) && <CommunityMembers key={detail.community.id + revision} id={detail.community.id} session={session} command={command} revision={revision} keeper={detail.access?.keeper === true} />}
      {(detail.access?.keeper || detail.access?.steward) && <CommunityInvitations key={detail.community.id} communityId={detail.community.id} session={session} />}
    </article>}
    {uid && <details><summary>{en.create_community}</summary><CommunityForm save={command} /></details>}
  </section>;
}
