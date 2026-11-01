import {useEffect,useState} from 'react';
import type {createSeedSession} from '../../src/services/independent/session';
import {seedPublicRead} from '../../src/services/independent/public';
type Tree={id:string;name:string;body?:string;imageUrl?:string};
export function CommunityGarden({session,uid,id}:{session:ReturnType<typeof createSeedSession>;uid:string|null;id:string}) {
  const [trees,setTrees]=useState<Tree[]>([]),[next,setNext]=useState<string|null>(null);
  const [busy,setBusy]=useState(true),[error,setError]=useState(false);
  const read=uid?session.read:seedPublicRead;
  const path='/v1/trees?garden='+encodeURIComponent(id)+'&limit=20';
  useEffect(()=>{
    let active=true;
    void read(path).then(result=>{
      if(!active)return;const page=result as {trees:Tree[];next:string|null};setTrees(page.trees);setNext(page.next);
    }).catch(()=>{if(active)setError(true);}).finally(()=>{if(active)setBusy(false);});
    return ()=>{active=false;};
  },[read,path]);
  return <section><h4>Guest trees in this garden</h4>
    <ul>{trees.map(tree=><li key={tree.id}><strong>{tree.name}</strong>{tree.imageUrl && <img src={tree.imageUrl} alt={tree.name} width={120}/>}
      {tree.body && <p className="plain-story">{tree.body}</p>}</li>)}</ul>
    {next && <button disabled={busy} onClick={()=>{
      setBusy(true);setError(false);void read(path+'&after='+encodeURIComponent(next)).then(result=>{
        const page=result as {trees:Tree[];next:string|null};setTrees(old=>[...old,...page.trees.filter(tree=>!old.some(item=>item.id===tree.id))]);setNext(page.next);
      }).catch(()=>setError(true)).finally(()=>setBusy(false));
    }}>Load more trees</button>}
    {error && <p role="alert">Could not load the garden. Please try again.</p>}
  </section>;
}
