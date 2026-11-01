import {useEffect,useMemo,useState} from 'react';
import {createSeedBlockMint} from '../../src/services/independent/blockMint';
import type {createSeedSession} from '../../src/services/independent/session';

export function BlockMint({session,on,id,onChanged}:{session:ReturnType<typeof createSeedSession>;on:'tree'|'vision';id:string;onChanged:()=>void}) {
  const mint=useMemo(()=>createSeedBlockMint(session),[session]);
  const [title,setTitle]=useState(''),[body,setBody]=useState(''),[watering,setWatering]=useState(false);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [review,setReview]=useState<Awaited<ReturnType<typeof mint.prepare>>|null>(null);
  useEffect(()=>()=>mint.cancel(),[mint,on,id]);
  return <section><h4>Add signed growth</h4>
    <p>Your published signing key must be available on this device. Set up or restore it in the signing-key section first.</p>
    {!review ? <form onSubmit={event=>{
      event.preventDefault();setBusy(true);setMessage('');
      void mint.prepare(on,id,{type:on==='tree'?'tree_growth':'vision_growth',title,body,...(on==='tree' && watering?{care:'watering'}:{})})
        .then(setReview).catch(error=>{
          const reason=error instanceof Error?error.message:'';
          setMessage(reason==='restore_required'?'Restore your published signing key on this device before continuing.'
            :reason==='block_key_frozen'?'This signing key is frozen. Complete recovery before adding growth.'
            :reason==='signing_key_required'?'Create and publish your signing key before adding signed growth.'
            :'The record could not be prepared. Check your account, signing key and access, then review again.');
        }).finally(()=>setBusy(false));
    }}>
      <label>Growth title<input maxLength={240} disabled={busy} value={title} onChange={event=>setTitle(event.target.value)}/></label>
      <label>Growth story<textarea required maxLength={64000} disabled={busy} value={body} onChange={event=>setBody(event.target.value)}/></label>
      {on==='tree' && <label><input type="checkbox" checked={watering} disabled={busy} onChange={event=>setWatering(event.target.checked)}/>Record watering</label>}
      <button disabled={busy}>Review signed growth</button>
    </form>:<div>
      <h5>{String(review.content.title)}</h5><p className="plain-story">{String(review.content.body)}</p>
      <p>Visibility: {String(review.content.visibility)}{review.content.care==='watering'?' · Watering recorded; witness confirmation remains pending.':''}</p>
      <p>Signing key: <code>{review.keyFingerprint}</code></p>
      <p>This adds a permanent record to the chain. If another record arrives first, review again against the new head.</p>
      <button disabled={busy} onClick={()=>{
        setBusy(true);setMessage('');
        void mint.submit().then(()=>{setTitle('');setBody('');setWatering(false);setMessage('Signed growth recorded.');onChanged();})
          .catch(()=>setMessage('The node did not confirm this attempt. Refresh history and check whether it was recorded before preparing another attempt. Nothing will be retried automatically.'))
          .finally(()=>{setReview(null);setBusy(false);});
      }}>Add this signed growth</button>
      <button disabled={busy} onClick={()=>{mint.cancel();setReview(null);}}>Edit before adding</button>
    </div>}
    {message && <p role="status">{message}</p>}
  </section>;
}
