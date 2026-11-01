import {OfferingForm,type OfferingDraftRecord} from './OfferingForm';
import {useEffect,useState} from 'react';
import {offeringStatusOf,isOfferedToKind} from '../../src/domain/offering';
import type {createSeedSession} from '../../src/services/independent/session';
import {seedPublicRead} from '../../src/services/independent/public';

type Offering=OfferingDraftRecord & {id:string;type?:string;title?:string;body?:string;authorId?:string;offeredToKind?:unknown;
  offeredToId?:string;offeringFromTreeId?:string;offeringStatus?:unknown;offeringActive?:boolean};
export function Offerings({session,uid}:{session:ReturnType<typeof createSeedSession>;uid:string|null}) {
  const [items,setItems]=useState<Offering[]>([]),[next,setNext]=useState<string|null>(null),[busy,setBusy]=useState(false);
  const [message,setMessage]=useState(''),[revision,setRevision]=useState(0);
  const [withdrawId,setWithdrawId]=useState<string|null>(null);
  const [draft,setDraft]=useState<{mode:'create'}|{mode:'edit';offering:OfferingDraftRecord}|null>(null);
  const [review,setReview]=useState<{offering:Offering;identity:ReturnType<typeof session.snapshot>}|null>(null);
  const read=uid?session.read:seedPublicRead,path='/v1/pulses?type=offering&limit=20';
  useEffect(()=>{
    let active=true;setBusy(true);
    void read(path).then(value=>{if(active){const page=value as {pulses:Offering[];next:string|null};setItems(page.pulses);setNext(page.next);}})
      .catch(()=>{if(active)setMessage('Offerings could not be loaded. Try refreshing.');}).finally(()=>{if(active)setBusy(false);});
    return ()=>{active=false;};
  },[read,revision]);
  const canReview=(offer:Offering)=>!!uid && offer.type==='offering' && typeof offer.authorId==='string' && offer.authorId!==uid
    && isOfferedToKind(offer.offeredToKind) && !!offer.offeredToId && !!offer.offeringFromTreeId
    && offeringStatusOf(offer)==='open';
  const change=(command:{action:'set_active'|'withdraw'|'decline';id:string;active?:boolean})=>{
    const identity=session.snapshot();if(identity.status!=='authenticated' || identity.uid!==uid)return;
    setBusy(true);setMessage('');setReview(null);setWithdrawId(null);
    void session.offeringCommand(command).then(()=>{
      if(session.snapshot()!==identity)return;
      setMessage(command.action==='withdraw'?'Offering withdrawn.':command.action==='decline'?'Offering declined.':command.active?'Offering reopened.':'Offering paused.');
      setRevision(value=>value+1);
    }).catch(()=>{if(session.snapshot()===identity)setMessage('The change was not confirmed. Refresh the offering before trying again. Nothing is retried automatically.');})
      .finally(()=>setBusy(false));
  };
  return <section><h2>Offerings</h2>
    <p>Accept an offering only when you stand for its receiving tree or vision. Acceptance records the agreement on both chains; it does not transfer light.</p>
    {uid && !draft && <button disabled={busy} onClick={()=>{setReview(null);setWithdrawId(null);setDraft({mode:'create'});}}>Create an offering</button>}
    {uid && draft && <OfferingForm key={draft.mode==='edit'?draft.offering.id:'create'} session={session} uid={uid}
      offering={draft.mode==='edit'?draft.offering:undefined} onCancel={()=>setDraft(null)}
      onSaved={()=>{setDraft(null);setMessage('Offering saved.');setRevision(value=>value+1);}}/>}
    <button disabled={busy} onClick={()=>{setReview(null);setWithdrawId(null);setMessage('');setRevision(value=>value+1);}}>Refresh offerings</button>
    {items.map(offer=><article key={offer.id}>
      <h3>{typeof offer.title==='string'?offer.title:'Offering'}</h3>
      {typeof offer.body==='string' && <p className="plain-story">{offer.body}</p>}
      {(Array.isArray(offer.imageUrls)?offer.imageUrls:typeof offer.imageUrl==='string'?[offer.imageUrl]:[]).filter(url=>typeof url==='string'&&url).map((url,index)=><img key={url} src={url} alt={'Offering picture '+(index+1)} width={120} referrerPolicy="no-referrer"/>)}
      <p>Status: {offeringStatusOf(offer)??(offer.offeringActive===false?'resting':'listing')}</p>
      {offer.offeringActive===false && <p>This listing is paused.</p>}
      {uid && offer.authorId===uid && <div>
        {offeringStatusOf(offer)!=='accepted' && <button disabled={busy||!!draft} onClick={()=>{
          const identity=session.snapshot();if(identity.status!=='authenticated'||identity.uid!==uid)return;
          setBusy(true);setMessage('');setReview(null);setWithdrawId(null);
          void session.read('/v1/pulses?id='+encodeURIComponent(offer.id)).then(value=>{
            if(session.snapshot()!==identity)return;const current=(value as {pulse:Offering|null}).pulse;
            if(!current||current.authorId!==uid||offeringStatusOf(current)==='accepted'){setMessage('This offering can no longer be edited. Refresh the list.');return;}
            setDraft({mode:'edit',offering:current});
          }).catch(()=>setMessage('The offering could not be loaded for editing.')).finally(()=>setBusy(false));
        }}>Edit offering</button>}
        <button disabled={busy} onClick={()=>change({action:'set_active',id:offer.id,active:offer.offeringActive===false})}>{offer.offeringActive===false?'Reopen listing':'Pause listing'}</button>
        {offeringStatusOf(offer)==='open' && (withdrawId===offer.id?<div>
          <p>Withdraw this offering? It will remain recorded and can no longer be accepted.</p>
          <button disabled={busy} onClick={()=>change({action:'withdraw',id:offer.id})}>Confirm withdrawal</button>
          <button disabled={busy} onClick={()=>setWithdrawId(null)}>Keep offering</button>
        </div>:<button disabled={busy} onClick={()=>{setReview(null);setWithdrawId(offer.id);}}>Withdraw offering</button>)}
      </div>}
      {review?.offering.id===offer.id ? <div>
        <h4>Review acceptance</h4><p>{review.offering.title??'Offering'}</p>
        <p className="plain-story">{review.offering.body??''}</p>
        <p>Offered by account <code>{review.offering.authorId}</code>, from tree <code>{review.offering.offeringFromTreeId}</code>.</p>
        <p>Receiving {String(review.offering.offeredToKind)}: <code>{review.offering.offeredToId}</code>.</p>
        <p>Acceptance creates permanent agreement records on both chains. Declining records your answer without adding those records. The node checks your current authority.</p>
        <button disabled={busy || review.offering.offeringActive===false} onClick={()=>{
          const attempt=review;setReview(null);setMessage('');
          if(session.snapshot()!==attempt.identity){setMessage('Your account changed. Refresh before continuing.');return;}
          setBusy(true);
          void session.offeringCommand({action:'accept',id:attempt.offering.id}).then(()=>{
            if(session.snapshot()!==attempt.identity)return;
            setMessage('Offering accepted. Both chain records were saved.');setRevision(value=>value+1);
          }).catch(()=>{if(session.snapshot()===attempt.identity)setMessage('Acceptance was not confirmed. Refresh this offering and check its status before trying again. Your authority may have changed, or the answer may already have been recorded. Nothing is retried automatically.');})
            .finally(()=>setBusy(false));
        }}>Confirm acceptance</button>
        <button disabled={busy} onClick={()=>{
          if(session.snapshot()!==review.identity){setReview(null);setMessage('Your account changed. Refresh before continuing.');return;}
          change({action:'decline',id:review.offering.id});
        }}>Decline this offering</button>
        <button disabled={busy} onClick={()=>setReview(null)}>Cancel</button>
      </div>:canReview(offer) && <button disabled={busy} onClick={()=>{
        const identity=session.snapshot();if(identity.status!=='authenticated' || identity.uid!==uid)return;
        setBusy(true);setMessage('');setReview(null);
        void session.read('/v1/pulses?id='+encodeURIComponent(offer.id)).then(value=>{
          if(session.snapshot()!==identity)return;
          const current=(value as {pulse:Offering|null}).pulse;
          if(!current || current.id!==offer.id || !canReview(current)) {setMessage('This offering is no longer open for acceptance. Refresh the list.');return;}
          setReview({offering:current,identity});
        }).catch(()=>setMessage('The offering could not be reviewed. Refresh before continuing.')).finally(()=>setBusy(false));
      }}>Review acceptance</button>}
    </article>)}
    {next && <button disabled={busy} onClick={()=>{
      const identity=session.snapshot();setBusy(true);setMessage('');
      void read(path+'&after='+encodeURIComponent(next)).then(value=>{
        if(session.snapshot()!==identity)return;const page=value as {pulses:Offering[];next:string|null};
        setItems(old=>[...old,...page.pulses.filter(item=>!old.some(existing=>existing.id===item.id))]);setNext(page.next);
      }).catch(()=>setMessage('More offerings could not be loaded.')).finally(()=>setBusy(false));
    }}>Load more offerings</button>}
    {!busy && !items.length && <p>No visible offerings on this page.</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
