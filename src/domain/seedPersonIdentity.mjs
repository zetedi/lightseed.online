const validLid=value=>typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
// Import gaps and disagreements require review; a name edit cannot rebind an identity.
export function seedPersonIdentity({uid,person,user,newLid}) {
  if(!validLid(newLid))return null;
  if(user!==null && user!==undefined && (typeof user!=='object' || Array.isArray(user) || (user.uid!==undefined && user.uid!==uid)))return null;
  if(person!==null && person!==undefined && (typeof person!=='object' || Array.isArray(person) || person.uid!==uid || !validLid(person.lid)))return null;
  const userLid=user?.lid;
  if(userLid!==undefined && userLid!==null && (!validLid(userLid) || !person || person.lid!==userLid))return null;
  return person?.lid ?? newLid;
}
