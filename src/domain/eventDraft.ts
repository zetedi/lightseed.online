import {spanProblem} from './eventSpan';
import {webLinksOf} from './webLink';
// The request adapter bounds text/arrays first. Here the shared date/link laws
// and the authoritative place determine which stored event content may stand.
export function eventDraftContent(draft:{title:string;body:string;eventDate:string;eventEndDate:string;eventLocation:string;
  eventMaxParticipants:number|null;webLinks:unknown;visibility:string},community:boolean) {
  if(!['public','private',community?'community':'node'].includes(draft.visibility))return {outcome:'reject' as const,refusal:'event_invalid_visibility'};
  if([draft.eventDate,draft.eventEndDate].some(value=>value&&!Number.isFinite(Date.parse(value))))return {outcome:'reject' as const,refusal:'event_invalid_date'};
  const span=spanProblem(draft.eventDate,draft.eventEndDate);
  if(span)return {outcome:'reject' as const,refusal:span};
  const links=webLinksOf(draft.webLinks);
  if(links.problem)return {outcome:'reject' as const,refusal:links.problem};
  return {outcome:'write' as const,content:{title:draft.title,body:draft.body,content:draft.body,eventDate:draft.eventDate,eventEndDate:draft.eventEndDate,
    eventLocation:draft.eventLocation,eventMaxParticipants:draft.eventMaxParticipants,webLinks:links.links,visibility:draft.visibility}};
}
