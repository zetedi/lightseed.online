import React from 'react';

// A reusable section card for the "profile" views (tree / community / user / event). White by
// default; `dark` gives the slate variant used by the tree's Digital Tree view.
export const SectionCard = ({ title, icon, dark = false, className = '', bodyClassName = '', children }: {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  dark?: boolean;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) => (
  <section className={`overflow-hidden rounded-2xl border shadow-sm ${dark ? 'border-slate-800 bg-slate-900 text-slate-200' : 'border-slate-100 bg-white'} ${className}`}>
    {title && (
      <h3 className={`flex items-center gap-2 px-5 pt-5 text-sm font-bold uppercase tracking-wider ${dark ? 'text-emerald-300' : 'text-slate-500'}`}>
        {icon && <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>}<span>{title}</span>
      </h3>
    )}
    <div className={`p-5 ${bodyClassName}`}>{children}</div>
  </section>
);
