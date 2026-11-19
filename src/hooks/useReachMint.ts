import { useState, type Dispatch, type SetStateAction } from 'react';
import { generateImage } from '@backend/gemini';
import { checkAndIncrementAiUsage, mintPulse, uploadBase64Image, sendReach, sendThreadMessage } from '@backend';
import { notify } from '../services/toastBus';
import { showAlert, showConfirm } from '../services/dialogBus';
import { useLanguage } from '../contexts/LanguageContext';
import { spokenLine } from '../utils/translations';
import { withTimeout } from '../utils/withTimeout';
import type { ThreadLine, ThreadMeta, GroupThreadDescriptor } from '../domain/views/threads';
import type { useLifeseed } from './useLifeseed';
import type { Lifetree, ReachAudience } from '../types';

type Session = ReturnType<typeof useLifeseed>;

// MINTING A CONVERSATION — sealing what was said since the last mint onto the minter's tree
// (a tree thread: a public record, then a notice both sides see) or, with the Oracle, the
// conversation and an image of it. The server is the hand that seals; this asks.
export const useReachMint = (room: {
    session: Pick<Session, 'lightseed' | 'activeTree' | 'nameAs' | 'isAdmin' | 'isSuperAdmin'>;
    messages: ThreadLine[];
    setMessages: Dispatch<SetStateAction<ThreadLine[]>>;
    mode: 'oracle' | 'tree';
    selectedTree: Lifetree | null;
    groupThread: GroupThreadDescriptor | null;
    threadMeta: ThreadMeta | null;
    audience: ReachAudience | undefined;
    aiName: string;
}) => {
    const { t } = useLanguage();
    const { lightseed, activeTree, nameAs, isAdmin, isSuperAdmin } = room.session;
    const { messages, setMessages, mode, selectedTree, groupThread, threadMeta, audience, aiName } = room;
    const [isMinting, setIsMinting] = useState(false);

    const handleMint = async () => {
        if (!lightseed || !activeTree) {
            showAlert('mint_need_tree');
            return;
        }
        if (mode === 'tree' && !selectedTree && !groupThread) {
            showAlert('mint_open_first');
            return;
        }
        if (messages.filter(m => !m.system).length <= 1) return; // nothing but the greeting

        // ONLY WHAT GREW SINCE THE LAST MINT (or the origin): each mint-notice in the thread
        // is the previous seal's watermark — the next mint takes the words after it, so
        // repeated mints record increments, never the same words twice.
        const lastMintIdx = messages.reduce((acc, m, i) => (m.system ? i : acc), -1);
        const freshMessages = messages.slice(lastMintIdx + 1).filter(m => !m.system);
        if (freshMessages.length === 0) { showAlert('mint_nothing_new'); return; }

        const partnerLabel = groupThread?.partnerName || selectedTree?.name || t('this_conversation');

        // Tree DM: seal the conversation onto the minter's tree as a PUBLIC record on the
        // immutable chain (a contract on the LIN), then post a notice into the thread so the
        // other party sees who minted it and where.
        if (mode === 'tree') {
            const ok = await showConfirm(
                spokenLine('mint_confirm', { name: activeTree.name || '' }),
                { title: 'mint_to_chain', confirmText: 'mint_short' },
            );
            if (!ok) return;
            setIsMinting(true);
            try {
                const meName = nameAs(activeTree.name) || activeTree.name;
                const conversationText = freshMessages
                    .map(m => `${m.role === 'user' ? meName : (m.authorPersonName || m.authorName || partnerLabel)}: ${m.text}`)
                    .join('\n\n');
                // The record on the tree — a 'standard' pulse shows in the tree's growth chain (and the LIN).
                await mintPulse({
                    lifetreeId: activeTree.id,
                    type: 'standard',
                    title: t('mint_conversation_title').replace('{name}', partnerLabel),
                    body: conversationText,
                    reachTreeId: selectedTree?.id || groupThread?.partnerId,
                    reachTreeName: selectedTree?.name || groupThread?.partnerName,
                    authorId: lightseed.uid,
                    authorName: meName,
                    authorPhoto: lightseed.photoURL || activeTree.imageUrl,
                });
                // The notice in the thread (a system line both sides see).
                const noticeText = t('mint_notice_line').replace('{who}', meName).replace('{tree}', activeTree.name);
                if (groupThread && threadMeta) {
                    await sendThreadMessage({ thread: { ...threadMeta, isGroup: true }, fromTree: activeTree, sender: lightseed, text: noticeText, mintNotice: true });
                } else if (selectedTree) {
                    await sendReach({ fromTree: activeTree, toTree: selectedTree, text: noticeText, sender: lightseed, audience, mintNotice: true, isAdmin, isSuperAdmin });
                }
                setMessages(prev => [...prev, { role: 'model', system: true, text: noticeText }]);
                notify('🌿 ' + t('mint_done_chain'));
            } catch (e: any) {
                console.error(e);
                showAlert(e?.message || 'err_mint');
            }
            setIsMinting(false);
            return;
        }

        // Oracle: "Mint Wisdom" — an abstract image + the conversation, on your active tree.
        setIsMinting(true);
        try {
            const conversationText = messages.map(m => `${m.role === 'user' ? t('seeker') : aiName}: ${m.text}`).join('\n\n');
            const summaryPrompt = conversationText.substring(0, 1000);
            await checkAndIncrementAiUsage('image');
            const prompt = `Create an abstract, artistic image representing the essence of this conversation: ${summaryPrompt}. Do not contain any text, words, letters, or typography in the image.`;
            const imageUrl = await withTimeout(generateImage(prompt), 45000, t('err_image_timeout'));
            let finalImageUrl = "";
            if (imageUrl && imageUrl.startsWith('data:')) {
                finalImageUrl = await uploadBase64Image(imageUrl, `users/${lightseed.uid}/pulses/ai/${Date.now()}`);
            }
            await mintPulse({
                lifetreeId: activeTree.id,
                type: 'standard',
                title: t('wisdom_title').replace('{name}', aiName),
                body: conversationText,
                imageUrl: finalImageUrl,
                authorId: lightseed.uid,
                authorName: nameAs(activeTree?.name) || t('soul'),
                authorPhoto: lightseed.photoURL ?? undefined,
            });
            notify('🌿 ' + t('mint_done_pulse'));
        } catch (e: any) {
            console.error(e);
            showAlert(e?.message || 'err_mint');
        }
        setIsMinting(false);
    }

    return { isMinting, handleMint };
};
