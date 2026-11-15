// THE ONE LAW (2026-11-14). This module was a hand-kept MIRROR of src/domain; the functions build now
// compiles the shared domain itself (tsconfig rootDir '..'), so the server judges by the very source the
// shell and the independent node judge by. Nothing is defined here: add law to src/domain.
export { type MailVoiceSource, type MailWords, type MailWordsClean, type NodeVoice, type MailVoice, MAIL_LINE_MAX, SHELL_MAIL_PRIMARY, SHELL_MAIL_INK, SHELL_MAIL_PAPER, MAIL_WORD_KEYS, contrastOf, mailLine, mailWordsOf, mailVoiceOf, dressMailText } from '../../src/domain/mailVoice';
