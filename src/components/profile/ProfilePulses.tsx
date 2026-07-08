import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { Pulse } from '../../types';
import { getMyPulses } from '../../services/firebase';
import { SectionTitle } from '../ui/SectionTitle';
import { Loading } from '../ui/Loading';

interface ProfilePulsesProps {
  uid: string;
}

// My Pulses tab — everything the user has emitted, minus mycelial reach/chat messages.
export const ProfilePulses: React.FC<ProfilePulsesProps> = ({ uid }) => {
  const { t } = useLanguage();
  const [pulses, setPulses] = useState<Pulse[]>([]);
  // Starts true: the component mounts fresh on every tab activation and fetches immediately.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getMyPulses(uid)
      .then((data) => {
        if (!alive) return;
        // My Pulses excludes mycelial reach/chat messages — those live under Reaches.
        // (getMyPulses already drops them; this is defence in depth, hence the widening.)
        setPulses(data.filter((p: Pulse) => { const type: string = p.type ?? ''; return type !== 'reach' && type !== 'tree_chat'; }));
      })
      .catch((e) => console.error('Fetch profile data error', e))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [uid]);

  return (
    <div>
      <SectionTitle title={t('my_pulses')} sub={t('my_pulses_sub')} />
      {loading ? <div className="flex justify-center rounded-2xl border border-slate-100 bg-slate-50/50 py-16"><Loading /></div> : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {pulses.length === 0 ? <p className="col-span-full text-slate-400 text-center py-10">No pulses emitted yet.</p> : pulses.map((pulse) => (
            <div key={pulse.id} className="border border-slate-100 rounded-lg overflow-hidden group">
              <div className="h-24 bg-slate-100 relative">
                {pulse.imageUrl ? (
                  <img src={pulse.imageUrl} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300"><Icons.Hash /></div>
                )}
              </div>
              <div className="p-3">
                <h4 className="font-bold text-sm text-slate-800 line-clamp-1">{pulse.title}</h4>
                <div className="mt-1 flex items-center space-x-3 text-[10px] text-slate-400">
                  <span>{pulse.loveCount} Loves</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
