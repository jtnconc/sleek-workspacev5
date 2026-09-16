/**
 * Dependency-free HTML sanitizer for the rich-text notes editor.
 *
 * Notes are edited in a `contentEditable` surface, persisted as raw HTML, and
 * later re-rendered with `dangerouslySetInnerHTML`. Without sanitizing, pasted
 * markup could carry executable payloads (`<script>`, `<img onerror>`,
 * `javascript:` URLs) that run on every reload. This strips everything outside
 * a conservative allowlist while preserving the formatting the toolbar emits
 * (bold/italic/underline, colors, font family/size, links, images, lists).
 */

// Tags we keep. Anything else is unwrapped (children preserved) or dropped.
const ALLOWED_TAGS = new Set([
  "b", "strong", "i", "em", "u", "s", "strike", "span", "div", "p", "br",
  "a", "img", "ul", "ol", "li", "font", "h1", "h2", "h3", "blockquote",
  "code", "pre", "mark",
]);

// Tags whose entire subtree must be removed (not just unwrapped).
const FORBIDDEN_TAGS = new Set([
  "script", "style", "iframe", "object", "embed", "link", "meta", "form",
  "input", "button", "textarea", "svg", "math", "noscript", "base",
]);

// Attributes we keep per element. `style` is required for color/font formatting.
const ALLOWED_ATTRS = new Set(["style", "href", "src", "alt", "title", "class"]);

const SAFE_URL = /^(https?:|mailto:|tel:|data:image\/)/i;

/** Regex fallback for non-DOM environments (SSR): strip the dangerous bits. */
function stripFallback(html: string): string {
  return html
    .replace(/<\s*(script|style|iframe|object|embed|noscript)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*\/?\s*(script|style|iframe|object|embed|noscript|link|meta|base|form)[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, "");
}

function cleanElement(el: Element) {
  const tag = el.tagName.toLowerCase();

  if (FORBIDDEN_TAGS.has(tag)) {
    el.remove();
    return;
  }

  if (!ALLOWED_TAGS.has(tag)) {
    // Unwrap: keep the (already-sanitized) children, drop the wrapper.
    const parent = el.parentNode;
    if (parent) {
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    }
    return;
  }

  // Scrub attributes: drop event handlers, unknown attrs, and unsafe URLs.
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    if (name.startsWith("on") || !ALLOWED_ATTRS.has(name)) {
      el.removeAttribute(attr.name);
      continue;
    }
    if ((name === "href" || name === "src") && !SAFE_URL.test(attr.value.trim())) {
      el.removeAttribute(attr.name);
      continue;
    }
    if (name === "style" && /expression|url\s*\(|javascript:/i.test(attr.value)) {
      el.removeAttribute(attr.name);
    }
  }

  if (tag === "a") {
    el.setAttribute("rel", "noopener noreferrer nofollow");
  }
}

/**
 * Returns a sanitized copy of `dirty` safe to inject via
 * `dangerouslySetInnerHTML` / `innerHTML`.
 */
export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return "";
  if (typeof document === "undefined" || typeof DOMParser === "undefined") {
    return stripFallback(dirty);
  }

  const doc = new DOMParser().parseFromString(dirty, "text/html");

  // Remove forbidden subtrees up front so their contents never resurface.
  doc.body
    .querySelectorAll(Array.from(FORBIDDEN_TAGS).join(","))
    .forEach((node) => node.remove());

  // Walk depth-first from the leaves so unwrapping never skips nodes.
  const all = Array.from(doc.body.querySelectorAll("*")).reverse();
  for (const el of all) cleanElement(el);

  return doc.body.innerHTML;
}
