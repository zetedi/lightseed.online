import {build} from 'esbuild';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,rename,rm} from 'node:fs/promises';
import {dirname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export async function buildSeedDomain(output=resolve(root,'seed/generated')) {
  const result=await build({absWorkingDir:root,entryPoints:['src/domain/seedChainRuntime.ts'],bundle:true,
    platform:'node',target:'node22',format:'esm',write:false,metafile:true,logLevel:'silent'});
  // Fail the build if a future domain change pulls in an adapter, SDK, credential
  // loader, app service or package. The output must stand alone in the runtime.
  const domain=resolve(root,'src/domain')+sep;
  if(Object.keys(result.metafile.inputs).some(path=>!resolve(root,path).startsWith(domain))
    || Object.values(result.metafile.outputs).some(file=>file.imports.length))throw new Error('independent_domain_boundary_violation');
  const exports=Object.values(result.metafile.outputs).flatMap(file=>file.exports);
  if(['judgeBlockBirth','blockRecordOf','wateringResetOf','judgeBlockSignature','blockSignaturePayload','blockSignaturePreimage',
    'judgeEventCircle','eventCircleDraft','eventCircleMemberUids','rootsABeing','eventDraftContent','eventDuplicationPayload','judgeAlignmentAcceptance','alignmentTwinContent','beingPath','offeringProblem','createBlock','judgeOfferingAccept','offeringTwinRecords','publicNameOf','isBlockSignatureClaim','touchMemoryOf','computeCanonicalHash','BLOCK_HASH_VERSION','blockContent'].some(name=>!exports.includes(name)))throw new Error('independent_domain_export_missing');
  await mkdir(output,{recursive:true});
  const path=resolve(output,'chain.mjs');
  const temporary=resolve(output,'chain-'+randomUUID()+'.tmp');
  try {await writeFile(temporary,result.outputFiles[0].contents);await rename(temporary,path);}
  finally{await rm(temporary,{force:true});}
  return {path,sources:Object.keys(result.metafile.inputs).sort()};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  await buildSeedDomain();console.log('Built independent chain rules from shared domain sources.');
}
