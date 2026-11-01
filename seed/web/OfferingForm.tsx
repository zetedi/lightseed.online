import {useEffect,useRef,useState} from 'react';
import {seedOfferingCommand} from '../../src/domain/seedOffering.mjs';
import {seedMediaReferencePath} from '../../src/domain/seedMedia.mjs';
import type {createSeedSession} from '../../src/services/independent/session';
import {OfferingBeingPicker,type OfferingBeing} from './OfferingBeingPicker';
export type OfferingDraftRecord={id:string;title?:string;body?:string;offeringKind?:string;offeringAppreciationLight?:number;
  offeringUrl?:string;visibility?:string;imageUrl?:string;imageUrls?:string[];offeredToName?:string;offeringFromTreeName?:string;offeringBedName?:string};

export function OfferingForm({session,uid,offering,onSaved,onCancel}:{session:ReturnType<typeof createSeedSession>;uid:string;
  offering?:OfferingDraftRecord;onSaved:()=>void;onCancel:()=>void}) {
  const [title,setTitle]=useState(offering?.title??''),[body,setBody]=useState(offering?.body??''),[kind,setKind]=useState(offering?.offeringKind??'service');
  const [appreciation,setAppreciation]=useState(String(offering?.offeringAppreciationLight??21)),[url,setUrl]=useState(offering?.offeringUrl??'');
  const [visibility,setVisibility]=useState(offering?.visibility??'public'),[destination,setDestination]=useState<'listing'|'tree'|'vision'>('listing');
  const [source,setSource]=useState<OfferingBeing|null>(null),[target,setTarget]=useState<OfferingBeing|null>(null),[bed,setBed]=useState<OfferingBeing|null>(null);
  const initialImages=offering?.imageUrls?.length?offering.imageUrls:offering?.imageUrl?[offering.imageUrl]:[];
  const [paths,setPaths]=useState<string[]>(initialImages.map(seedMediaReferencePath).filter((path):path is string=>path!==null));
  const [picturesChanged,setPicturesChanged]=useState(false),[replaceImported,setReplaceImported]=useState(false);
  const imported=initialImages.some(image=>seedMediaReferencePath(image)===null) && !replaceImported;
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const active=useRef(true);useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  const privateReference=!offering && [source,target,kind==='bed'?bed:null].some(being=>being?.visibility==='private'||being?.treeType==='SECRET');
  const effectiveVisibility=privateReference?'private':visibility;
  return <form onSubmit={event=>{
    event.preventDefault();setMessage('');
    const identity=session.snapshot();if(identity.status!=='authenticated'||identity.uid!==uid)return;
    const value={action:offering?'edit':'create',...(offering?{id:offering.id}:{kind}),title,body,appreciation:Number(appreciation),url,visibility:effectiveVisibility,
      ...(!offering && kind==='bed' && bed?{bedId:bed.id}:{}),
      ...(!offering && destination!=='listing'?{toKind:destination,toId:target?.id,fromTreeId:source?.id}:{}),
      ...(!offering||picturesChanged?{paths}:{})};
    const command=seedOfferingCommand(value);
    if(!command){setMessage('Check the title, whole positive appreciation, detail link and selected beings. Code offerings need a link.');return;}
    setBusy(true);
    void session.offeringCommand(command).then(()=>{if(active.current&&session.snapshot()===identity)onSaved();})
      .catch(()=>{if(active.current&&session.snapshot()===identity)setMessage('Saving was not confirmed. Check the offering list before trying again. Your access or a referenced being’s privacy may have changed. Nothing is retried automatically.');})
      .finally(()=>{if(active.current)setBusy(false);});
  }}>
    <h3>{offering?'Edit offering':'Create offering'}</h3>
    {!offering?<label>Kind<select disabled={busy} value={kind} onChange={event=>{setKind(event.target.value);setBed(null);}}>
      <option value="service">Service</option><option value="bed">Bed</option><option value="code">Code</option><option value="product">Product</option>
    </select></label>:<p>Kind: {kind}. The kind, bed and receiving being remain fixed.</p>}
    <label>Title<input required maxLength={240} disabled={busy} value={title} onChange={event=>setTitle(event.target.value)}/></label>
    <label>Description<textarea maxLength={64000} disabled={busy} value={body} onChange={event=>setBody(event.target.value)}/></label>
    <label>Suggested appreciation in light<input required type="number" min={1} step={1} disabled={busy} value={appreciation} onChange={event=>setAppreciation(event.target.value)}/></label>
    <p>Appreciation follows receiving the offering. It is not an admission price.</p>
    <label>Detail link{kind==='code'?' (required)':''}<input type="url" required={kind==='code'} maxLength={300} disabled={busy} value={url} onChange={event=>setUrl(event.target.value)}/></label>
    {!offering && kind==='bed' && <OfferingBeingPicker session={session} kind="bed" label="Linked bed (optional)" value={bed} onChange={setBed} disabled={busy}/>}
    {!offering && <>
      <label>Offer to<select disabled={busy} value={destination} onChange={event=>{setDestination(event.target.value as typeof destination);setSource(null);setTarget(null);}}>
        <option value="listing">General listing</option><option value="tree">A tree</option><option value="vision">A vision</option>
      </select></label>
      {destination!=='listing' && <>
        <OfferingBeingPicker session={session} kind="source" label="From a tree you care for" value={source} onChange={setSource} disabled={busy} required/>
        <OfferingBeingPicker key={destination} session={session} kind={destination} label={destination==='tree'?'Receiving tree':'Receiving vision'} value={target} onChange={setTarget} disabled={busy} required/>
        <p>The receiving keeper or author will receive a private notice. Acceptance later records the agreement on both chains.</p>
      </>}
    </>}
    {offering?.offeredToName && <p>Offered to {offering.offeredToName}{offering.offeringFromTreeName?' from '+offering.offeringFromTreeName:''}.</p>}
    <label>Who can read this offering<select disabled={busy||privateReference} value={effectiveVisibility} onChange={event=>setVisibility(event.target.value)}>
      <option value="public">Everyone</option><option value="node">Signed-in people</option><option value="private">Author, recipient carers and staff</option>
    </select></label>
    {privateReference && <p>This offering stays private because a referenced being is private.</p>}
    <h4>Pictures</h4><p>Uploaded pictures are public even when the offering is private.</p>
    {imported?<div><p>Imported picture references will be preserved unless you replace them.</p>
      <button type="button" disabled={busy} onClick={()=>{setPaths([]);setReplaceImported(true);setPicturesChanged(true);}}>Replace all pictures</button>
    </div>:<>
      <ol>{paths.map((path,index)=><li key={path}>
        <img src={'/v1/media?path='+encodeURIComponent(path)+'&variant=small'} alt={'Offering picture '+(index+1)} width={120}/>
        <button type="button" disabled={busy||index===0} onClick={()=>{setPicturesChanged(true);setPaths(old=>{const next=[...old];[next[index-1],next[index]]=[next[index],next[index-1]];return next;});}}>Move earlier</button>
        <button type="button" disabled={busy} onClick={()=>{setPicturesChanged(true);setPaths(old=>old.filter(item=>item!==path));}}>Remove picture</button>
      </li>)}</ol>
      <label>Add pictures<input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event=>{
        const files=Array.from(event.target.files??[]);event.target.value='';if(!files.length)return;
        const identity=session.snapshot();if(identity.status!=='authenticated'||identity.uid!==uid)return;
        if(paths.length+files.length>100){setMessage('An offering can have at most 100 pictures.');return;}
        setBusy(true);setMessage('');
        void (async()=>{for(const file of files){
          if(!active.current||session.snapshot()!==identity)return;
          const extension={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];if(!extension)throw new Error('invalid_image');
          const path='users/'+uid+'/'+crypto.randomUUID()+'.'+extension;await session.uploadMedia(path,file);
          if(!active.current||session.snapshot()!==identity)return;setPaths(old=>[...old,path]);setPicturesChanged(true);
        }})().catch(()=>{if(active.current)setMessage('A picture could not be uploaded. Check the list before adding it again.');}).finally(()=>{if(active.current)setBusy(false);});
      }}/></label>
    </>}
    <button disabled={busy} type="submit">{offering?'Save offering':'Create offering'}</button>
    <button disabled={busy} type="button" onClick={onCancel}>Cancel</button>
    {message&&<p role="alert">{message}</p>}
  </form>;
}
