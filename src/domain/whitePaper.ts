// THE WHITE PAPER — the root/ documents served as the files they are (ring 2026-09-13). A
// chapter names a root file; its door is fixed and same-origin, /root/<NAME>.md, emitted into
// the deploy beside the shell (vite.config: rootPapers), so the node carries the constitution
// it grew from at an address anyone it serves can open — not as a string inside a script.
//
// Plain contract — guaranteed: rootPaperPath is deterministic in the chapter name and never
// leaves /root/; isPaperContentType admits only what a server declares as text (markdown or
// plain), because the shell's catch-all rewrite answers a missing path with index.html and
// HTML must never be read as a chapter. Not guaranteed: that the file is reachable at the
// moment it is asked for (offline before a first reading; the reader is told and may ask
// again) — the worker keeps a copy after the first reading (root-papers runtime cache).
export const WHITE_PAPER_CHAPTERS = ['GENESIS', 'LIN', 'ARCHITECTURE', 'DECISIONS', 'ROADMAP', 'QUESTIONS', 'SEED'] as const;
export type WhitePaperChapter = (typeof WHITE_PAPER_CHAPTERS)[number];

export const ROOT_PAPER_PREFIX = '/root/';
export const rootPaperPath = (chapter: WhitePaperChapter): string => `${ROOT_PAPER_PREFIX}${chapter}.md`;

// What a paper answers as. Anything else — HTML, JSON, nothing — is not a chapter.
export const isPaperContentType = (contentType: string | null | undefined): boolean =>
  /^text\/(?:markdown|plain)\b/i.test((contentType || '').trim());
