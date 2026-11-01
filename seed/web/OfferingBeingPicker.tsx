import {useEffect,useState} from 'react';
import type {createSeedSession} from '../../src/services/independent/session';
export type OfferingBeing={id:string;name?:string;title?:string;visibility?:string;treeType?:string};
export function OfferingBeingPicker({session,kind,label,value,onChange,disabled=false,required=false}:{
  session:ReturnType<typeof createSeedSession>;kind:'source'|'bed'|'tree'|'vision';label:string;
  value:OfferingBeing|null;onChange:(value:OfferingBeing|null)=>void;disabled?:boolean;required?:boolean;
}) {
  const [items,setItems]=useState<OfferingBeing[]>([]),[next,setNext]=useState<string|null>(null),[error,setError]=useState(false),[busy,setBusy]=useState(false);
  const collection=kind==='vision'?'visions':'trees';
  const path='/v1/'+collection+'?limit=30'+(kind==='source'||kind==='bed'?'&editable=true':'')+(kind==='bed'?'&kind=BED':'');
  useEffect(()=>{
    let active=true;setBusy(true);setError(false);
    void session.read(path).then(value=>{if(active){const page=value as Record<string,unknown>;setItems(page[collection] as OfferingBeing[]);setNext(page.next as string|null);}})
      .catch(()=>{if(active)setError(true);}).finally(()=>{if(active)setBusy(false);});
    return ()=>{active=false;};
  },[session,path,collection]);
  return <div><label>{label}<select required={required} disabled={disabled||busy} value={value?.id??''} onChange={event=>onChange(items.find(item=>item.id===event.target.value)??null)}>
    <option value="">{required?'Choose…':'None'}</option>
    {items.map(item=><option key={item.id} value={item.id}>{item.name||item.title||'Unnamed being'}{item.visibility==='private'||item.treeType==='SECRET'?' (private)':''}</option>)}
  </select></label>
    {next && <button type="button" disabled={disabled||busy} onClick={()=>{
      const identity=session.snapshot();setBusy(true);setError(false);
      void session.read(path+'&after='+encodeURIComponent(next)).then(value=>{
        if(session.snapshot()!==identity)return;const page=value as Record<string,unknown>;
        setItems(old=>[...old,...(page[collection] as OfferingBeing[]).filter(item=>!old.some(prior=>prior.id===item.id))]);setNext(page.next as string|null);
      }).catch(()=>setError(true)).finally(()=>setBusy(false));
    }}>Load more {kind==='vision'?'visions':kind==='bed'?'beds':'trees'}</button>}
    {error && <p role="alert">These choices could not be loaded. Close and reopen the form to try again.</p>}
  </div>;
}
