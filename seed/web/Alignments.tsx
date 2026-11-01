import {useEffect,useRef,useState} from 'react';
import type {createSeedSession} from '../../src/services/independent/session';
import {OfferingBeingPicker,type OfferingBeing} from './OfferingBeingPicker';
type Alignment={id:string;status:string;initiatorUid:string;targetUid:string;initiatorTreeId:string;targetTreeId:string;messages?:{by:string;text:string;at:string}[]};
type Pulse={id:string;title?:string;body?:string;authorId?:string;lifetreeId?:string};
type Session=ReturnType<typeof createSeedSession>;
function AlignmentTreeName({session,id}:{session:Session;id:string}) {
  const [name,setName]=useState<string|null>(null);
  useEffect(()=>{
    let active=true;const identity=session.snapshot();setName(null);
    void session.read('/v1/trees?id='+encodeURIComponent(id)).then(value=>{
      const tree=(value as {tree:OfferingBeing|null}).tree;
      if(active&&session.snapshot()===identity)setName(tree?.name||'Unnamed tree');
    }).catch(()=>{if(active)setName('Private or unavailable tree');});
    return()=>{active=false;};
  },[session,id]);
  return <span>{name??'Loading tree…'}</span>;
}
export function Alignments({session,uid}:{session:Session;uid:string}) {
  const [items,setItems]=useState<Alignment[]>([]),[next,setNext]=useState<string|null>(null);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[revision,setRevision]=useState(0);
  const [source,setSource]=useState<OfferingBeing|null>(null),[target,setTarget]=useState<OfferingBeing|null>(null);
  const [pulses,setPulses]=useState<Pulse[]>([]),[pulseNext,setPulseNext]=useState<string|null>(null),[pulseId,setPulseId]=useState('');
  const [notes,setNotes]=useState<Record<string,string>>({});
  const [review,setReview]=useState<{alignment:Alignment;identity:ReturnType<Session['snapshot']>;action:'accept'|'reject'}|null>(null);
  const mounted=useRef(true),flight=useRef(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const current=(identity:ReturnType<Session['snapshot']>)=>mounted.current&&session.snapshot()===identity;
  const listPath='/v1/alignments?participant=me&limit=20';
  useEffect(()=>{
    let active=true;const identity=session.snapshot();setBusy(true);
    void session.read(listPath).then(value=>{if(active&&session.snapshot()===identity){const page=value as {alignments:Alignment[];next:string|null};setItems(page.alignments);setNext(page.next);}})
      .catch(()=>{if(active)setMessage('Alignments could not be loaded. Refresh to try again.');}).finally(()=>{if(active)setBusy(false);});
    return()=>{active=false;};
  },[session,revision]);
  useEffect(()=>{
    let active=true;const identity=session.snapshot();setPulses([]);setPulseNext(null);setPulseId('');
    if(target)void session.read('/v1/pulses?tree='+encodeURIComponent(target.id)+'&limit=20').then(value=>{
      if(active&&session.snapshot()===identity){const page=value as {pulses:Pulse[];next:string|null};setPulses(page.pulses);setPulseNext(page.next);}
    }).catch(()=>{if(active)setMessage('This tree’s pulses could not be loaded. Choose the tree again.');});
    return()=>{active=false;};
  },[session,target]);
  const submit=(command:object,identity=session.snapshot())=>{
    if(flight.current||identity.status!=='authenticated'||identity.uid!==uid||!current(identity))return;
    flight.current=true;setBusy(true);setReview(null);setMessage('');
    void session.alignmentCommand(command).then(()=>{
      if(!current(identity))return;
      setMessage('Saved. The list has been refreshed.');setNotes({});setRevision(value=>value+1);
    }).catch(()=>{if(current(identity))setMessage('The change was not confirmed. Refresh and check the recorded status before trying again. Nothing is retried automatically.');})
      .finally(()=>{flight.current=false;if(mounted.current)setBusy(false);});
  };
  const beginReview=(item:Alignment,action:'accept'|'reject')=>{
    const identity=session.snapshot();if(flight.current||identity.status!=='authenticated'||identity.uid!==uid)return;
    setBusy(true);setReview(null);setMessage('');
    void session.read('/v1/alignments?id='+encodeURIComponent(item.id)).then(value=>{
      if(!current(identity))return;const alignment=(value as {alignment:Alignment|null}).alignment;
      if(!alignment||alignment.status!=='PENDING'||alignment.targetUid!==uid){setMessage('This proposal is no longer waiting for your answer. Refresh the list.');return;}
      setReview({alignment,identity,action});
    }).catch(()=>{if(current(identity))setMessage('The proposal could not be reviewed. Refresh to try again.');}).finally(()=>{if(mounted.current)setBusy(false);});
  };
  return <section><h2>Alignments</h2>
    <p>Propose a connection from a tree you care for to the author of another tree’s pulse. Both people must still care for their trees when the proposal is accepted.</p>
    <form onSubmit={event=>{event.preventDefault();if(source&&target&&pulseId&&source.id!==target.id)submit({action:'propose',fromTreeId:source.id,targetPulseId:pulseId});}}>
      <h3>Propose an alignment</h3>
      <OfferingBeingPicker session={session} kind="source" label="Your tree" value={source} onChange={setSource} disabled={busy} required/>
      <OfferingBeingPicker session={session} kind="tree" label="Receiving tree" value={target} onChange={setTarget} disabled={busy} required/>
      <label>Matched pulse<select required disabled={busy||!target} value={pulseId} onChange={event=>setPulseId(event.target.value)}>
        <option value="">Choose a pulse…</option>
        {pulses.filter(pulse=>pulse.lifetreeId===target?.id&&pulse.authorId).map(pulse=><option key={pulse.id} value={pulse.id}>{pulse.title||pulse.body?.slice(0,100)||'Untitled pulse'}</option>)}
      </select></label>
      {pulseNext&&target&&<button type="button" disabled={busy} onClick={()=>{
        const identity=session.snapshot(),targetId=target.id;setBusy(true);
        void session.read('/v1/pulses?tree='+encodeURIComponent(targetId)+'&limit=20&after='+encodeURIComponent(pulseNext)).then(value=>{
          if(!current(identity))return;const page=value as {pulses:Pulse[];next:string|null};
          setPulses(old=>[...old,...page.pulses.filter(pulse=>!old.some(item=>item.id===pulse.id))]);setPulseNext(page.next);
        }).catch(()=>{if(current(identity))setMessage('More pulses could not be loaded.');}).finally(()=>{if(mounted.current)setBusy(false);});
      }}>Load more pulses</button>}
      {source&&source.id===target?.id&&<p>Choose two different trees.</p>}
      <p>The proposal and notes are visible to both participants and node staff. Acceptance adds a permanent record to each tree.</p>
      <button disabled={busy||!source||!target||!pulseId||source.id===target.id}>Send proposal</button>
    </form>
    <button disabled={busy} onClick={()=>{setReview(null);setMessage('');setRevision(value=>value+1);}}>Refresh alignments</button>
    {items.map(item=><article key={item.id}>
      <h3>{item.targetUid===uid?'Incoming alignment':'Your proposal'}</h3><p>Status: {item.status}</p>
      <p>From <AlignmentTreeName session={session} id={item.initiatorTreeId}/> to <AlignmentTreeName session={session} id={item.targetTreeId}/>.</p>
      {item.messages?.map((note,index)=><p className="plain-story" key={index}><strong>{note.by===uid?'You':'Other participant'}:</strong> {note.text}</p>)}
      {item.status==='PENDING'&&<form onSubmit={event=>{event.preventDefault();if(notes[item.id]?.trim())submit({action:'note',id:item.id,text:notes[item.id]});}}>
        <label>Note for this alignment<textarea maxLength={2000} required disabled={busy} value={notes[item.id]??''} onChange={event=>setNotes(old=>({...old,[item.id]:event.target.value}))}/></label>
        <button disabled={busy||!notes[item.id]?.trim()}>Add note</button>
      </form>}
      {item.status==='PENDING'&&item.targetUid===uid&&<div>
        <button disabled={busy} onClick={()=>beginReview(item,'accept')}>Review acceptance</button>
        <button disabled={busy} onClick={()=>beginReview(item,'reject')}>Review rejection</button>
      </div>}
      {review?.alignment.id===item.id&&<div>
        <h4>{review.action==='accept'?'Accept this alignment?':'Reject this alignment?'}</h4>
        <p>{review.action==='accept'?'This creates permanent agreement records on both trees. The node checks both people’s current authority. No light is transferred.':'This records a final rejection. It does not add agreement records to the trees.'}</p>
        {review.alignment.messages?.map((note,index)=><p className="plain-story" key={index}>{note.text}</p>)}
        <button disabled={busy} onClick={()=>submit({action:review.action,id:review.alignment.id},review.identity)}>Confirm {review.action==='accept'?'acceptance':'rejection'}</button>
        <button disabled={busy} onClick={()=>setReview(null)}>Cancel</button>
      </div>}
    </article>)}
    {next&&<button disabled={busy} onClick={()=>{
      const identity=session.snapshot();setBusy(true);
      void session.read(listPath+'&after='+encodeURIComponent(next)).then(value=>{
        if(!current(identity))return;const page=value as {alignments:Alignment[];next:string|null};
        setItems(old=>[...old,...page.alignments.filter(item=>!old.some(prior=>prior.id===item.id))]);setNext(page.next);
      }).catch(()=>{if(current(identity))setMessage('More alignments could not be loaded.');}).finally(()=>{if(mounted.current)setBusy(false);});
    }}>Load more alignments</button>}
    <p role="status">{message}</p>
  </section>;
}
