// One portable name per lookup. Local addresses are discovered through current
// visibility rules; the finding aid never grants access or repairs identity.
export function seedBeingQuery(params) {
  const lid=params.get('lid');
  if(params.size!==1||typeof lid!=='string'||!/^([0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/.test(lid))return null;
  return {kind:'being',lid};
}
export function seedBeingResult(candidates) {
  if(candidates.length>1)throw Object.assign(new Error('Portable identity needs review'),{code:'LID_AMBIGUOUS'});
  return {being:candidates[0]??null};
}
