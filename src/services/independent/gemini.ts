// THE INDEPENDENT NODE'S HAND for the model calls — the mirror of ../firebase/gemini.ts (rings
// 2026-11-01/02). Every hand here reaches a MODEL through a provider key the node holds; that is
// the AI organ (/v1/ai), which this node has not grown yet. Each refuses by name — except the
// observatory's quote, which the Firebase hand also speaks from memory when no model answers.
import type * as F from '../firebase/gemini';
import { unported } from './unported';
export type { TranslationRequest, TranslationResponse } from '../../domain/translation';

export const generatePostTitle: typeof F.generatePostTitle = unported('gemini.generatePostTitle');
export const generateLifetreeBio: typeof F.generateLifetreeBio = unported('gemini.generateLifetreeBio');
export const generateImage: typeof F.generateImage = unported('gemini.generateImage');
export const generateVisionImage: typeof F.generateVisionImage = unported('gemini.generateVisionImage');
// The observatory's word when no intelligence answers — the same line the origin node speaks signed out.
export const generateOracleQuote: typeof F.generateOracleQuote = async () => '"The clearest way into the Universe is through a forest wilderness." - John Muir';
export const sendMessageToOracle: typeof F.sendMessageToOracle = unported('gemini.sendMessageToOracle');
export const testIntelligenceConnection: typeof F.testIntelligenceConnection = unported('gemini.testIntelligenceConnection');
export const sendMessageToTree: typeof F.sendMessageToTree = unported('gemini.sendMessageToTree');
export const analyzeWateringPhoto: typeof F.analyzeWateringPhoto = unported('gemini.analyzeWateringPhoto');
export const RESONANCE_DEPTH: typeof F.RESONANCE_DEPTH = 12;
export const findVisionSynergies: typeof F.findVisionSynergies = unported('gemini.findVisionSynergies');
export const translatePulse: typeof F.translatePulse = unported('gemini.translatePulse');
