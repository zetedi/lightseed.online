import { useEffect, useRef, useState } from 'react';
import type { createSeedSession } from '../../src/services/independent/session';
import { seedMediaReferencePath } from '../../src/domain/seedMedia.mjs';

type PictureProps = {
  session: ReturnType<typeof createSeedSession>; uid: string;
  tree: { id: string; imageUrl?: string; imageUrls?: string[] }; onChanged: () => void;
};
export function TreePictures(props: PictureProps) {return <PictureEditor {...props} kind="tree"/>;}
export function VisionPictures(props: PictureProps) {return <PictureEditor {...props} kind="vision"/>;}
function PictureEditor({ session, uid, tree, onChanged, kind }: {
  session: ReturnType<typeof createSeedSession>; uid: string;
  tree: { id: string; imageUrl?: string; imageUrls?: string[] }; onChanged: () => void; kind: 'tree' | 'vision';
}) {
  const images = tree.imageUrls?.length ? tree.imageUrls : tree.imageUrl ? [tree.imageUrl] : [];
  const initial = images.map(seedMediaReferencePath);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const [paths, setPaths] = useState<string[]>(initial.filter((path): path is string => path !== null));
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const compatible = initial.every(path => path !== null);
  return <section><h4>Pictures</h4>
    <p>Pictures are public, including pictures attached to a private {kind}.</p>
    {!compatible ? <p>This {kind} has imported pictures. Editing those references is not available yet.</p> : <>
      <ol>{paths.map((path, index) => <li key={path}>
        <img src={'/v1/media?path=' + encodeURIComponent(path) + '&variant=small'} alt={kind + ' picture ' + (index + 1)} width={120}/>
        <button disabled={busy || index === 0} onClick={() => setPaths(old => {
          const next = [...old]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next;
        })}>Move earlier</button>
        <button disabled={busy} onClick={() => setPaths(old => old.filter(item => item !== path))}>Remove from {kind}</button>
      </li>)}</ol>
      <label>Add pictures<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={event => {
        const files = Array.from(event.target.files ?? []); event.target.value = '';
        if (!files.length) return;
        if (paths.length + files.length > 100) { setError(true); return; }
        setBusy(true); setError(false);
        void (async () => {
          for (const file of files) {
            const identity=session.snapshot();
            if (!active.current || identity.status!=='authenticated' || identity.uid!==uid) return;
            const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type];
            if (!extension) throw new Error('invalid_image');
            const path = 'users/' + uid + '/' + crypto.randomUUID() + '.' + extension;
            await session.uploadMedia(path, file);
            if (!active.current) return;
            setPaths(old => [...old, path]);
          }
        })().catch(() => setError(true)).finally(() => setBusy(false));
      }}/></label>
      <button disabled={busy} onClick={() => {
        const identity=session.snapshot();if(identity.status!=='authenticated' || identity.uid!==uid)return;
        setBusy(true); setError(false);
        void (kind==='tree'?session.treeCommand:session.visionCommand)({ action: 'set_pictures', id: tree.id, paths })
          .then(onChanged).catch(() => setError(true)).finally(() => setBusy(false));
      }}>{busy ? 'Working…' : 'Save pictures'}</button>
      {error && <p role="alert">Could not save these pictures. Please try again.</p>}
    </>}
  </section>;
}
