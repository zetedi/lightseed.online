import React from 'react';

// The small things every form repeats.

// The tiny uppercase caption above a field.
export const FieldLabel = ({ children }: { children: React.ReactNode }) => (
    <span className="mb-1 block text-[10px] font-bold uppercase text-slate-400">{children}</span>
);

// What went wrong, said inside the form that caused it (the words are the caller's: a refusal
// key already spoken through `speak`, never a raw error).
export const ErrorNote = ({ children }: { children: React.ReactNode }) => (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-300">{children}</p>
);
