import {useEffect,useMemo,useRef,useState} from 'react';
import {createSeedRecoveryCustody} from '../../src/services/independent/recoveryCustody';
import {recoveryCode,type RecoveryProposal} from '../../src/domain/seedRecovery';
import type {createSeedSession} from '../../src/services/independent/session';
type Witness={id:string;witnessUid:string;epochId:string};
type Page={items:Witness[];next:string|null};
export function SigningRecovery({session,uid,frozen}:{session:ReturnType<typeof createSeedSession>;uid:string;frozen:boolean}) {
  const custody=useMemo(()=>createSeedRecoveryCustody(session),[session,uid]),generation=useRef(0);
  const [words,setWords]=useState<string[]|null>(null),[saved,setSaved]=useState(false),[codes,setCodes]=useState<string[]>([]);
  const [code,setCode]=useState(''),[reviewed,setReviewed]=useState<RecoveryProposal|null>(null),[known,setKnown]=useState(false);
  const [phrase,setPhrase]=useState(''),[page,setPage]=useState<Page|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(false),[notice,setNotice]=useState('');
  useEffect(()=>{
    let active=true;generation.current++;
    if(frozen)void custody.inspect().then(value=>{if(active)setCodes(value.codes);}).catch(()=>{if(active)setError(true);});
    return ()=>{active=false;generation.current++;custody.cancel();};
  },[custody,frozen]);
  const run=<T,>(task:()=>Promise<T>,done:(value:T)=>void)=>{
    const current=session.snapshot(),ticket=++generation.current;
    const valid=()=>ticket===generation.current && session.snapshot()===current;
    if(current.status!=='authenticated' || current.uid!==uid)return;
    setBusy(true);setError(false);setNotice('');
    void task().then(value=>{if(valid())done(value);}).catch(()=>{if(valid())setError(true);}).finally(()=>{if(valid())setBusy(false);});
  };
  const readPage=async(value:RecoveryProposal,after?:string)=>session.read('/v1/signing-recovery-witnesses?id='+encodeURIComponent(value.uid)+'&event='+encodeURIComponent(value.id)+(after?'&after='+encodeURIComponent(after):'')) as Promise<Page>;
  const review=(value:string)=>run(async()=>{const proposal=await custody.read(value);return {proposal,page:await readPage(proposal)};},result=>{
    setCode(value);setReviewed(result.proposal);setPage(result.page);setKnown(false);
  });
  const reset=()=>{custody.cancel();setWords(null);setSaved(false);run(()=>custody.inspect(),value=>setCodes(value.codes));};
  return <section><h3>Recover a frozen signing key</h3>
    <p>Recovery uses a new key and statements from three eligible accounts. The server checks their current keys, eligibility and signatures before activating it.</p>
    {frozen && !words && codes.length===0 && <button disabled={busy} onClick={()=>run(()=>custody.prepare(),value=>{setWords(value.words);setSaved(false);})}>Prepare recovery key</button>}
    {words && <div>
      <p>Save these 24 words privately and in order. They restore your replacement key. They are not sent to the server.</p>
      <p className="plain-story">{words.join(' ')}</p>
      <label><input type="checkbox" checked={saved} disabled={busy} onChange={event=>setSaved(event.target.checked)}/>I have saved the replacement key phrase.</label>
      <button disabled={busy || !saved} onClick={()=>run(()=>custody.confirmBackup(),value=>{
        setWords(null);setSaved(false);setCode(value.code);setCodes(previous=>[...new Set([...previous,value.code])]);setNotice('Recovery opened. Share this code with people who can verify your recovery.');
      })}>Open recovery</button>
      <button disabled={busy} onClick={reset}>Close phrase</button>
    </div>}
    {!words && codes.map(value=><div key={value}>
      <p>Saved recovery code: <code>{value}</code></p>
      {frozen && <button disabled={busy} onClick={()=>run(()=>custody.retry(value),result=>{setCode(result.code);setNotice('Your saved recovery is available. Review its progress below.');})}>Retry opening saved recovery</button>}
      <button disabled={busy} onClick={()=>review(value)}>Review recovery</button>
    </div>)}
    {!words && <>
      <form onSubmit={event=>{event.preventDefault();review(code.trim());}}>
        <label>Recovery code<input value={code} disabled={busy} onChange={event=>{setCode(event.target.value);setReviewed(null);setPage(null);setKnown(false);}}/></label>
        <button type="submit" disabled={busy || !recoveryCode(code.trim())}>Review recovery and witnesses</button>
      </form>
      {reviewed && <div>
        <p>Account: <code>{reviewed.uid}</code></p>
        <p>Replacement fingerprint: <code>{reviewed.toFingerprint}</code></p>
        <p>Claimed compromise time: {new Date(reviewed.suspectedSinceMs).toISOString()}</p>
        <p>{reviewed.status==='activated'?'This recovery has been activated.':'This recovery is open.'}</p>
        {page && <div>
          <p>Recorded witness statements on this page: {page.items.length}. These records do not establish the current eligible quorum.</p>
          <ul>{page.items.map(witness=><li key={witness.id}><code>{witness.witnessUid}</code> — key epoch <code>{witness.epochId}</code></li>)}</ul>
          {page.next && <button disabled={busy} onClick={()=>run(()=>readPage(reviewed,page.next!),setPage)}>Next witness page</button>}
        </div>}
        {reviewed.uid!==uid && reviewed.status==='open' && <div>
          <label><input type="checkbox" checked={known} disabled={busy} onChange={event=>setKnown(event.target.checked)}/>I have verified this person's recovery and replacement fingerprint with them.</label>
          <button disabled={busy || !known} onClick={()=>run(()=>custody.witness(reviewed),()=>{setKnown(false);setNotice('Your witness statement was recorded. Review again to refresh the list.');})}>Sign witness statement</button>
        </div>}
        {reviewed.uid===uid && <>
          <form onSubmit={event=>{
            event.preventDefault();const input=phrase;setPhrase('');run(()=>custody.restore(code.trim(),input),()=>setNotice('The replacement key is restored on this device.'));
          }}>
            <label>Replacement key phrase<textarea value={phrase} disabled={busy} autoComplete="off" autoCapitalize="none" spellCheck={false} onChange={event=>setPhrase(event.target.value)}/></label>
            <button type="submit" disabled={busy || !phrase.trim()}>Restore replacement on this device</button>
          </form>
          {reviewed.status==='open' && <button disabled={busy} onClick={()=>run(async()=>{await custody.activate(code.trim());return custody.read(code.trim());},value=>{
            setReviewed(value);setNotice('The recovery key is active. Refresh signing-key status above.');
          })}>Check quorum and activate replacement</button>}
        </>}
      </div>}
    </>}
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">Recovery could not complete. Check the recovery code, saved replacement phrase and current key status. Activation needs three eligible accounts. A saved candidate remains available for retry.</p>}
  </section>;
}
