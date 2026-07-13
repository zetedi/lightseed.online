import DOMPurify from 'dompurify';

// Central place for turning untrusted, world-readable user content (tree names/bodies, community
// visions, image URLs) into something safe to inject into the DOM. Every sink that builds HTML
// from stored content should route through here.

// Rich text (Quill output — community.vision, etc.): keep the formatting the RichTextEditor can
// produce (headers, bold/italic/underline/strike, blockquote, ordered/bullet lists, links) plus a
// few legacy tags, and strip everything else — scripts, event handlers, and javascript:/data:
// URLs. `data-list` is Quill 2's ordered-vs-bullet marker on <li>; `class` preserves ql-* hooks.
// No `target` is allowed, so sanitized links can't be a reverse-tabnabbing vector.
export const sanitizeRichText = (dirty?: string | null): string =>
  DOMPurify.sanitize(dirty ?? '', {
    ALLOWED_TAGS: [
      'p', 'br', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'blockquote',
      'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'pre', 'code', 'hr',
    ],
    ALLOWED_ATTR: ['href', 'rel', 'src', 'alt', 'class', 'data-list'],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|\/|#)/i,
  });

// Plain text destined for an HTML string (marker labels, popup names/bodies). Escapes the five
// HTML-significant characters so the value can never break out of text or an attribute context.
export const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// A user-supplied image URL about to be placed in a src="" attribute. Returns the escaped URL only
// when it is an http(s) or root-relative reference; otherwise a safe placeholder — so a value like
// `x" onerror=...` or `javascript:...` can neither break the attribute nor smuggle a scheme.
// A quiet deep-night disc for imageless beings — a local data URI, because the old
// via.placeholder.com service went dark and left broken white squares behind.
export const DARK_IMAGE_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' fill='%230b1b3a'/%3E%3C/svg%3E";

export const safeImageUrl = (url?: string | null, fallback = ''): string => {
  const raw = String(url ?? '').trim();
  if (!raw) return fallback;
  if (/^(?:https?:\/\/|\/)/i.test(raw)) return escapeHtml(raw);
  return fallback;
};
