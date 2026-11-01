// Envelope only; the shared chain birth/signature laws judge the block itself.
export function seedBlockCommand(value) {
  // THE UNMINT (ring 2026-11-02): the head taken back by the hand that forged it — one id, nothing else.
  if(value && typeof value==='object' && !Array.isArray(value) && value.action==='unmint') {
    return Object.keys(value).every(key=>['action','pulseId'].includes(key)) && typeof value.pulseId==='string' && value.pulseId
      && value.pulseId.length<=512 && !/[\u0000-\u001f\u007f]/.test(value.pulseId) ? {action:'unmint',pulseId:value.pulseId} : null;
  }
  if(!value || typeof value!=='object' || Array.isArray(value)
    || Object.keys(value).some(key=>!['action','on','id','block','signature'].includes(key))
    || value.action!=='mint' || !['tree','vision'].includes(value.on)
    || typeof value.id!=='string' || !value.id || value.id.length>512 || /[\u0000-\u001f\u007f]/.test(value.id)
    || !value.block || typeof value.block!=='object' || Array.isArray(value.block))return null;
  if(value.signature!==undefined && value.signature!==null) {
    const sig=value.signature;
    if(typeof sig!=='object' || Array.isArray(sig) || Object.keys(sig).some(key=>!['sig','keyFingerprint','epochId','previousHash'].includes(key))
      || typeof sig.sig!=='string' || !/^[A-Za-z0-9+/]{86}==$/.test(sig.sig)
      || typeof sig.keyFingerprint!=='string' || !/^[a-f0-9]{64}$/.test(sig.keyFingerprint)
      || typeof sig.epochId!=='string' || !/^[A-Za-z0-9_-]{1,128}$/.test(sig.epochId)
      || typeof sig.previousHash!=='string' || !sig.previousHash || sig.previousHash.length>512)return null;
    try {if(btoa(atob(sig.sig))!==sig.sig)return null;}catch{return null;}
  }
  return {...value};
}
