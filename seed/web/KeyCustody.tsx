import {useEffect,useMemo,useState} from 'react';
import type {createSeedSession} from '../../src/services/independent/session';
import {createSeedKeyCustody} from '../../src/services/independent/keyCustody';
export function KeyCustody({session,uid}:{session:ReturnType<typeof createSeedSession>;uid:string}) {
  const custody=useMemo(()=>createSeedKeyCustody(session),[session,uid]);
  const [status,setStatus]=useState<string>('loading'),[words,setWords]=useState<string[]|null>(null),[saved,setSaved]=useState(false);
  const [rotating,setRotating]=useState(false),[rotationPending,setRotationPending]=useState(false);
  const [phrase,setPhrase]=useState(''),[busy,setBusy]=useState(true),[error,setError]=useState(false);
  useEffect(()=>{
    let active=true;
    void custody.inspect().then(result=>{if(active){setStatus(result.frozen?'frozen':result.status);setRotationPending(result.rotationPending);}})
      .catch(()=>{if(active)setError(true);}).finally(()=>{if(active)setBusy(false);});
    return ()=>{active=false;custody.cancel();};
  },[custody]);
  const refresh=async()=>{const result=await custody.inspect();setStatus(result.frozen?'frozen':result.status);setRotationPending(result.rotationPending);};
  return <section><h3>Key on this device</h3>
    <p>{status==='ready'?'This device holds your current signing key.':status==='frozen'?'Your signing key is frozen. Restoring its phrase does not unfreeze it.':status==='publish_needed'?'A saved device key is waiting to be published.':status==='fresh'?'Create a signing key or restore one from your saved phrase.':'Restore your saved phrase to use your signing key on this device.'}</p>
    {words ? <div>
      {rotating && <p>This phrase is for your replacement key. Keep your previous phrase too, for older signed records.</p>}
      <p>Write these 24 words down in order and keep them private. They restore this key. They are not sent to the server or saved as text in this browser.</p>
      <p className="plain-story">{words.join(' ')}</p>
      <label><input type="checkbox" checked={saved} disabled={busy} onChange={event=>setSaved(event.target.checked)}/>I have saved my recovery phrase.</label>
      <button disabled={busy || !saved} onClick={()=>{
        setBusy(true);setError(false);void custody.confirmBackup().then(async()=>{setWords(null);setSaved(false);await refresh();})
          .catch(()=>setError(true)).finally(()=>setBusy(false));
      }}>{rotating?'Replace signing key':'Publish public key'}</button>
      <button disabled={busy} onClick={()=>{custody.cancel();setWords(null);setSaved(false);setBusy(true);void refresh().catch(()=>setError(true)).finally(()=>setBusy(false));}}>Cancel</button>
    </div>:<>
      {status==='fresh' && <button disabled={busy} onClick={()=>{
        setBusy(true);setError(false);void custody.prepare().then(result=>{setWords(result.words);setSaved(false);setRotating(false);}).catch(()=>setError(true)).finally(()=>setBusy(false));
      }}>Create signing key</button>}
      {status==='ready' && !rotationPending && <button disabled={busy} onClick={()=>{
        setBusy(true);setError(false);void custody.prepareRotation().then(result=>{setWords(result.words);setSaved(false);setRotating(true);}).catch(()=>setError(true)).finally(()=>setBusy(false));
      }}>Prepare replacement signing key</button>}
      {rotationPending && status!=='frozen' && <div><p>A replacement key is saved on this device. Retry to check or finish switching to it.</p>
        <button disabled={busy} onClick={()=>{
          setBusy(true);setError(false);void custody.retryRotation().then(refresh).catch(()=>setError(true)).finally(()=>setBusy(false));
        }}>Retry key replacement</button>
      </div>}
      {status==='publish_needed'  && <button disabled={busy} onClick={()=>{
        setBusy(true);setError(false);void custody.publishStored().then(refresh).catch(()=>setError(true)).finally(()=>setBusy(false));
      }}>Retry public-key publication</button>}
      <form onSubmit={event=>{
        event.preventDefault();const input=phrase;setPhrase('');setBusy(true);setError(false);
        void custody.restore(input).then(refresh).catch(()=>setError(true)).finally(()=>setBusy(false));
      }}>
        <label>Recovery phrase<textarea value={phrase} disabled={busy} autoComplete="off" autoCapitalize="none" spellCheck={false} onChange={event=>setPhrase(event.target.value)}/></label>
        <button disabled={busy || !phrase.trim()} type="submit">Restore key on this device</button>
      </form>
      <button disabled={busy} onClick={()=>{setBusy(true);setError(false);void refresh().catch(()=>setError(true)).finally(()=>setBusy(false));}}>Check device key</button>
    </>}
    {error && <p role="alert">Could not complete key custody. Save your profile first; for restoration, use the phrase matching your published key. Your key may need attention on another device.</p>}
  </section>;
}
