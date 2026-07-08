import React from 'react';
import { Icons } from '../ui/Icons';
import { Lifetree } from '../../types';

interface GuardianButtonProps {
  tree: Lifetree;
  guardian: boolean;
  busy: boolean;
  onToggle: (tree: Lifetree) => void;
}

// "Join guardianship" pill shown on tree cards (First Tree + Community Trees tabs).
export const GuardianButton: React.FC<GuardianButtonProps> = ({ tree, guardian, busy, onToggle }) => (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); onToggle(tree); }}
    disabled={busy}
    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-colors disabled:opacity-50 ${guardian ? 'bg-emerald-100 text-emerald-700 hover:bg-red-50 hover:text-red-600' : 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'}`}
    title={guardian ? 'Leave guardianship' : 'Join guardianship'}
  >
    <Icons.Tree />
    <span>{busy ? '...' : guardian ? 'Guardian' : 'Join'}</span>
  </button>
);
