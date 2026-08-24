import { useEffect, useState } from 'react';
import type { LightHouse } from '../types';
import { getLightHouseCareRecord, witnessLightHouseCare, mintLightHouseCare, getCommunityById } from '../services/firebase';
import { firestoreStore } from '../adapters/firestore';
import { consecrationObserved } from '../domain/lightHouse';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './ui/Icons';
import { notify } from './ui/Toast';

// THE CONSECRATION CARD (ring 2026-08-24): the house's founding care, and the keeper's
// observation that makes it STAND. One non-consecrating keeper suffices (the watering
// precedent); each witness slot carries the mortal uid AND the lid — the true name that
// survives the crossing. Until observed, the ceremony says so honestly.
export const LightHouseCareCard = ({ lightHouse, currentUserId }: { lightHouse: LightHouse; currentUserId?: string }) => {
  const { t } = useLanguage();
  const [record, setRecord] = useState<Awaited<ReturnType<typeof getLightHouseCareRecord>>>(null);
  const [isKeeper, setIsKeeper] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    getLightHouseCareRecord(lightHouse.id).then(r => { if (alive) setRecord(r); }).catch(() => {});
    return () => { alive = false; };
  }, [lightHouse.id, nonce]);

  useEffect(() => {
    let alive = true;
    const communityId = lightHouse.communityId;
    if (!currentUserId || !communityId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets derived eligibility when the viewer/community changes; nothing async to await here
      setIsKeeper(false);
      return;
    }
    Promise.all([
      getCommunityById(communityId).catch(() => null),
      firestoreStore.linksFrom(currentUserId, 'keeper').catch(() => []),
    ]).then(([c, keeperLinks]) => {
      if (alive) setIsKeeper(c?.ownerId === currentUserId || keeperLinks.some(l => l.to === communityId));
    });
    return () => { alive = false; };
  }, [currentUserId, lightHouse.communityId]);

  if (!record) return null;
  const { founding, witnesses } = record;
  const observed = consecrationObserved(witnesses.map(w => w.uid), founding.authorId || '');
  const alreadyWitnessed = !!currentUserId && witnesses.some(w => w.uid === currentUserId);
  const mayWitness = isKeeper && !!currentUserId && currentUserId !== founding.authorId && !alreadyWitnessed;
  const actLabel = founding.careAct === 'step_in' ? t('lh_step_in') : founding.careAct === 'care' ? t('lh_care_act') : t('lh_consecration');

  const witness = async () => {
    setBusy(true);
    try { await witnessLightHouseCare(founding.id); setNonce(n => n + 1); }
    catch { notify(t('err_action')); }
    setBusy(false);
  };

  const careAgain = async () => {
    setBusy(true);
    try { await mintLightHouseCare({ id: lightHouse.id, name: lightHouse.name, communityId: lightHouse.communityId }, 'care'); notify('🌞'); setNonce(n => n + 1); }
    catch { notify(t('err_action')); }
    setBusy(false);
  };

  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center text-xs font-bold uppercase tracking-wider text-amber-700">
          <Icons.Sun /><span className="ml-2">{actLabel}</span>
        </h3>
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${observed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {observed ? t('lh_observed') : t('lh_awaiting_eyes')}
        </span>
      </div>
      {founding.authorName && <p className="mt-1.5 text-sm text-slate-600">{founding.authorName}</p>}
      {witnesses.length > 0 && (
        <div className="mt-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('lh_observed_by')}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {witnesses.map(w => (
              <span key={w.uid} title={w.lid} className="rounded-full border border-emerald-200 bg-white px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                {w.name || w.lid.slice(0, 8)}
              </span>
            ))}
          </div>
        </div>
      )}
      {(mayWitness || (currentUserId && (isKeeper || lightHouse.ownerId === currentUserId))) && (
        <div className="mt-3 flex gap-2">
          {mayWitness && (
            <button type="button" disabled={busy} onClick={witness}
              className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50">
              👁 {t('lh_witness_btn')}
            </button>
          )}
          {currentUserId && (isKeeper || lightHouse.ownerId === currentUserId) && (
            <button type="button" disabled={busy} onClick={careAgain}
              className="rounded-full border border-amber-300 bg-white px-4 py-1.5 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50">
              🌞 {t('lh_care_act')}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
