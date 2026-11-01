import {BlockMint} from './BlockMint';
import {PulseHistory} from './PulseHistory';
import {VisionPictures} from './TreePictures';
import {useEffect,useState} from 'react';
import type {createSeedSession} from '../../src/services/independent/session';
import {createIndependentGraphReads} from '../../src/adapters/independent';
import {seedPublicRead} from '../../src/services/independent/public';
type Vision={id:string;title:string;body?:string;visibility?:string;authorId?:string;imageUrl?:string;imageUrls?:string[]};
export function Visions({session,uid}:{session:ReturnType<typeof createSeedSession>;uid:string|null}) {
  const [visions,setVisions]=useState<Vision[]>([]),[next,setNext]=useState<string|null>(null),[selected,setSelected]=useState<Vision|null>(null);
  const [joined,setJoined]=useState<string[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState(false);
  const [revision,setRevision]=useState(0);
  const [draft,setDraft]=useState<{id?:string;title:string;body:string;visibility:string}|null>(null);
  const [releaseId,setReleaseId]=useState<string|null>(null);
  const read=uid?session.read:seedPublicRead;
  useEffect(()=>{
    let active=true;
    void (async()=>{
      const page=await read('/v1/visions?limit=20') as {visions:Vision[];next:string|null};
      const links=uid?await createIndependentGraphReads(session).linksFrom(uid,'joined'):[];
      if(active){setVisions(page.visions);setNext(page.next);setJoined(links.map(link=>link.to));}
    })().catch(()=>{if(active)setError(true);}).finally(()=>{if(active)setBusy(false);});
    return ()=>{active=false;};
  },[session,uid,read,revision]);
  return <section><h2>Visions</h2>
    {uid && <button disabled={busy} onClick={()=>setDraft({title:'',body:'',visibility:'public'})}>Create vision</button>}
    {draft && <form onSubmit={event=>{
      event.preventDefault();const identity=session.snapshot();if(identity.status!=='authenticated' || identity.uid!==uid)return;
      setBusy(true);setError(false);
      void session.visionCommand({...draft,action:draft.id?'edit':'create'}).then(()=>{setDraft(null);setSelected(null);setRevision(value=>value+1);})
        .catch(()=>setError(true)).finally(()=>setBusy(false));
    }}>
      <label>Title<input required maxLength={240} value={draft.title} onChange={event=>setDraft({...draft,title:event.target.value})}/></label>
      <label>Vision<textarea maxLength={64000} value={draft.body} onChange={event=>setDraft({...draft,body:event.target.value})}/></label>
      <label>Visibility<select value={draft.visibility} onChange={event=>setDraft({...draft,visibility:event.target.value})}>
        <option value="public">Everyone</option><option value="node">Signed-in people</option><option value="private">Author and staff</option>
      </select></label>
      <button disabled={busy} type="submit">Save vision</button><button disabled={busy} type="button" onClick={()=>setDraft(null)}>Cancel</button>
    </form>}
    <button disabled={busy} onClick={()=>{setSelected(null);setBusy(true);setError(false);setRevision(value=>value+1);}}>Refresh visions</button>
    <ul>{visions.map(vision=><li key={vision.id}><button onClick={()=>setSelected(vision)}>{vision.title}</button></li>)}</ul>
    {next && <button disabled={busy} onClick={()=>{
      setBusy(true);setError(false);void read('/v1/visions?limit=20&after='+encodeURIComponent(next)).then(result=>{
        const page=result as {visions:Vision[];next:string|null};setVisions(old=>[...old,...page.visions.filter(item=>!old.some(existing=>existing.id===item.id))]);setNext(page.next);
      }).catch(()=>setError(true)).finally(()=>setBusy(false));
    }}>Load more visions</button>}
    {selected && <article><h3>{selected.title}</h3><p className="plain-story">{selected.body}</p>
      {(selected.imageUrls?.length?selected.imageUrls:selected.imageUrl?[selected.imageUrl]:[]).map((url,index)=><img key={url} src={url} alt={selected.title+' picture '+(index+1)} width={240} referrerPolicy="no-referrer"/>)}
      {uid && uid===selected.authorId && <BlockMint key={uid+selected.id} session={session} on="vision" id={selected.id} onChanged={()=>setRevision(n=>n+1)}/>}
      <PulseHistory key={(uid??'anonymous')+selected.id+revision} session={session} uid={uid} on="vision" id={selected.id}/>
      {uid && uid===selected.authorId && <VisionPictures key={selected.id} session={session} uid={uid} tree={selected} onChanged={()=>{setSelected(null);setRevision(value=>value+1);}}/>}
      {uid && uid===selected.authorId && (releaseId===selected.id ? <div>
        <p>Release this vision? Its record will be removed. Signed contributions remain; other people's links may remain too.</p>
        <button disabled={busy} onClick={()=>{
          const identity=session.snapshot();if(identity.status!=='authenticated' || identity.uid!==uid)return;
          setBusy(true);setError(false);
          void session.visionCommand({action:'release',id:selected.id}).then(()=>{setReleaseId(null);setSelected(null);setDraft(null);setRevision(value=>value+1);})
            .catch(()=>setError(true)).finally(()=>setBusy(false));
        }}>Confirm release</button><button disabled={busy} onClick={()=>setReleaseId(null)}>Keep vision</button>
      </div>:<button disabled={busy} onClick={()=>setReleaseId(selected.id)}>Release vision</button>)}
      {uid===selected.authorId && <button disabled={busy} onClick={()=>setDraft({id:selected.id,title:selected.title,body:selected.body??'',visibility:selected.visibility??'public'})}>Edit vision</button>}
      {uid && <button disabled={busy} onClick={()=>{
        const identity=session.snapshot();if(identity.status!=='authenticated' || identity.uid!==uid)return;
        const remove=joined.includes(selected.id);setBusy(true);setError(false);
        void session.linkCommand({action:remove?'unlink':'link',from:uid,rel:'joined',to:selected.id})
          .then(()=>setJoined(old=>remove?old.filter(id=>id!==selected.id):[...old,selected.id]))
          .catch(()=>setError(true)).finally(()=>setBusy(false));
      }}>{joined.includes(selected.id)?'Leave this vision':'Join this vision'}</button>}
    </article>}
    {error && <p role="alert">Could not load or save the vision change. Please try again.</p>}
  </section>;
}
