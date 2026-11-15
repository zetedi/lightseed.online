// THE ONE LAW (2026-11-14). THE SPENDING GATE's law is src/domain/spend's (and the suspended gift, src/domain/gift's).
// The functions build compiles the shared domain itself (tsconfig rootDir '..'): the server judges by the
// very source the shell and the independent node judge by. Add law to src/domain, never here.
export { type SpendRefusal, type SpendIntent, spendIntentProblem, coinAccepted, type HeldRayFact, type AppreciationFacts, type RayTake, type AppreciationJudgment, pickRays, judgeAppreciation, type SpendFacts, type SpendJudgment, judgeSpend } from '../../src/domain/spend';
export { suspendGift } from '../../src/domain/gift';
