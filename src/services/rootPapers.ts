import { rootPaperPath, isPaperContentType, type WhitePaperChapter } from '../domain/whitePaper';

// A chapter of the white paper, fetched from this deploy's own /root/ (domain/whitePaper is the
// law). Refuses anything the server does not declare as text: a missing file would otherwise
// arrive as index.html through the catch-all rewrite and be read as markdown.
export const fetchRootPaper = async (chapter: WhitePaperChapter): Promise<string> => {
    const res = await fetch(rootPaperPath(chapter));
    if (!res.ok || !isPaperContentType(res.headers.get('content-type'))) throw new Error(`root paper unavailable: ${chapter}`);
    return res.text();
};
