// Public Ed25519 SPKI only. Private key material never belongs in an API request.
export function seedSigningCommand(value) {
  if(value && typeof value==='object' && !Array.isArray(value) && value.action==='activate_recovery') {
    return Object.keys(value).every(key=>['action','eventId'].includes(key)) && typeof value.eventId==='string' && /^[A-Za-z0-9_-]{1,128}$/.test(value.eventId)
      ? {action:'activate_recovery',eventId:value.eventId}:null;
  }
  if(value && typeof value==='object' && !Array.isArray(value) && value.action==='witness_recovery') {
    if(Object.keys(value).some(key=>!['action','targetUid','eventId','sig','pubkey','keyFingerprint','epochId'].includes(key))
      || typeof value.targetUid!=='string' || !value.targetUid || value.targetUid.length>128 || /[\u0000-\u001f\u007f]/.test(value.targetUid)
      || ['eventId','epochId'].some(key=>typeof value[key]!=='string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value[key]))
      || !seedSigningCommand({action:'anchor',publicKeyB64:value.pubkey})
      || typeof value.keyFingerprint!=='string' || !/^[a-f0-9]{64}$/.test(value.keyFingerprint)
      || typeof value.sig!=='string' || !/^[A-Za-z0-9+/]{86}==$/.test(value.sig))return null;
    try {if(btoa(atob(value.sig))!==value.sig)return null;}catch{return null;}
    return {...value};
  }
  if(value && typeof value==='object' && !Array.isArray(value) && value.action==='begin_recovery') {
    if(Object.keys(value).some(key=>!['action','eventId','toPubkey','toFingerprint','newSig'].includes(key))
      || typeof value.eventId!=='string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value.eventId)
      || !seedSigningCommand({action:'anchor',publicKeyB64:value.toPubkey})
      || typeof value.toFingerprint!=='string' || !/^[a-f0-9]{64}$/.test(value.toFingerprint)
      || typeof value.newSig!=='string' || !/^[A-Za-z0-9+/]{86}==$/.test(value.newSig))return null;
    try {if(btoa(atob(value.newSig))!==value.newSig)return null;}catch{return null;}
    return {...value};
  }
  if(value && typeof value==='object' && !Array.isArray(value) && value.action==='rotate') {
    if(Object.keys(value).some(key=>!['action','eventId','lid','fromPubkey','toPubkey','fromFingerprint','toFingerprint','oldSig','newSig'].includes(key))
      || typeof value.eventId!=='string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value.eventId)
      || typeof value.lid!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.lid)
      || !seedSigningCommand({action:'anchor',publicKeyB64:value.fromPubkey})
      || !seedSigningCommand({action:'anchor',publicKeyB64:value.toPubkey})
      || ['fromFingerprint','toFingerprint'].some(key=>typeof value[key]!=='string' || !/^[a-f0-9]{64}$/.test(value[key]))
      || value.fromFingerprint===value.toFingerprint
      || ['oldSig','newSig'].some(key=>typeof value[key]!=='string' || !/^[A-Za-z0-9+/]{86}==$/.test(value[key])))return null;
    try {if(['oldSig','newSig'].some(key=>btoa(atob(value[key]))!==value[key]))return null;}catch{return null;}
    return {...value};
  }
  if(value && typeof value==='object' && !Array.isArray(value) && value.action==='freeze') {
    if(Object.keys(value).some(key=>!['action','epochId','fingerprint','suspectedSinceMs'].includes(key))
      || typeof value.epochId!=='string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value.epochId)
      || typeof value.fingerprint!=='string' || !/^[a-f0-9]{64}$/.test(value.fingerprint)
      || ('suspectedSinceMs' in value && (!Number.isSafeInteger(value.suspectedSinceMs) || value.suspectedSinceMs<0 || value.suspectedSinceMs>253402300799999)))return null;
    return {...value};
  }
  if(!value || typeof value!=='object' || Array.isArray(value) || value.action!=='anchor'
    || Object.keys(value).some(key=>!['action','publicKeyB64'].includes(key))
    || typeof value.publicKeyB64!=='string' || !/^MCowBQYDK2VwAyEA[A-Za-z0-9+/]{43}=$/.test(value.publicKeyB64))return null;
  try {if(btoa(atob(value.publicKeyB64))!==value.publicKeyB64)return null;}catch{return null;}
  return {action:'anchor',publicKeyB64:value.publicKeyB64};
}
export function seedSigningQuery(params) {
  const id=params.get('id');
  return params.size===1 && typeof id==='string' && id.length>0 && id.length<=128 && !/[\u0000-\u001f\u007f]/.test(id)
    ? {kind:'signingIdentity',id}:null;
}

export function seedSigningHistoryQuery(params) {
  const id=params.get('id'),after=params.get('after'),kind=params.get('kind')??'events';
  if([...params.keys()].some(key=>!['id','kind','after','limit'].includes(key) || params.getAll(key).length!==1)
    || !seedSigningQuery(new URLSearchParams({id:id??''})) || !['keys','events'].includes(kind)
    || (after!==null && (!after || after.length>512 || /[\u0000-\u001f\u007f]/.test(after)))
    || (params.has('limit') && !/^(?:[1-9]|[1-9][0-9]|100)$/.test(params.get('limit'))))return null;
  return {kind:'signingHistory',id,collection:kind,after,limit:Number(params.get('limit')??50)};
}

export function seedRotationPreimage(uid,command) {
  return ['lifeseed.key-event.v1','lifeseed.key-rotation.v1',uid,command.lid,command.eventId,command.fromFingerprint,command.toFingerprint].join('\n');
}

export function seedRecoveryPreimage(claim) {
  return ['lifeseed.key-event.v1','lifeseed.key-recovery.v1',claim.uid,claim.lid,claim.eventId,claim.fromFingerprint,claim.toFingerprint,String(claim.suspectedSinceMs)].join('\n');
}

export function seedRecoveryWitnessPreimage(claim,witnessUid) {
  return ['lifeseed.key-event.v1','lifeseed.key-recovery.v1','witness',witnessUid,claim.uid,claim.lid,claim.eventId,claim.fromFingerprint,claim.toFingerprint,String(claim.suspectedSinceMs)].join('\n');
}

export function seedRecoveryWitnessQuery(params) {
  const id=params.get('id'),event=params.get('event'),after=params.get('after');
  if([...params.keys()].some(key=>!['id','event','after','limit'].includes(key) || params.getAll(key).length!==1)
    || !seedSigningQuery(new URLSearchParams({id:id??''}))
    || typeof event!=='string' || !/^[A-Za-z0-9_-]{1,128}$/.test(event)
    || (after!==null && (!after || after.length>512 || /[\u0000-\u001f\u007f]/.test(after)))
    || (params.has('limit') && !/^(?:[1-9]|[1-9][0-9]|100)$/.test(params.get('limit'))))return null;
  return {kind:'recoveryWitnesses',id,event,after,limit:Number(params.get('limit')??50)};
}
