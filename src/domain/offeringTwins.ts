import type {OfferedToKind} from './offering';

// Structural agreement records. Prose belongs to the caller; identity, reciprocal
// references and visibility follow the accepted offering. The transaction supplies
// current standing, both chain positions, IDs and seals separately.
export interface OfferingTwinSource {
  id:string;lid:string;authorId:string;authorName:string;domain:string;visibility:string;
  toKind:OfferedToKind;toId:string;fromTreeId:string;
}
export function offeringTwinRecords(source:OfferingTwinSource,acceptor:{uid:string;name:string},
  prose:{title:string;fromBody:string;toBody:string}) {
  const shared={type:'standard',title:prose.title,offeringId:source.id,offeringLid:source.lid,
    domain:source.domain,visibility:source.visibility};
  return {
    from:{...shared,lifetreeId:source.fromTreeId,body:prose.fromBody,offeringRole:'from',
      offeringTwinOf:source.toId,offeringTwinKind:source.toKind,authorId:source.authorId,authorName:source.authorName},
    to:{...shared,...(source.toKind==='vision'?{visionId:source.toId}:{lifetreeId:source.toId}),
      body:prose.toBody,offeringRole:'to',offeringTwinOf:source.fromTreeId,offeringTwinKind:'tree',
      authorId:acceptor.uid,authorName:acceptor.name},
  };
}
