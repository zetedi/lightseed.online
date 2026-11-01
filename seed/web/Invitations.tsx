import { useEffect, useState } from 'react';
import type { createSeedSession } from '../../src/services/independent/session';
import { seedPublicRead } from '../../src/services/independent/public';
import en from '../../src/utils/dictionaries/en';

type Session = ReturnType<typeof createSeedSession>;
type Invite = { id: string; communityId: string; label?: string; expiresAt?: string | null; revokedAt?: string };
export function InvitationDoor({ token, session, signedIn }: { token: string; session: Session; signedIn: boolean }) {
  const [invite, setInvite] = useState<Invite | null>(null), [error, setError] = useState(false);
  const [busy, setBusy] = useState(false), [joined, setJoined] = useState(false);
  useEffect(() => {
    let active = true; setInvite(null); setError(false); setJoined(false);
    void seedPublicRead('/v1/community-invites?id=' + encodeURIComponent(token)).then(body => {
      if (active) setInvite((body as { invite: Invite }).invite);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [token]);
  return <section><h2>{en.invitations}</h2>
    {invite && <><p>{invite.label || invite.communityId}</p>
      {invite.revokedAt ? <p>{en.invite_revoked}</p> : invite.expiresAt && Date.parse(invite.expiresAt) <= Date.now()
        ? <p>{en.invite_expired}</p> : signedIn ? <button disabled={busy || joined} onClick={() => {
          setBusy(true); setError(false);
          void session.inviteCommand({ action: 'accept', id: token }).then(() => setJoined(true))
            .catch(() => setError(true)).finally(() => setBusy(false));
        }}>{joined ? en.joined : en.join}</button> : <p>{en.err_signin_join}</p>}
    </>}
    {error && <p role="alert">{en.err_door_not_open}</p>}
  </section>;
}
export function CommunityInvitations({ communityId, session }: { communityId: string; session: Session }) {
  const [invites, setInvites] = useState<Invite[]>([]), [next, setNext] = useState<string | null>(null);
  const [revision, setRevision] = useState(0), [label, setLabel] = useState(''), [expires, setExpires] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  useEffect(() => {
    let active = true; setError(false); setBusy(true);
    void session.read('/v1/community-invites?community=' + encodeURIComponent(communityId)).then(body => {
      if (!active) return;
      const page = body as { invites: Invite[]; next: string | null }; setInvites(page.invites); setNext(page.next);
    }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [communityId, session, revision]);
  return <section><h4>{en.invitations}</h4>
    {error && <p role="alert">{en.err_save_retry}</p>}
    <form onSubmit={event => {
      event.preventDefault(); setBusy(true); setError(false);
      void session.inviteCommand({ action: 'mint', communityId, label, expiresAt: expires ? new Date(expires).toISOString() : null })
        .then(() => { setLabel(''); setRevision(n => n + 1); }).catch(() => setError(true)).finally(() => setBusy(false));
    }}>
      <label>{en.name}<input value={label} maxLength={120} disabled={busy} onChange={e => setLabel(e.target.value)} /></label>
      <label>{en.node_invite_expiry}<input type="datetime-local" value={expires} disabled={busy} onChange={e => setExpires(e.target.value)} /></label>
      <button disabled={busy}>{en.save}</button>
    </form>
    <ul>{invites.map(invite => <li key={invite.id}>{invite.label || invite.id}
      {invite.revokedAt ? <span> — {en.invite_revoked}</span> : <>
        <a href={'/?invite=' + encodeURIComponent(invite.id)}>{en.community_link}</a>
        <button disabled={busy} onClick={() => {
          setBusy(true); setError(false);
          void session.inviteCommand({ action: 'revoke', id: invite.id }).then(() => setRevision(n => n + 1))
            .catch(() => setError(true)).finally(() => setBusy(false));
        }}>{en.invite_revoke}</button>
      </>}
    </li>)}</ul>
    {next && <button disabled={busy} onClick={() => {
      setBusy(true); setError(false);
      void session.read('/v1/community-invites?community=' + encodeURIComponent(communityId) + '&after=' + encodeURIComponent(next)).then(body => {
        const page = body as { invites: Invite[]; next: string | null };
        setInvites(old => [...old, ...page.invites.filter(i => !old.some(p => p.id === i.id))]); setNext(page.next);
      }).catch(() => setError(true)).finally(() => setBusy(false));
    }}>{en.load_more}</button>}
  </section>;
}
