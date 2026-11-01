import {useEffect,useState} from 'react';
import type {createSeedSession} from '../../src/services/independent/session';
import {seedPublicRead} from '../../src/services/independent/public';
import {computeCanonicalHash,BLOCK_HASH_VERSION} from '../../src/domain/chain/verify';
type Pulse=Record<string,unknown> & {id:string;type?:string;title?:string;body?:string;authorId?:string;createdAt?:string;hash?:string;hashVersion?:string;previousHash?:string;mintedAt?:number};
export function PulseHistory({session,uid,on,id}:{session:ReturnType<typeof createSeedSession>;uid:string|null;on:'tree'|'vision';id:string}) {
  const [items,setItems]=useState<Pulse[]>([]),[next,setNext]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(false);
  const [seals,setSeals]=useState<Record<string,string>>({}),[revision,setRevision]=useState(0);
  const read=uid?session.read:seedPublicRead,path='/v1/pulses?'+on+'='+encodeURIComponent(id)+'&limit=20';
  useEffect(()=>{
    let active=true;setBusy(true);setError(false);setSeals({});
    void read(path).then(value=>{if(active){const page=value as {pulses:Pulse[];next:string|null};setItems(page.pulses);setNext(page.next);}})
      .catch(()=>{if(active)setError(true);}).finally(()=>{if(active)setBusy(false);});
    return ()=>{active=false;};
  },[read,path,revision]);
  const visible=items.filter(pulse=>!['reach','tree_chat'].includes(pulse.type??''));
  return <section><h4>Visible history</h4>
    <p>This shows records you can read. Private messages are omitted from this timeline. Missing links do not by themselves mean a broken chain.</p>
    <button disabled={busy} onClick={()=>setRevision(value=>value+1)}>Refresh history</button>
    {!busy && !error && !visible.length && <p>No records on this page are visible in the timeline.</p>}
    {visible.map(pulse=><article key={pulse.id}>
      <h5>{typeof pulse.title==='string' && pulse.title?pulse.title:'Chain record'}</h5>
      {typeof pulse.body==='string' && <p className="plain-story">{pulse.body}</p>}
      {typeof pulse.authorId==='string' && <p>Recorded author: <code>{pulse.authorId}</code></p>}
      {typeof pulse.createdAt==='string' && <p>{pulse.createdAt}</p>}
      {pulse.hashVersion===BLOCK_HASH_VERSION && typeof pulse.previousHash==='string' && typeof pulse.hash==='string' && Number.isSafeInteger(pulse.mintedAt) && <>
        <button disabled={busy} onClick={()=>{
          const snapshot=session.snapshot();setBusy(true);setError(false);
          void computeCanonicalHash(pulse.previousHash!,pulse.mintedAt!,pulse).then(hash=>{
            if(session.snapshot()===snapshot)setSeals(previous=>({...previous,[pulse.id]:hash===pulse.hash?'The stored content matches its recorded hash.':'The stored content does not match its recorded hash.'}));
          }).catch(()=>setError(true)).finally(()=>setBusy(false));
        }}>Check recorded hash</button>
        {seals[pulse.id] && <p role="status">{seals[pulse.id]} This check does not verify the full chain or the author’s key history.</p>}
      </>}
    </article>)}
    {next && <button disabled={busy} onClick={()=>{
      const snapshot=session.snapshot();setBusy(true);setError(false);
      void read(path+'&after='+encodeURIComponent(next)).then(value=>{
        if(session.snapshot()!==snapshot)return;const page=value as {pulses:Pulse[];next:string|null};
        setItems(previous=>{const seen=new Set(previous.map(pulse=>pulse.id));return [...previous,...page.pulses.filter(pulse=>!seen.has(pulse.id))];});setNext(page.next);
      }).catch(()=>setError(true)).finally(()=>setBusy(false));
    }}>Load older records</button>}
    {error && <p role="alert">History could not be read or checked. Refresh before trying again.</p>}
  </section>;
}
