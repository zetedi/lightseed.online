import React, { useEffect, useState } from 'react';
import { Icons } from './Icons';
import { useSession } from '../../contexts/SessionContext';
import { isBeingLoved, loveBeing, isPulseLoved, lovePulse } from '../../services/firebase';

// The ONE heart. Every being wears the same like: a tree, a bed, a community, a vision, an event,
// a reach, any pulse. A being's love is a plain loves/{uid} slot + loveCount (loveBeing); a
// PULSE's love routes through lovePulse, the same slot but able to kindle a light token for the
// author's tree. Icons.Heart already colours itself (red when filled, slate when empty), so a
// site controls only its layout, size and count text. Optimistic, rolling back if the write fails.
//
// `inline` renders a <span role="button"> instead of a <button>, for the one place a heart nests
// inside a clickable card that is itself a <button> (EventCard) where a nested <button> is illegal.
export const LoveButton = ({
    collection, id, initialCount = 0,
    className = '',
    iconClassName = '[&>svg]:h-4 [&>svg]:w-4',
    countClassName = 'text-[11px] font-bold tabular-nums',
    activeClassName = '',
    showZero = false,
    inline = false,
    noun = 'this',
}: {
    collection: string;          // 'pulses' | 'lifetrees' | 'communities' | 'visions'
    id: string;
    initialCount?: number;
    className?: string;          // the surface: position, padding, rounding, colour
    iconClassName?: string;      // sizes the svg (default 16px; '' keeps Icons.Heart's own 20px)
    countClassName?: string;     // the tally's text
    activeClassName?: string;    // extra surface applied ONLY when the count is > 0 (e.g. a badge bg)
    showZero?: boolean;          // show the count even at 0 (the pulse cards do)
    inline?: boolean;            // render a <span role=button> (nests inside a clickable card)
    noun?: string;               // 'this' | 'this event' for the label
}) => {
    const { lightseed } = useSession();
    const uid = lightseed?.uid;
    const isPulse = collection === 'pulses';
    const [loved, setLoved] = useState(false);
    // `delta` is this session's optimistic change; the shown count is the being's count plus it.
    const [delta, setDelta] = useState(0);
    const count = Math.max(0, initialCount + delta);

    useEffect(() => {
        if (!uid) return;
        (isPulse ? isPulseLoved(id, uid) : isBeingLoved(collection, id, uid)).then(setLoved).catch(() => {});
    }, [collection, id, uid, isPulse]);

    const toggle = async (e?: React.SyntheticEvent) => {
        e?.stopPropagation();
        if (!uid) return;
        const next = !loved;
        setLoved(next);
        setDelta(d => next ? d + 1 : d - 1);
        try {
            await (isPulse ? lovePulse(id, uid) : loveBeing(collection, id, uid));
        } catch {
            setLoved(!next);                      // the write failed; take the optimism back
            setDelta(d => next ? d - 1 : d + 1);
        }
    };

    const title = loved ? 'You love this' : `Love ${noun}`;
    const cls = `inline-flex items-center gap-1 transition-transform hover:scale-110 active:scale-95 ${count > 0 ? activeClassName : ''} ${className}`;
    const body = (
        <>
            <span className={iconClassName}><Icons.Heart filled={loved} /></span>
            {(showZero || count > 0) && <span className={countClassName}>{count}</span>}
        </>
    );

    if (inline) {
        return (
            <span
                role="button"
                tabIndex={0}
                aria-pressed={loved}
                title={title}
                aria-label={title}
                onClick={toggle}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void toggle(e); } }}
                className={cls}
            >
                {body}
            </span>
        );
    }
    return (
        <button type="button" onClick={toggle} disabled={!uid} aria-pressed={loved} title={title} aria-label={title}
            className={`${cls} disabled:cursor-default`}>
            {body}
        </button>
    );
};
