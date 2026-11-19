import React from 'react';

// The small things every form repeats.

// The tiny uppercase caption of a field. `flush` drops the block and the gap beneath, for a
// caption that sits in a row or whose parent already spaces it.
export const FieldLabel = ({ flush = false, children }: { flush?: boolean; children: React.ReactNode }) => (
    <span className={`${flush ? '' : 'mb-1 block '}text-[10px] font-bold uppercase text-slate-400`}>{children}</span>
);

// The caption above a block of read-only detail (an offering's parts, a bed's place).
export const Caption = ({ children }: { children: React.ReactNode }) => (
    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{children}</p>
);

// THE FORM FIELD'S SKIN — one border, one corner, one focus ring. `_SOFT` sits on a white
// panel (slate ground); the plain one sits on a tinted panel (white ground). A textarea adds
// its own height beside it (min-h-24 and TEXT_AREA in one template).
const FIELD_SKIN = 'w-full rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900';
export const TEXT_INPUT = `h-11 bg-white px-3 ${FIELD_SKIN}`;
export const TEXT_INPUT_SOFT = `h-11 bg-slate-50 px-3 ${FIELD_SKIN}`;
export const TEXT_AREA = `bg-white p-3 ${FIELD_SKIN}`;
export const TEXT_AREA_SOFT = `bg-slate-50 p-3 ${FIELD_SKIN}`;

// What went wrong, said inside the form that caused it (the words are the caller's: a refusal
// key already spoken through `speak`, never a raw error).
export const ErrorNote = ({ children }: { children: React.ReactNode }) => (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-300">{children}</p>
);
