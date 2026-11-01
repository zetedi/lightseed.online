import {BlockMint} from './BlockMint';
import {PulseHistory} from './PulseHistory';
import { TreeInvitations } from './TreeInvitations';
import { TreePictures } from './TreePictures';
import { TreeCare } from './TreeCare';
import {TreeGardens} from './TreeGardens';
import {TreeKeeperRequests} from './TreeKeeperRequests';
import { useEffect, useState } from 'react';
import type { createSeedSession } from '../../src/services/independent/session';
import { seedPublicRead } from '../../src/services/independent/public';
import en from '../../src/utils/dictionaries/en';

type Session = ReturnType<typeof createSeedSession>;
type Tree = { id: string; name: string; body: string; visibility: string; treeType: string; latitude?: number; longitude?: number; imageUrl?: string; imageUrls?: string[] };
function TreeForm({ tree, save }: { tree?: Tree; save: (value: object) => Promise<void> }) {
  const [name,setName] = useState(tree?.name ?? ''), [body,setBody] = useState(tree?.body ?? '');
  const [kind,setKind] = useState('LIFETREE'), [visibility,setVisibility] = useState('private');
  const [latitude,setLatitude] = useState(tree?.latitude?.toString() ?? ''), [longitude,setLongitude] = useState(tree?.longitude?.toString() ?? '');
  const [busy,setBusy] = useState(false), [error,setError] = useState(false);
  return <form onSubmit={event=>{
    event.preventDefault(); setBusy(true); setError(false);
    const value = { action:tree ? 'edit':'plant',name,body,...(tree ? { id:tree.id } : { treeType:kind,visibility:kind==='SECRET' ? 'private':visibility }),
      ...(latitude || longitude ? { latitude:Number(latitude),longitude:Number(longitude) } : tree ? { latitude:null,longitude:null } : {}) };
    if ((latitude==='')!==(longitude==='')) { setError(true); setBusy(false); return; }
    void save(value).then(()=>{ if (!tree) { setName(''); setBody(''); } }).catch(()=>setError(true)).finally(()=>setBusy(false));
  }}>
    <label>{en.name}<input required maxLength={120} value={name} disabled={busy} onChange={e=>setName(e.target.value)} /></label>
    <label>{en.description}<textarea maxLength={64000} value={body} disabled={busy} onChange={e=>setBody(e.target.value)} /></label>
    {!tree && <>
      <label>{en.plant_step_type}<select value={kind} disabled={busy} onChange={e=>setKind(e.target.value)}>
        <option value="LIFETREE">{en.type_lifetree}</option><option value="GUARDED">{en.type_guarded}</option><option value="SECRET">{en.type_secret}</option>
      </select></label>
      <label>{en.visibility}<select value={kind==='SECRET' ? 'private':visibility} disabled={busy || kind==='SECRET'} onChange={e=>setVisibility(e.target.value)}>
        <option value="private">{en.vis_private}</option><option value="node">{en.vis_node}</option><option value="public">{en.vis_public}</option>
      </select></label>
    </>}
    <label>{en.node_latitude}<input type="number" step="any" min={-90} max={90} value={latitude} disabled={busy} onChange={e=>setLatitude(e.target.value)} /></label>
    <label>{en.node_longitude}<input type="number" step="any" min={-180} max={180} value={longitude} disabled={busy} onChange={e=>setLongitude(e.target.value)} /></label>
    <button disabled={busy}>{busy ? en.saving : tree ? en.save : en.plant_a_tree}</button>
    {error && <p role="alert">{en.err_save_retry}</p>}
  </form>;
}
export function Trees({ session,uid }: { session:Session; uid:string|null }) {
  const [trees,setTrees] = useState<Tree[]>([]), [next,setNext] = useState<string|null>(null);
  const [selected,setSelected] = useState<string|null>(null), [detail,setDetail] = useState<{ tree:Tree; access?:{editable:boolean;keeper:boolean;inviteMode:'all'|'open'|null} }|null>(null);
  const [revision,setRevision] = useState(0), [busy,setBusy] = useState(false), [error,setError] = useState(false);
  const read = uid ? session.read : seedPublicRead;
  useEffect(()=>{
    let active=true; setBusy(true); setError(false);
    void read('/v1/trees?limit=20').then(body=>{
      if (!active) return;
      const page=body as { trees:Tree[];next:string|null };setTrees(page.trees);setNext(page.next);
    }).catch(()=>{if(active)setError(true);}).finally(()=>{if(active)setBusy(false);});
    return ()=>{active=false;};
  },[read,revision]);
  useEffect(()=>{
    let active=true;setDetail(null);
    if(selected)void read('/v1/trees?id='+encodeURIComponent(selected)).then(body=>{
      if(active)setDetail(body as {tree:Tree;access?:{editable:boolean;keeper:boolean;inviteMode:'all'|'open'|null}});
    }).catch(()=>{if(active)setError(true);});
    return ()=>{active=false;};
  },[read,selected,revision]);
  const save=async(value:object)=>{const body=await session.treeCommand(value) as {tree:Tree};setSelected(body.tree.id);setRevision(n=>n+1);};
  return <section><h2>{en.forest}</h2>
    {error && <p role="alert">{en.err_load_trees}</p>}
    <ul>{trees.map(tree=><li key={tree.id}><button onClick={()=>setSelected(tree.id)}>{tree.name}</button></li>)}</ul>
    {next && <button disabled={busy} onClick={()=>{
      setBusy(true);setError(false);
      void read('/v1/trees?limit=20&after='+encodeURIComponent(next)).then(body=>{
        const page=body as {trees:Tree[];next:string|null};
        setTrees(old=>[...old,...page.trees.filter(tree=>!old.some(prior=>prior.id===tree.id))]);setNext(page.next);
      }).catch(()=>setError(true)).finally(()=>setBusy(false));
    }}>{en.load_more}</button>}
    {uid && <TreeInvitations session={session} uid={uid} onChanged={()=>setRevision(n=>n+1)}/>}
    {detail && <article><h3>{detail.tree.name}</h3><p className="plain-story">{detail.tree.body}</p>
      {uid && <TreeCare key={'care:'+uid+detail.tree.id+revision} session={session} uid={uid} tree={detail.tree} onChanged={()=>setRevision(n=>n+1)}/>}
      {uid && <TreeKeeperRequests key={'requests:'+uid+detail.tree.id+revision} session={session} uid={uid} tree={detail.tree}
        keeper={!!detail.access?.keeper} inviteMode={detail.access?.inviteMode??null} onChanged={()=>setRevision(n=>n+1)}/>}
      {uid && detail.access?.editable && detail.tree.treeType!=='SECRET' && <TreeGardens key={'gardens:'+uid+detail.tree.id+revision}
        session={session} uid={uid} treeId={detail.tree.id} onChanged={()=>setRevision(n=>n+1)}/>}
      {detail.tree.imageUrl && <img src={detail.tree.imageUrl} alt={detail.tree.name} width={240}/>}
      {uid && detail.access?.editable && <BlockMint key={uid+detail.tree.id} session={session} on="tree" id={detail.tree.id} onChanged={()=>setRevision(n=>n+1)}/>}
      <PulseHistory key={(uid??'anonymous')+detail.tree.id+revision} session={session} uid={uid} on="tree" id={detail.tree.id}/>
      {uid && detail.access?.editable && <TreePictures key={uid+detail.tree.id+revision} session={session} uid={uid} tree={detail.tree} onChanged={()=>setRevision(n=>n+1)}/>}
      {uid && detail.access?.inviteMode && <TreeInvitations key={detail.tree.id} session={session} uid={uid} tree={{...detail.tree,inviteMode:detail.access.inviteMode}} onChanged={()=>setRevision(n=>n+1)}/>}
      {detail.access?.keeper && <button disabled={busy} onClick={()=>{
        setBusy(true);setError(false);
        void session.treeCommand({action:'resign_keeper',id:detail.tree.id}).then(()=>{setSelected(null);setDetail(null);setRevision(n=>n+1);})
          .catch(()=>setError(true)).finally(()=>setBusy(false));
      }}>{en.resign_keeper}</button>}
      {detail.access?.editable && <TreeForm key={detail.tree.id+revision} tree={detail.tree} save={save} />}
    </article>}
    {uid && <details><summary>{en.plant_a_tree}</summary><TreeForm save={save}/></details>}
  </section>;
}
