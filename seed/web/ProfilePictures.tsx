import { useEffect, useState } from 'react';
import type { createSeedSession } from '../../src/services/independent/session';

type Profile = { siteLogoUrl?: string; siteHeroUrl?: string };
export function ProfilePictures({ session, uid }: {session: ReturnType<typeof createSeedSession>; uid: string}) {
  const [profile,setProfile]=useState<Profile|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(false);
  useEffect(()=>{
    let active=true;
    void session.read('/v1/me/profile').then(result=>{if(active)setProfile((result as {profile:Profile|null}).profile);})
      .catch(()=>{if(active)setError(true);});
    return ()=>{active=false;};
  },[session]);
  const save=async(slot:'siteLogoUrl'|'siteHeroUrl',path:string|null)=>{
    const current=session.snapshot();
    if(current.status!=='authenticated' || current.uid!==uid)throw new Error('session_changed');
    const result=await session.profilePicture(slot,path) as {profile:Profile};setProfile(result.profile);
  };
  return <section><h3>Profile pictures</h3><p>Uploaded pictures are public. Save your name before adding pictures.</p>
    {(['siteLogoUrl','siteHeroUrl'] as const).map(slot=><div key={slot}>
      <label>{slot==='siteLogoUrl'?'Personal logo':'Profile banner'}
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event=>{
          const file=event.target.files?.[0];event.target.value='';if(!file)return;
          setBusy(true);setError(false);
          void (async()=>{
            const extension={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
            if(!extension)throw new Error('invalid_image');
            const path='users/'+uid+'/site-theme/'+crypto.randomUUID()+'.'+extension;
            await session.uploadMedia(path,file);await save(slot,path);
          })().catch(()=>setError(true)).finally(()=>setBusy(false));
        }}/>
      </label>
      {profile?.[slot] && <><img src={profile[slot]} alt={slot==='siteLogoUrl'?'Personal logo':'Profile banner'} width={180}/>
        <button disabled={busy} onClick={()=>{
          setBusy(true);setError(false);void save(slot,null).catch(()=>setError(true)).finally(()=>setBusy(false));
        }}>Remove picture</button></>}
    </div>)}
    {error && <p role="alert">Could not save the picture. Save your profile name, then try again.</p>}
  </section>;
}
