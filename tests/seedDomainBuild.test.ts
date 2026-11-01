import {expect,it} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {buildSeedDomain} from '../seed/build-domain.mjs';
import {judgeBlockBirth,blockSignaturePayload,blockSignaturePreimage} from '../src/domain/chain/birth';
import {computeCanonicalHash} from '../src/domain/chain/verify';
it('builds standalone Node chain rules from the same domain and preserves judgment, signature and hash bytes',async()=>{
  const output=await mkdtemp(join(tmpdir(),'seed-domain-test-'));
  try {
    const {path,sources}=await buildSeedDomain(output);
    expect(sources.every((source:string)=>source.startsWith('src/domain/'))).toBe(true);
    const facts={on:'tree' as const,minterUid:'alice',isStaff:false,bearer:{exists:true,carer:true,latestHash:'head',blockHeight:3,visibility:'private'},block:{type:'tree_growth',body:'Care 🌱'}};
    const payload=blockSignaturePayload({on:'tree',bearerId:'tree',previousHash:'head',content:{body:'Care 🌱',type:'tree_growth'},signerUid:'alice',keyFingerprint:'a'.repeat(64),epochId:'anchor'});
    const record={lid:'01900000-0000-7000-8000-000000000001',type:'tree_growth',body:'Care 🌱',authorId:'alice',authorSignature:{sig:'proof'}};
    const script=`import * as law from ${JSON.stringify(pathToFileURL(path).href)};
      const facts=${JSON.stringify(facts)},payload=${JSON.stringify(payload)},record=${JSON.stringify(record)};
      console.log(JSON.stringify({judgment:law.judgeBlockBirth(facts),signature:law.blockSignaturePreimage(payload),
        hash:await law.computeCanonicalHash('head',42,record),tampered:await law.computeCanonicalHash('head',42,{...record,body:'changed'}),
        denied:law.judgeBlockBirth({...facts,bearer:{...facts.bearer,carer:false}})}));`;
    const actual=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8'}));
    expect(actual.judgment).toEqual(judgeBlockBirth(facts));expect(actual.judgment.content.visibility).toBe('circle');
    expect(actual.signature).toBe(blockSignaturePreimage(payload));
    expect(actual.hash).toBe(await computeCanonicalHash('head',42,record));expect(actual.tampered).not.toBe(actual.hash);
    expect(actual.denied).toEqual({outcome:'reject',refusal:'block_not_carer'});
  }finally{await rm(output,{recursive:true,force:true});}
});
