import {SigningRecovery} from './SigningRecovery';
import {KeyCustody} from './KeyCustody';
import {useEffect,useState} from 'react';
import type {createSeedSession} from '../../src/services/independent/session';
type Identity={fingerprint:string;epochId:string;state:'active'|'frozen'};
export function SigningIdentity({session,uid}:{session:ReturnType<typeof createSeedSession>;uid:string}) {
  const [identity,setIdentity]=useState<Identity|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState(false);
  const [confirm,setConfirm]=useState(false),[revision,setRevision]=useState(0);
  useEffect(()=>{
    let active=true;
    void session.read('/v1/signing-identity?id='+encodeURIComponent(uid)).then(result=>{
      if(active)setIdentity((result as {identity:Identity|null}).identity);
    }).catch(()=>{if(active)setError(true);}).finally(()=>{if(active)setBusy(false);});
    return ()=>{active=false;};
  },[session,uid,revision]);
  return <section><h2>Signing key</h2>
    <KeyCustody key={uid} session={session} uid={uid}/>
    <button disabled={busy} onClick={()=>{setBusy(true);setError(false);setConfirm(false);setRevision(value=>value+1);}}>Refresh key status</button>
    {!busy && !error && (!identity?<p>No signing key has been published for this account.</p>:<>
      <p>{identity.state==='frozen'?'Your signing key is frozen.':'Your signing key is active.'}</p>
      <p>Fingerprint: <code>{identity.fingerprint}</code></p>
      {identity.state==='active' && (confirm?<div>
        <p>Freeze this key if it may be compromised. This stops future signing and preserves earlier history. Recovering it requires a replacement key and three eligible witness accounts.</p>
        <button onClick={()=>{
          const current=session.snapshot();if(current.status!=='authenticated' || current.uid!==uid)return;
          setBusy(true);setError(false);
          void session.signingCommand({action:'freeze',epochId:identity.epochId,fingerprint:identity.fingerprint})
            .then(result=>{setIdentity((result as {identity:Identity}).identity);setConfirm(false);})
            .catch(()=>setError(true)).finally(()=>setBusy(false));
        }}>Confirm freeze</button><button onClick={()=>setConfirm(false)}>Cancel</button>
      </div>:<button onClick={()=>setConfirm(true)}>Freeze compromised key</button>)}
    </>)}
    <SigningRecovery key={uid} session={session} uid={uid} frozen={identity?.state==='frozen'}/>
    {error && <p role="alert">Could not read or change your signing key. Refresh its status before trying again.</p>}
  </section>;
}
