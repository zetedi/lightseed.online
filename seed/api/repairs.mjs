// THE LAST HANDS (ring 2026-11-03): the origin's one-time Firestore backfills — the superadmin console's
// sweeps and the staff page's index audit — grown on the independent node as the keeper's own audits
// and repairs, with the origin's names and report shapes. A SERVICE in the API's layers: the facts
// come from the repository (seed/api/db/repairs.mjs, migration 061), the law runs here (a vision's
// genesis sealed from its own birth with the shared chain law; a lid minted from a record's birth
// moment; the alignment a sync block names), and the apply goes back through the repository, each
// statement judged by the soil as the keeper. Sealed blocks are never touched — their type,
// visibility, lid and matchId are canonical content — and are reported as skipped, as the origin did.
import {createBlock,alignmentForSyncBlock} from '../generated/chain.mjs';
import {uuidv7} from '../../src/domain/uuidv7.mjs';

/** @typedef {import('./db/repairs.mjs').RepairsRepository} RepairsRepository */

// A record's birth moment as the origin read it: its createdAt, else now.
const momentOf=value=>{const ms=typeof value==='string'?Date.parse(value):Number.NaN;return Number.isFinite(ms)?ms:Date.now();};

/** @param {{repository: RepairsRepository, uid: string, command: {kind: string, apply?: boolean}}} options */
export async function repairCommand({repository,uid,command}) {
  switch(command.kind) {
    case 'pulse_visibility':return repository.pulseVisibility(uid);
    case 'pulse_type_casing':return repository.pulseTypeCasing(uid);
    case 'tree_visibility':return repository.treeVisibility(uid);
    case 'vision_chains': {
      // The twin awakens: each chainless vision's genesis is sealed from its OWN birth time, so the id and the chain root agree.
      const {due,chained}=await repository.visionChainsDue(uid);
      let updated=0;
      for(const vision of due) {
        const genesisHash=await createBlock('0',{msg:'Birth'},momentOf(vision.createdAt));
        if(await repository.visionChain(uid,vision.id,genesisHash))updated++;
      }
      return {updated,skipped:chained+(due.length-updated)};
    }
    case 'lids': {
      // A true name minted from the record's birth moment, so the time inside the name is the being's own.
      const {due,skippedSealed}=await repository.lidsDue(uid);
      /** @type {Record<string, number>} */
      const counts={};
      let total=0;
      for(const record of due) {
        if(await repository.lid(uid,record.collection,record.id,uuidv7(momentOf(record.createdAt)))) {counts[record.collection]=(counts[record.collection]??0)+1;total++;}
      }
      return {...counts,total,skippedSealed};
    }
    case 'match_ids': {
      const {due,skippedSealed}=await repository.matchIdsDue(uid);
      let stamped=0,unresolved=0;
      for(const block of due) {
        if(!block.lifetreeId){unresolved++;continue;}
        const alignments=(await repository.alignmentsOfTree(uid,block.lifetreeId)).map(a=>({id:a.id,status:a.status??'',createdAtMs:momentOf(a.createdAt)}));
        const at=typeof block.createdAt==='string'&&Number.isFinite(Date.parse(block.createdAt))?Date.parse(block.createdAt):undefined;
        const match=alignmentForSyncBlock(alignments,at);
        if(match && await repository.matchId(uid,block.id,match.id))stamped++;else unresolved++;
      }
      return {stamped,unresolved,skippedSealed};
    }
    case 'lid_index': {
      // On this soil the index is the records themselves: nothing to write, nothing to disagree; a name on two beings is the collision.
      const {nameless,twins}=await repository.lidIndex(uid);
      return {apply:command.apply===true,wrote:0,nameless,disagreements:[],collisions:twins.map(twin=>({address:twin.addresses.join(' | '),lids:[twin.lid]}))};
    }
    default:throw Object.assign(new Error('invalid_repair'),{code:'22023'});
  }
}
