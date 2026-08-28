import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Community, Link } from '../../types';
import {
  INTERBEING_RELATIONS,
  communityDomainAnchor,
  interbeingRelationDescKey,
  interbeingRelationKey,
  interbeingRelationState,
  isInterbeingRelation,
  type InterbeingRelation,
} from '../../domain/interbeingMatrix';
import { firestoreStore } from '../../adapters/firestore';
import { fetchCommunities } from '../../services/firebase';
import { SectionTitle } from '../ui/SectionTitle';
import { notify } from '../ui/Toast';
import { showAlert } from '../ui/Dialog';
import { useLanguage } from '../../contexts/LanguageContext';

interface CommunityInterbeingMatrixProps {
  community: Community;
  canManage: boolean;
}

const stateWords = {
  proposed: { key: 'interbeing_state_proposed', tone: 'border-amber-200 bg-amber-50 text-amber-800' },
  received: { key: 'interbeing_state_received', tone: 'border-sky-200 bg-sky-50 text-sky-800' },
  reciprocal: { key: 'interbeing_state_reciprocal', tone: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
} as const;

export const CommunityInterbeingMatrix: React.FC<CommunityInterbeingMatrixProps> = ({ community, canManage }) => {
  const { t } = useLanguage();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [targetId, setTargetId] = useState('');
  const [relation, setRelation] = useState<InterbeingRelation>('collaborates_with');
  const [busyKey, setBusyKey] = useState('');
  const [loading, setLoading] = useState(true);

  const readMatrix = useCallback(async () => {
    const [all, outgoing, incoming] = await Promise.all([
      fetchCommunities(),
      firestoreStore.linksFrom(community.id),
      firestoreStore.linksTo(community.id),
    ]);
    const byId = new Map([...outgoing, ...incoming].map(link => [`${link.from}__${link.rel}__${link.to}`, link]));
    return {
      communities: all.filter(item => item.id !== community.id),
      links: [...byId.values()].filter(link => isInterbeingRelation(link.rel)),
    };
  }, [community.id]);

  const applyMatrix = useCallback((matrix: Awaited<ReturnType<typeof readMatrix>>) => {
    setCommunities(matrix.communities);
    setLinks(matrix.links);
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    readMatrix()
      .then(matrix => { if (alive) applyMatrix(matrix); })
      .catch(() => { if (alive) { setLoading(false); showAlert('err_interbeing_read'); } });
    return () => { alive = false; };
  }, [readMatrix, applyMatrix]);

  const rows = useMemo(() => communities.flatMap(other =>
    INTERBEING_RELATIONS.map(rel => ({
      other,
      rel,
      state: interbeingRelationState(community.id, other.id, rel, links),
    })).filter(row => row.state !== 'none'),
  ), [communities, community.id, links]);

  const write = async (otherId: string, rel: InterbeingRelation, create: boolean) => {
    const key = `${otherId}__${rel}`;
    setBusyKey(key);
    try {
      if (create) await firestoreStore.link(community.id, rel, otherId);
      else await firestoreStore.unlink(community.id, rel, otherId);
      notify(t(create ? 'interbeing_attestation_stands' : 'interbeing_attestation_withdrawn'));
      try {
        applyMatrix(await readMatrix());
      } catch {
        showAlert('err_interbeing_refresh');
      }
    } catch {
      showAlert('err_interbeing_change');
    }
    setBusyKey('');
  };

  const propose = async () => {
    if (!targetId) return;
    await write(targetId, relation, true);
    setTargetId('');
  };

  const anchor = communityDomainAnchor(community);
  const selectedState = targetId
    ? interbeingRelationState(community.id, targetId, relation, links)
    : 'none';
  const alreadyAttested = selectedState === 'proposed' || selectedState === 'reciprocal';

  return (
    <div className="space-y-5">
      <SectionTitle
        title={t('interbeing')}
        sub={t('interbeing_sub')}
      />

      <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">{t('interbeing_external_anchor')}</p>
            <a href={`https://${anchor.canonicalDomain}`} target="_blank" rel="noreferrer" className="mt-1 block font-mono text-sm text-slate-700 hover:text-emerald-700">
              {anchor.canonicalDomain}
            </a>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            {t('interbeing_anchor_self_declared')}
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          {t('interbeing_anchor_desc')}
        </p>
      </div>

      {canManage && (
        <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-5">
          <h3 className="font-semibold text-slate-800">{t('interbeing_propose_title')}</h3>
          <p className="mt-1 text-sm text-slate-500">{t('interbeing_propose_desc').replace('{name}', community.name)}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <select value={targetId} onChange={event => setTargetId(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <option value="">{t('interbeing_choose_community')}</option>
              {communities.map(item => <option key={item.id} value={item.id}>{item.name} · {item.domain}</option>)}
            </select>
            <select value={relation} onChange={event => setRelation(event.target.value as InterbeingRelation)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              {INTERBEING_RELATIONS.map(rel => <option key={rel} value={rel}>{t(interbeingRelationKey(rel))}</option>)}
            </select>
            <button onClick={propose} disabled={!targetId || alreadyAttested || !!busyKey} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50">
              {t(alreadyAttested ? 'interbeing_already_attested' : selectedState === 'received' ? 'interbeing_acknowledge' : 'interbeing_propose')}
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500">{t(interbeingRelationDescKey(relation))}</p>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-5 text-sm text-slate-500">{t('interbeing_reading')}</div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            {t('interbeing_empty')}
          </div>
        ) : rows.map(({ other, rel, state }) => {
          const words = stateWords[state as keyof typeof stateWords];
          const outgoing = state === 'proposed' || state === 'reciprocal';
          const key = `${other.id}__${rel}`;
          return (
            <div key={key} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-800">{other.name}</h3>
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${words.tone}`}>{t(words.key)}</span>
                  </div>
                  <a href={`https://${communityDomainAnchor(other).canonicalDomain}`} target="_blank" rel="noreferrer" className="mt-1 block truncate font-mono text-xs text-slate-500 hover:text-emerald-700">
                    {communityDomainAnchor(other).canonicalDomain}
                  </a>
                  <p className="mt-2 text-sm text-slate-600">{t(interbeingRelationKey(rel))}</p>
                </div>
                {canManage && (
                  state === 'received' ? (
                    <button onClick={() => write(other.id, rel, true)} disabled={busyKey === key} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50">{t('interbeing_acknowledge')}</button>
                  ) : outgoing ? (
                    <button onClick={() => write(other.id, rel, false)} disabled={busyKey === key} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">{t('interbeing_withdraw')}</button>
                  ) : null
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs italic text-slate-500">{t('interbeing_epigraph')}</p>
    </div>
  );
};
