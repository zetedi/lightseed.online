import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import type { TranslationResponse } from '@backend/gemini';
import { LoveButton } from '../ui/LoveButton';
import { CTA_GLOW } from '../../utils/tabTheme';
import { useReachConversation } from '../../hooks/useReachConversation';
import { Icons } from '../ui/Icons';
import { OutwardLink } from '../ui/OutwardLink';
import { linkifyParts } from '../../utils/sanitize';
import { Lifetree, ReachAudience } from '../../types';
import type { GroupThreadDescriptor, ThreadLine } from '../../domain/views/threads';

// The inbox and the shell name the group thread by this face's door.
export type { GroupThreadDescriptor };
type ChatMessage = ThreadLine;



// A small heart to like a single reach message (its underlying reach pulse): the shared heart.
const MessageLike = ({ pulseId, initialCount }: { pulseId: string; initialCount: number }) => (
    <LoveButton
        collection="pulses"
        id={pulseId}
        initialCount={initialCount}
        noun="love_this_reach"
        className="px-1 text-slate-400 disabled:opacity-40"
        iconClassName="[&>svg]:h-3.5 [&>svg]:w-3.5"
        countClassName="text-[11px] tabular-nums"
    />
);

// The audience options offered when starting a reach to a tree. `undefined` is the classic
// 1:1 message to the owner; the others fan out to a shared group thread with the circle.
const AUDIENCE_OPTIONS: { value: ReachAudience | undefined; labelKey: 'role_keeper' | 'audience_guardians' | 'audience_everyone' }[] = [
    { value: undefined, labelKey: 'role_keeper' },
    { value: 'guardians', labelKey: 'audience_guardians' },
    { value: 'everyone', labelKey: 'audience_everyone' },
];

const SunAvatar = () => (
    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-amber-200 bg-amber-50 text-amber-500 shadow-inner dark:border-amber-900 dark:bg-amber-950/40">
        <div className="pointer-events-none absolute -inset-1 rounded-full bg-amber-300/20 blur-sm"></div>
        <span className="relative z-10"><Icons.Sun /></span>
    </div>
);

const InitialAvatar = ({ name, photo }: { name?: string, photo?: string }) => (
    photo
        ? <img src={photo} alt={name || ''} className="h-10 w-10 shrink-0 rounded-full border-2 border-emerald-100 object-cover dark:border-emerald-900" />
        : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-emerald-100 bg-emerald-50 font-bold uppercase text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">{name?.trim()?.charAt(0) || <Icons.Tree />}</div>
);

const GroupAvatar = () => (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
        <Icons.Users />
    </div>
);

export const ReachThread = ({ targetTree = null, groupThread = null, initialAudience, onBack, onOpenTreeById, onOpenCareById }: { targetTree?: Lifetree | null, groupThread?: GroupThreadDescriptor | null, initialAudience?: ReachAudience, onBack?: () => void, onOpenTreeById?: (treeId: string) => void, onOpenCareById?: (treeId: string) => void }) => {
    const { t } = useLanguage();
    // What is said in the room, and the hands that say it (hooks/useReachConversation).
    const {
        lightseed, activeTree, nameAs,
        messages, audibleMessages, input, setInput, isTyping, isSending, isMinting,
        showMintInfo, setShowMintInfo, usage, aiName, interpretations,
        mode, selectedTree, audience, setAudience, threadMeta, partnerPersonName, partnerTreeId,
        bottomRef, isGroup, headerName,
        revealInterpretation, handleSend, handleRetract, handleMint,
    } = useReachConversation({ targetTree, groupThread, initialAudience });

    // Incoming bubbles: the partner tree's face in a 1:1, a group glyph in a circle, the sun
    // for the Oracle. In a group, each message can carry its own author's face.
    const incomingAvatar = (msg?: ChatMessage) => {
        if (mode === 'tree') {
            if (isGroup) return msg && (msg.authorPhoto || msg.authorName)
                ? <InitialAvatar name={msg.authorName} photo={msg.authorPhoto} />
                : <GroupAvatar />;
            if (selectedTree) return <InitialAvatar name={selectedTree.name} photo={selectedTree.latestGrowthUrl || selectedTree.imageUrl} />;
        }
        return <SunAvatar />;
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-white relative dark:bg-slate-900">
            <div className="border-b border-slate-100 bg-white/95 p-4 backdrop-blur-md sticky top-0 z-10 dark:border-slate-800 dark:bg-slate-900/95">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button onClick={onBack} className="text-slate-400 transition-colors hover:text-slate-600 md:hidden">
                            <Icons.ChevronRight className="rotate-180" size={22} />
                        </button>
                    )}
                    {mode === 'tree' ? (
                        <button
                            type="button"
                            onClick={() => { if (onOpenTreeById && partnerTreeId) onOpenTreeById(partnerTreeId); }}
                            title={headerName}
                            className="shrink-0 rounded-full transition-transform hover:scale-105"
                        >
                            {isGroup ? <GroupAvatar /> : <InitialAvatar name={selectedTree?.name} photo={selectedTree?.latestGrowthUrl || selectedTree?.imageUrl} />}
                        </button>
                    ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-amber-200 bg-amber-50 text-amber-500 dark:border-amber-900 dark:bg-amber-950/40">
                            <Icons.Sun />
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-slate-800 dark:text-slate-100">
                            {headerName}
                            {!isGroup && partnerPersonName && partnerPersonName !== headerName && (
                                <span className="ml-1.5 text-xs font-normal text-slate-400">({partnerPersonName})</span>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>{mode === 'tree' ? (isGroup ? `${t('group_reach')}${threadMeta?.participantUids?.length ? ` · ${t('in_circle').replace('{n}', String(threadMeta.participantUids.length))}` : groupThread?.participantCount ? ` · ${t('in_circle').replace('{n}', String(groupThread.participantCount))}` : ''}` : t('mycelial_reach')) : `${aiName} · ${usage}/21`}</span>
                        </div>
                    </div>

                    {/* Mint — seal the messages so far onto the immutable chain (a contract). Upper-right,
                        in line with the avatar + name; the tooltip explains what it does. */}
                    {/* THE ONE HEADER ACTION: while the tree is thirsty, CARE stands where MINT
                        stands — the seal can wait until the water is given. When no care is due,
                        the mint returns. One slot, one priority: life before record. */}
                    {mode === 'tree' && onOpenCareById && partnerTreeId && audibleMessages.some(m => m.careAlert === 'watering') ? (
                        <button
                            type="button"
                            onClick={() => onOpenCareById(partnerTreeId)}
                            className={`ml-auto flex shrink-0 items-center gap-1.5 rounded-full btn-theme px-3 py-1.5 text-[10px] font-bold text-white shadow-md transition-all active:scale-95 ${CTA_GLOW}`}
                        >
                            <span className="[&>svg]:h-3.5 [&>svg]:w-3.5"><Icons.Droplet /></span>
                            <span className="hidden sm:inline">{t('care_now')}</span>
                        </button>
                    ) : messages.filter(m => !m.system).length > 1 && lightseed && (mode === 'oracle' || selectedTree || groupThread) && (
                        <button
                            onClick={handleMint}
                            disabled={isMinting}
                            title={mode === 'tree' ? t('mint_title_tree') : t('mint_title_oracle')}
                            className={`ml-auto flex shrink-0 items-center gap-1.5 rounded-full btn-theme px-3 py-1.5 text-[10px] font-bold text-white transition-all active:scale-95 disabled:opacity-50 ${CTA_GLOW}`}
                        >
                            {isMinting
                                ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                : <Icons.Stamp size={14} />}
                            <span className="hidden sm:inline">{mode === 'tree' ? t('mint_short') : t('mint_wisdom')}</span>
                        </button>
                    )}
                </div>

                {/* Audience picker — only when starting a fresh reach to a tree (not a fixed group thread). */}
                {mode === 'tree' && selectedTree && !groupThread && (
                    <div className="mt-3 flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('send_to')}</span>
                        <div className="flex flex-wrap gap-1.5">
                            {AUDIENCE_OPTIONS.map(opt => {
                                const active = audience === opt.value;
                                return (
                                    <button
                                        key={opt.labelKey}
                                        type="button"
                                        onClick={() => setAudience(opt.value)}
                                        className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${active ? 'bg-emerald-600 text-white shadow' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800'}`}
                                    >
                                        {t(opt.labelKey)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 scroll-smooth dark:bg-slate-900/50">
                {audibleMessages.map((m, i) => {
                    // Mint notices (and any system line) render centered — not as a chat bubble.
                    if (m.system) {
                        return (
                            <div key={i} className="flex justify-center px-4">
                                <span dir="auto" className="rounded-full bg-amber-50 px-3 py-1 text-center text-[11px] font-medium leading-snug text-amber-700/90 ring-1 ring-amber-100 dark:bg-amber-950/40">
                                    ⛓️ {m.text}
                                </span>
                            </div>
                        );
                    }
                    const canInterpret = mode === 'tree' && !isGroup && m.role === 'model' && !!selectedTree && !!activeTree;
                    const interp = interpretations[i];
                    // In a group, label an incoming bubble with who spoke (consecutive same-author merged).
                    const showAuthor = isGroup && m.role === 'model' && !!m.authorName && (i === 0 || messages[i - 1]?.authorId !== m.authorId || messages[i - 1]?.role !== 'model');
                    return (
                    <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {m.role === 'model' && incomingAvatar(m)}
                        <div className={`flex max-w-[90%] flex-col gap-1 sm:max-w-[80%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                            {showAuthor && (
                                <span className="px-2 text-[11px] font-bold text-emerald-700/80">
                                    {m.authorName}
                                    {m.authorPersonName && m.authorPersonName !== m.authorName && (
                                        <span className="font-normal text-slate-400"> ({m.authorPersonName})</span>
                                    )}
                                </span>
                            )}
                            <div dir="auto" className={`w-fit rounded-2xl px-4 py-2 text-[13.5px] leading-snug ${
                                m.role === 'user'
                                    ? 'bg-emerald-600 text-white rounded-br-sm shadow'
                                    : 'bg-white border border-emerald-50 text-slate-800 rounded-bl-sm shadow-sm font-medium italic dark:bg-slate-900 dark:text-slate-100'
                            } ${m.careAlert === 'watering' ? 'ring-2 ring-sky-400' : ''}`}>
                                {m.retracted
                                    ? <span className="italic opacity-60">{t('msg_retracted')}</span>
                                    : m.text.split('\n').map((line, j) => (
                                    <span key={j}>
                                        {linkifyParts(line).map((part, k) => part.type === 'link'
                                            ? <OutwardLink key={k} href={part.value} className={`underline underline-offset-2 break-all ${m.role === 'user' ? 'text-emerald-50 hover:text-white' : 'text-emerald-700 hover:text-emerald-900 dark:text-emerald-300'}`}>{part.value}</OutwardLink>
                                            : <span key={k}>{part.value}</span>)}
                                        {j < m.text.split('\n').length - 1 && <br />}
                                    </span>
                                ))}
                            </div>

                            {/* A care ping opens the simple care modal for THIS tree — the same
                                modal the bead opens, aimed by the message. */}
                            {m.careAlert === 'watering' && onOpenCareById && partnerTreeId && (
                                <button
                                    type="button"
                                    onClick={() => onOpenCareById(partnerTreeId)}
                                    className="inline-flex items-center gap-1.5 self-start rounded-full btn-theme px-3 py-1.5 text-xs font-bold text-white shadow-md transition-all active:scale-95"
                                >
                                    <span className="[&>svg]:h-3.5 [&>svg]:w-3.5"><Icons.Droplet /></span>{t('care_now')}
                                </button>
                            )}

                            {/* Like a reach message — and, for my own, the quiet retraction. */}
                            <div className="flex items-center gap-1">
                                {m.id && !m.system && <MessageLike pulseId={m.id} initialCount={m.loveCount || 0} />}
                                {m.id && !m.system && !m.retracted && m.role === 'user' && mode === 'tree' && (
                                    <button
                                        type="button"
                                        onClick={() => handleRetract(m.id!)}
                                        title={t('msg_retract_title')}
                                        className="rounded-full p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-400"
                                    >
                                        <span className="[&>svg]:h-3.5 [&>svg]:w-3.5"><Icons.Trash /></span>
                                    </button>
                                )}
                            </div>

                            {/* Shadow text — what the message means, read through your intelligence. */}
                            {canInterpret && (() => {
                                if (interp === 'loading') return (
                                    <div className="flex items-center gap-1.5 px-3 text-[12px] italic text-slate-400">
                                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-transparent dark:border-slate-700"></div>
                                        {t('h2h_reading')}
                                    </div>
                                );
                                if (interp && 'error' in interp) return (
                                    <div className="px-3 text-[11.5px] text-red-400">
                                        <span aria-hidden>✦</span> {t('h2h_read_failed').replace('{error}', interp.error)}{' '}
                                        <button onClick={() => revealInterpretation(i, m.text)} className="font-bold underline hover:text-red-500">{t('try_again')}</button>
                                    </div>
                                );
                                if (interp) {
                                    // The five distinctions (NVC) — rendered as subordinate shadow
                                    // lines; only the layers the reading actually filled show.
                                    const r = interp as TranslationResponse;
                                    const layers: [string, string | undefined][] = [
                                        ['', r.happened],
                                        [t('h2h_feels'), r.feeling],
                                        [t('h2h_may_assume'), r.inference],
                                        [t('h2h_needs'), r.need],
                                        [t('h2h_asks'), r.asks],
                                    ];
                                    const filled = layers.filter(([, v]) => v && v.trim());
                                    return (
                                        <div dir="auto" className="space-y-0.5 px-3 text-[12.5px] italic leading-relaxed text-slate-400">
                                            {filled.map(([label, v], k) => (
                                                <p key={k}>
                                                    {k === 0 && <span className="font-semibold text-slate-400/90">✦ </span>}
                                                    {label && <span className="font-semibold text-slate-400/90">{label} · </span>}
                                                    {v}
                                                </p>
                                            ))}
                                            {r.alternatives?.[0] && (
                                                <p className="text-slate-400/80">{t('h2h_also_possible').replace('{text}', r.alternatives[0])}</p>
                                            )}
                                            {/* The reading names its lens — same honesty law as Carry. */}
                                            <p className="text-[11px] not-italic text-slate-400/60">{t('h2h_read_through').replace('{name}', aiName)}</p>
                                        </div>
                                    );
                                }
                                return (
                                    <button onClick={() => revealInterpretation(i, m.text)} className="inline-flex items-center gap-1 self-start px-3 text-[11px] font-medium text-slate-400 transition-colors hover:text-emerald-600">
                                        <span aria-hidden>✦</span> {t('h2h_reveal')}
                                    </button>
                                );
                            })()}
                        </div>
                    </div>
                    );
                })}
                {isTyping && (
                    <div className="flex justify-start gap-2.5">
                        {incomingAvatar()}
                        <div className="bg-white border border-emerald-50 rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm dark:bg-slate-900">
                            <div className="flex space-x-1.5 items-center h-4">
                                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce"></div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={bottomRef}></div>
            </div>
            {mode === 'tree' && (
                <div className="px-5 pt-2 text-center">
                    {showMintInfo && (
                        <p className="mx-auto mb-1.5 max-w-md rounded-lg border border-slate-100 bg-slate-50/90 px-3 py-2 text-[11px] italic leading-snug text-slate-400 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
                            {isGroup ? t('mint_info_group') : t('mint_info_direct')}
                        </p>
                    )}
                    <button
                        type="button"
                        onClick={() => setShowMintInfo(v => !v)}
                        title={t('about_minting')}
                        aria-label={t('about_minting')}
                        aria-expanded={showMintInfo}
                        className={`inline-flex items-center justify-center rounded-full p-1 transition-colors ${showMintInfo ? 'text-slate-500' : 'text-slate-300 hover:text-slate-500'}`}
                    >
                        <Icons.Info size={14} />
                    </button>
                </div>
            )}
            {/* A sender without a tree still speaks — as themself. The line keeps provenance
                honest and quietly invites the planting. */}
            {mode === 'tree' && lightseed && !activeTree && (
                <div className="border-t border-emerald-100 bg-emerald-50/70 px-4 py-2 text-center text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200">
                    🌱 {t('speak_as_self')}
                </div>
            )}
            <form onSubmit={handleSend} className="p-4 bg-white border-t border-slate-100 flex space-x-3 items-end sticky bottom-0 z-10 dark:bg-slate-900 dark:border-slate-800">
                {/* The whole message stays visible while writing: the box grows with the text
                    (up to ~7 lines, then scrolls). Enter sends; Shift+Enter breaks a line. */}
                <textarea
                    value={input}
                    rows={1}
                    onChange={e => setInput(e.target.value)}
                    onInput={e => {
                        const el = e.currentTarget;
                        el.style.height = '0px';
                        el.style.height = `${Math.min(el.scrollHeight, 176)}px`;
                    }}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e as unknown as React.FormEvent); }
                    }}
                    placeholder={mode === 'tree'
                        ? t('reach_send_ph').replace('{from}', activeTree?.name || nameAs() || t('you')).replace('{to}', headerName)
                        : t('reach_ask_ph').replace('{name}', aiName)}
                    className="flex-1 resize-none overflow-y-auto bg-slate-50 border border-slate-200 rounded-3xl px-6 py-4 text-[15px] leading-snug focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:bg-white dark:focus:bg-slate-800 transition-all shadow-inner placeholder:text-slate-400 placeholder:italic dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
                <button type="submit" disabled={isTyping || isSending || !input.trim() || (mode === 'tree' && !selectedTree && !groupThread)} title={t('send')} className="btn-theme text-white p-4 rounded-full active:scale-95 disabled:opacity-50 transition-all shadow-lg">
                    {isSending ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Icons.Send />}
                </button>
            </form>
        </div>
    )
}
