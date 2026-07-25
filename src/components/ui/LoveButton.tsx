import React, { useEffect, useState } from 'react';
import { Icons } from './Icons';
import { useSession } from '../../contexts/SessionContext';
import { isBeingLoved, loveBeing, isPulseLoved, lovePulse } from '../../services/firebase';

// The ONE heart. Every being wears the same like: a tree, a bed, a community, a vision, an event,
// a reach, any pulse. A being's love is a plain loves/{uid} slot + loveCount (loveBeing); a
// PULSE's love routes through lovePulse with the same shape. Neither route creates light, tokens,
// balances or rewards. Icons.Heart already colours itself (red when filled, slate when empty), so
// a site controls only its layout, size and count text. Optimistic, rolling back if the write fails.
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
    const stateKey = `${collection}/${id}/${uid || 'signed-out'}`;
    // State is keyed to BOTH the viewed being and the signed-in being. A profile/account switch
    // therefore reads as a fresh heart immediately; the previous being's private mark and
    // optimistic delta can never flash while the new own-slot read is in flight.
    const [loveState, setLoveState] = useState<{
        key: string;
        loved: boolean;
        delta: number;
        pending: boolean;
    } | null>(null);
    const current = loveState?.key === stateKey ? loveState : null;
    const loved = current?.loved ?? false;
    // `delta` is this session's optimistic change; the shown count is the being's count plus it.
    const delta = current?.delta ?? 0;
    const count = Math.max(0, initialCount + delta);

    useEffect(() => {
        if (!uid) return;
        let alive = true;
        (isPulse ? isPulseLoved(id, uid) : isBeingLoved(collection, id, uid))
            .then(nextLoved => {
                if (alive) setLoveState({ key: stateKey, loved: nextLoved, delta: 0, pending: false });
            })
            // A failed own-slot read must not preserve another being's state.
            .catch(() => {
                if (alive) setLoveState({ key: stateKey, loved: false, delta: 0, pending: false });
            });
        return () => { alive = false; };
    }, [collection, id, uid, isPulse, stateKey]);

    const toggle = async (e?: React.SyntheticEvent) => {
        e?.stopPropagation();
        // Wait until this exact being/account pair has resolved its private slot. Otherwise a fast
        // click could mistake an existing love for an empty heart and invert the wrong intention.
        if (!uid || !current || current.pending) return;
        const next = !loved;
        setLoveState(s => s?.key === stateKey
            ? { ...s, loved: next, delta: s.delta + (next ? 1 : -1), pending: true }
            : s);
        try {
            await (isPulse ? lovePulse(id, uid) : loveBeing(collection, id, uid));
            setLoveState(s => s?.key === stateKey ? { ...s, pending: false } : s);
        } catch {
            setLoveState(s => s?.key === stateKey
                ? { ...s, loved: !next, delta: s.delta + (next ? -1 : 1), pending: false }
                : s);                             // the write failed; take the optimism back
        }
    };

    const title = loved ? 'You love this' : `Love ${noun}`;
    const waiting = !!uid && (!current || current.pending);
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
                tabIndex={uid && !waiting ? 0 : -1}
                aria-disabled={!uid || waiting}
                aria-pressed={loved}
                title={title}
                aria-label={title}
                onClick={toggle}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void toggle(e); } }}
                className={`${cls} ${!uid || waiting ? 'cursor-default' : ''}`}
            >
                {body}
            </span>
        );
    }
    return (
        <button type="button" onClick={toggle} disabled={!uid || waiting} aria-pressed={loved} title={title} aria-label={title}
            className={`${cls} disabled:cursor-default`}>
            {body}
        </button>
    );
};
