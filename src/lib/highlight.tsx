import type { ReactNode } from "react";

const MARK_CLASS = "bg-yellow-200 text-slate-900 px-0.5 rounded";

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True if `text` contains `query` (case-insensitive). Empty query always matches. */
export function matchesQuery(text: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return text.toLowerCase().includes(q);
}

/**
 * Wraps case-insensitive matches of `query` inside `text` with a `<mark>`
 * highlight, for rendering inside plain-text React content.
 */
export function highlightText(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;
  const re = new RegExp(`(${escapeRegExp(q)})`, "gi");
  const parts = text.split(re);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className={MARK_CLASS}>
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

/**
 * Wraps case-insensitive matches of `query` with a `<mark>` highlight inside
 * an HTML string, without touching tags/attributes. Intended to run on
 * already-sanitized HTML before it is set via `dangerouslySetInnerHTML`.
 */
export function highlightHtml(html: string, query: string): string {
  const q = query.trim();
  if (!q) return html;
  const re = new RegExp(`(${escapeRegExp(q)})`, "gi");
  return html
    .split(/(<[^>]+>)/g)
    .map((segment) =>
      segment.startsWith("<")
        ? segment
        : segment.replace(re, `<mark class="${MARK_CLASS}">$1</mark>`),
    )
    .join("");
}
