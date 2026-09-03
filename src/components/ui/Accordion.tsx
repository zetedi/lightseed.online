import { useId, useState, type ReactNode } from 'react';
import { Icons } from './Icons';

// THE ONE ACCORDION — a header that opens and closes its body, closed by default. What folds
// away is still there, one tap from sight; the header names it and the chevron says which way
// it stands. Reuse this rather than a fresh toggle wherever a section should rest folded.
export const Accordion = ({
  title,
  icon,
  summary,
  defaultOpen = false,
  className = '',
  headerClassName = '',
  bodyClassName = '',
  children,
}: {
  title: ReactNode;
  icon?: ReactNode;
  // A small chip beside the chevron that stays visible while folded (a count, a state).
  summary?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  children: ReactNode;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={id}
        className={`flex w-full items-center gap-2 text-left ${headerClassName}`}
      >
        {icon && <span className="shrink-0 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>}
        <span className="min-w-0 flex-1">{title}</span>
        {summary && <span className="shrink-0">{summary}</span>}
        <span className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden>
          <Icons.ChevronRight />
        </span>
      </button>
      {open && <div id={id} className={bodyClassName}>{children}</div>}
    </div>
  );
};
