import {lineageOfCopy} from './eventLineage';
import {publicNameOf} from './publicName';

// A new occurrence carries the gathering's words and frame, never its previous
// author, identity, signatures, participation or remembered community formation.
export const COPIED_EVENT_FIELDS=['title','body','content','imageUrl','imageUrls','eventDate','eventEndDate','eventLocation','eventMaxParticipants','webLinks','visibility','communityId','communityName','domain'] as const;
export function eventDuplicationPayload({uid,parentId,parent,profile,isHand}:{uid:string;parentId:string;parent:Record<string,unknown>|null;profile:Record<string,unknown>;isHand:boolean}) {
  if(!parent||parent.type!=='event')return {outcome:'reject' as const,refusal:'event_circle_not_event' as const};
  if(!uid||!isHand)return {outcome:'reject' as const,refusal:'event_duplicate_not_hand' as const};
  const generation=parent.generation??0;
  if((typeof generation!=='number'&&typeof generation!=='string')||(typeof generation==='string'&&!/^[0-9]+$/.test(generation))
    ||!Number.isSafeInteger(Number(generation))||Number(generation)<0)return {outcome:'reject' as const,refusal:'event_invalid_lineage' as const};
  const lineage=lineageOfCopy({id:parentId,lineageRootId:typeof parent.lineageRootId==='string'?parent.lineageRootId:undefined,generation:Number(generation)});
  if(!Number.isSafeInteger(lineage.generation)||lineage.generation<1)return {outcome:'reject' as const,refusal:'event_invalid_lineage' as const};
  const body:Record<string,unknown>={};
  for(const key of COPIED_EVENT_FIELDS)if(parent[key]!==undefined&&parent[key]!==null)body[key]=structuredClone(parent[key]);
  const displayName=typeof profile.displayName==='string'&&profile.displayName?profile.displayName:typeof profile.name==='string'?profile.name:undefined;
  const payload:Record<string,unknown>&{visibility:string;authorId:string}={...body,type:'event',visibility:typeof parent.visibility==='string'?parent.visibility:'public',authorId:uid,
    authorName:publicNameOf({displayName,anonymous:!!profile.anonymous})||'A being',
    ...(typeof profile.photoURL==='string'&&profile.photoURL?{authorPhoto:profile.photoURL}:{}),...lineage};
  return {outcome:'copy' as const,payload,root:typeof parent.communityId==='string'&&parent.communityId?'COMMUNITY_EVENT':'EVENT'};
}
