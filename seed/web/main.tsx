import {Alignments} from './Alignments';
import {Offerings} from './Offerings';
import {SigningIdentity} from './SigningIdentity';
import { TreeInvitationDoor } from './TreeInvitations';
import { ProfilePictures } from './ProfilePictures';
import {Visions} from './Visions';
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { seedBrowserConfig } from '../../src/domain/seedBrowser';
import { createSeedIdentity } from '../../src/services/independent/oidc';
import { createSeedSession } from '../../src/services/independent/session';
import en from '../../src/utils/dictionaries/en';
import './style.css';
import { InvitationDoor } from './Invitations';
import { Trees } from './Trees';
import { Communities } from './Communities';

declare const SEED_BROWSER_CONFIG: unknown;
const config = seedBrowserConfig(SEED_BROWSER_CONFIG);
const session = createSeedSession(createSeedIdentity(config));
const callback = window.location.pathname === '/auth/callback' ? window.location.href : undefined;
// Retain only the invitation token across the sign-in redirect; never an arbitrary return URL.
let treeInviteToken = new URLSearchParams(window.location.search).get('treeInvite');
try {
  if(callback){treeInviteToken=window.sessionStorage.getItem('seed.pendingTreeInvite');window.sessionStorage.removeItem('seed.pendingTreeInvite');}
  else if(treeInviteToken && /^[a-zA-Z0-9_-]{1,128}$/.test(treeInviteToken))window.sessionStorage.setItem('seed.pendingTreeInvite',treeInviteToken);
}catch{/* The original link can be reopened if storage is unavailable. */}
if(!treeInviteToken || !/^[a-zA-Z0-9_-]{1,128}$/.test(treeInviteToken))treeInviteToken=null;
let inviteToken = new URLSearchParams(window.location.search).get('invite');
try {
  if (callback) { inviteToken = window.sessionStorage.getItem('seed.pendingInvite'); window.sessionStorage.removeItem('seed.pendingInvite'); }
  else if (inviteToken && /^[a-zA-Z0-9_-]{1,128}$/.test(inviteToken)) window.sessionStorage.setItem('seed.pendingInvite', inviteToken);
} catch { /* An invitation can still be reopened after sign-in when storage is disabled. */ }
if (!inviteToken || !/^[a-zA-Z0-9_-]{1,128}$/.test(inviteToken)) inviteToken = null;
// Keep authorization codes out of history, screenshots, referrers and subsequent navigation.
if (callback) window.history.replaceState(null, '', '/');
void session.start(callback);

function ProfileForm() {
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'saved' | 'error'>('loading');
  useEffect(() => {
    let active = true;
    void session.read('/v1/me/profile').then(body => {
      if (!active) return;
      const result = body as { profile: { displayName: string } | null };
      setName(result.profile?.displayName ?? ''); setStatus('ready');
    }).catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, []);
  return <form onSubmit={event => {
    event.preventDefault(); setStatus('saving');
    void session.saveProfile(name).then(() => setStatus('saved')).catch(() => setStatus('error'));
  }}>
    <label htmlFor="profile-name">{en.name}</label>
    <input id="profile-name" value={name} maxLength={60} required autoComplete="name"
      disabled={status === 'loading' || status === 'saving'} onChange={e => { setName(e.target.value); setStatus('ready'); }} />
    <button disabled={status === 'loading' || status === 'saving' || !name.trim()}>{status === 'saving' ? en.saving : en.save}</button>
    <p role="status">{status === 'saved' ? en.saved : status === 'error' ? en.err_save_retry : ''}</p>
  </form>;
}

function SeedAccount() {
  const [revision,setRevision]=useState(0);
  const state = useSyncExternalStore(session.subscribe, session.snapshot);
  return <main>
    <h1>{en.node_session_title}</h1>
    <p>{en.node_session_preview}</p>
    <div role="status" aria-live="polite">
      {state.status === 'loading' && <p>{en.loading}</p>}
      {state.status === 'authenticated' && <p>{en.node_session_ready}</p>}
      {state.status === 'error' && <p>{en.node_session_failed}</p>}
    </div>
    {state.status === 'authenticated' && <ProfileForm key={state.uid} />}
    {state.status === 'authenticated' && <SigningIdentity key={'signing:'+state.uid} session={session} uid={state.uid}/>}
    {state.status === 'authenticated' && <ProfilePictures key={'pictures:'+state.uid} session={session} uid={state.uid}/>}
    {state.status !== 'loading' && (state.status === 'authenticated'
      ? <button onClick={() => { void session.logout(); }}>{en.sign_out}</button>
      : <button onClick={() => { void session.login(); }}>{en.sign_in}</button>)}
    {inviteToken && <InvitationDoor key={state.status === 'authenticated' ? state.uid : state.status} token={inviteToken} session={session} signedIn={state.status === 'authenticated'} />}
    {treeInviteToken && <TreeInvitationDoor key={state.status === 'authenticated' ? state.uid : state.status} session={session} token={treeInviteToken} uid={state.status === 'authenticated' ? state.uid : null} onChanged={()=>setRevision(n=>n+1)}/>}
    <Trees key={'trees-'+revision+(state.status === 'authenticated' ? state.uid : state.status)} session={session} uid={state.status === 'authenticated' ? state.uid : null} />
    <Visions key={'visions-'+(state.status === 'authenticated' ? state.uid : state.status)} session={session} uid={state.status === 'authenticated' ? state.uid : null}/>
    {state.status==='authenticated' && <Alignments key={'alignments-'+state.uid} session={session} uid={state.uid}/>}
    <Offerings key={'offerings-'+(state.status === 'authenticated' ? state.uid : state.status)} session={session} uid={state.status === 'authenticated' ? state.uid : null}/>
    <Communities key={state.status === 'authenticated' ? state.uid : state.status} session={session} uid={state.status === 'authenticated' ? state.uid : null} />
  </main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><SeedAccount /></React.StrictMode>);
