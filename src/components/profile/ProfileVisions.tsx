import React, { useState, useEffect } from 'react';
import { showAlert, showConfirm } from '../ui/Dialog';
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { Vision, VisionSynergy } from '../../types';
import { getMyVisions, getJoinedVisions, deleteVision } from '../../services/firebase';
import { findVisionSynergies } from '../../services/gemini';
import { VisionCard } from '../VisionCard';
import { Loading } from '../ui/Loading';

interface ProfileVisionsProps {
  uid: string;
  onViewVision: (vision: Vision) => void;
  onCreateVision?: () => void;
  // Surfaces notices via the shell's shared dialog modal.
  notify: (message: string) => void;
}

// Visions tab — created + joined visions, with the AI alignment analysis.
export const ProfileVisions: React.FC<ProfileVisionsProps> = ({ uid, onViewVision, onCreateVision, notify }) => {
  const { t } = useLanguage();
  const [visions, setVisions] = useState<Vision[]>([]);
  const [joinedVisions, setJoinedVisions] = useState<Vision[]>([]);
  // Starts true: the component mounts fresh on every tab activation and fetches immediately.
  const [loading, setLoading] = useState(true);

  // AI Alignment State
  const [synergies, setSynergies] = useState<VisionSynergy[]>([]);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([getMyVisions(uid), getJoinedVisions(uid)])
      .then(([created, joined]) => {
        if (!alive) return;
        setVisions(created);
        setJoinedVisions(joined);
      })
      .catch((e) => console.error('Fetch profile data error', e))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [uid]);

  const performAnalysis = async (vs: Vision[]) => {
    setAnalyzing(true);
    setSynergies([]);
    try {
      const results = await findVisionSynergies(vs);
      setSynergies(results);
    } catch (e: any) {
      console.error('AI Analysis Error:', e);
      notify('Analysis failed: ' + e.message);
    }
    setAnalyzing(false);
  };

  const handleAlignmentAnalysis = async () => {
    if (visions.length < 2) {
      const data = await getMyVisions(uid);
      if (data.length < 2) {
        notify('You need at least 2 visions to find alignments.');
        return;
      }
      setVisions(data);
      performAnalysis(data);
    } else {
      performAnalysis(visions);
    }
  };

  const handleDeleteVision = async (e: React.MouseEvent, visionId: string) => {
    e.stopPropagation();
    if (!(await showConfirm('Are you sure you want to delete this vision?', { title: 'Delete Vision', confirmText: 'Delete', danger: true }))) return;
    try {
      await deleteVision(visionId);
      setVisions(prev => prev.filter(v => v.id !== visionId));
    } catch (e: any) {
      showAlert('Delete failed: ' + e.message);
    }
  };

  if (loading) return <div className="flex justify-center rounded-2xl border border-slate-100 bg-slate-50/50 py-16"><Loading /></div>;

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        {/* Non-possessive on purpose: profiles are entity-generic (Indra's net) — the menu is the entity's anatomy, not the viewer's possessions. */}
        <h3 className="text-lg font-bold">Visions</h3>
        <div className="flex items-center gap-2">
          {onCreateVision && (
            <button
              onClick={onCreateVision}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-full font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 active:scale-95"
            >
              <Icons.Plus /> <span>{t('create_vision')}</span>
            </button>
          )}
          <button
            onClick={handleAlignmentAnalysis}
            disabled={analyzing}
            className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-full font-bold shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 border border-amber-400/30 active:scale-95 disabled:opacity-50"
          >
            {analyzing ? <Loading /> : <Icons.Venn />}
            <span>{analyzing ? 'Analyzing...' : 'Analyze Alignments'}</span>
          </button>
        </div>
      </div>

      {synergies.length > 0 && (
        <div className="mb-8 bg-indigo-50 border border-indigo-100 rounded-xl p-4">
          <h4 className="font-bold text-indigo-900 mb-3 flex items-center"><Icons.SparkleFill /> <span className="ml-2">Alignment Report</span></h4>
          <div className="space-y-3">
            {synergies.map((s, i) => (
              <div key={i} className="bg-white p-3 rounded-lg shadow-sm border border-indigo-100/50">
                <div className="flex justify-between items-start">
                  <div className="font-medium text-slate-800 text-sm">
                    <span className="text-indigo-600">{s.vision1Title}</span> + <span className="text-indigo-600">{s.vision2Title}</span>
                  </div>
                  <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-bold">{s.score}%</span>
                </div>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">{s.reasoning}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-8">
        {/* Created Visions */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {visions.length === 0 && joinedVisions.length === 0 ? <p className="col-span-full text-slate-400 text-center py-10">No visions created yet.</p> : visions.map((vision) => (
            <div key={vision.id} className="relative group">
              <div onClick={() => onViewVision(vision)} className="cursor-pointer h-full">
                <VisionCard vision={vision} />
              </div>
              <div className="absolute top-2 left-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                {vision.title === "Root Vision" ? (
                  <div className="bg-white/95 backdrop-blur-sm px-2 py-1.5 rounded-lg text-[9px] text-emerald-700 font-bold border border-emerald-200 shadow-sm flex flex-col">
                    <span>ANCHOR (ROOT)</span>
                    <span className="text-[8px] text-slate-400 font-normal leading-tight mt-0.5">This vision is the foundation of your tree and cannot be deleted.</span>
                  </div>
                ) : (
                  <button
                    onClick={(e) => handleDeleteVision(e, vision.id)}
                    className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg border border-red-400 transition-all hover:scale-110 active:scale-95"
                    title={t('delete_vision_title')}
                  >
                    <Icons.Trash />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Joined Visions Section */}
        {joinedVisions.length > 0 && (
          <div className="border-t border-slate-100 pt-6">
            <h4 className="text-sm font-bold text-amber-600 uppercase tracking-widest mb-4 flex items-center">
              <Icons.Globe /> <span className="ml-2">Joined Visions</span>
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {joinedVisions.map((vision) => (
                <div key={vision.id} className="relative group">
                  <div onClick={() => onViewVision(vision)} className="cursor-pointer h-full">
                    <VisionCard vision={vision} />
                  </div>
                  <div className="absolute top-2 right-2 bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-md">
                    JOINED
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
