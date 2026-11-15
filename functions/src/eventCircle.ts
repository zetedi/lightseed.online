// THE ONE LAW (2026-11-14). This module was a hand-kept MIRROR of src/domain; the functions build now
// compiles the shared domain itself (tsconfig rootDir '..'), so the server judges by the very source the
// shell and the independent node judge by. Nothing is defined here: add law to src/domain.
export { type EventCircleRefusal, type EventCircleFacts, type EventCircleJudgment, judgeEventCircle, formEventCircleRefusal, eventCircleName, type EventCircleDraft, eventCircleDraft, eventCircleMemberUids } from '../../src/domain/eventCircle';
export { type LineageNode, lineageRootOf, lineageOfCopy } from '../../src/domain/eventLineage';
