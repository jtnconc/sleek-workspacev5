/** Tiny bridge so the header toolbar can format the notes editor. */
let editor: HTMLElement | null = null;

/** Last caret position, as a plain-text character offset inside the editor. */
let savedCaretOffset: number | null = null;

/** Base font size (px) configured in Settings, applied to the editor root. */
export const DEFAULT_NOTES_FONT_SIZE = 16;
let baseFontSize: number = DEFAULT_NOTES_FONT_SIZE;
const baseFontSizeListeners = new Set<(px: number) => void>();

/** Base font family configured in Settings, persisted so it survives reloads. */
export const DEFAULT_NOTES_FONT_FAMILY =
  "Inter, ui-sans-serif, system-ui, sans-serif";
const FONT_FAMILY_STORAGE_KEY = "notes-font-family";
let baseFontFamily: string = (() => {
  if (typeof window === "undefined") return DEFAULT_NOTES_FONT_FAMILY;
  try {
    return (
      window.localStorage.getItem(FONT_FAMILY_STORAGE_KEY) ??
      DEFAULT_NOTES_FONT_FAMILY
    );
  } catch {
    return DEFAULT_NOTES_FONT_FAMILY;
  }
})();
const baseFontFamilyListeners = new Set<(family: string) => void>();

export function registerNotesEditor(el: HTMLElement | null) {
  editor = el;
  if (el) {
    el.style.fontSize = `${baseFontSize}px`;
    el.style.fontFamily = baseFontFamily;
  }
}

/** Subscribe to Settings font-size changes (used by the editor itself). */
export function subscribeNotesBaseFontSize(cb: (px: number) => void) {
  baseFontSizeListeners.add(cb);
  return () => {
    baseFontSizeListeners.delete(cb);
  };
}

/**
 * Sets the editor-wide font size (Settings). Applied straight to the
 * contentEditable root so an empty editor/line already has the right
 * typography — and therefore the right caret height — before the first
 * character is typed. Per-character sized spans still win over this.
 */
export function setNotesBaseFontSize(px: number) {
  baseFontSize = px;
  if (editor) editor.style.fontSize = `${px}px`;
  baseFontSizeListeners.forEach((cb) => cb(px));
}

export function getNotesBaseFontSize(): number {
  return baseFontSize;
}

/** Subscribe to Settings font-family changes (used by the editor itself). */
export function subscribeNotesBaseFontFamily(cb: (family: string) => void) {
  baseFontFamilyListeners.add(cb);
  return () => {
    baseFontFamilyListeners.delete(cb);
  };
}

/**
 * Sets the editor-wide font family (Settings). Applied to the contentEditable
 * root like the base font size, and persisted to localStorage so the choice
 * survives a reload. Per-character family spans still win over this.
 */
export function setNotesBaseFontFamily(family: string) {
  baseFontFamily = family;
  if (editor) editor.style.fontFamily = family;
  try {
    window.localStorage.setItem(FONT_FAMILY_STORAGE_KEY, family);
  } catch {
    /* ignore */
  }
  baseFontFamilyListeners.forEach((cb) => cb(family));
}

export function getNotesBaseFontFamily(): string {
  return baseFontFamily;
}

/** Last selection inside the editor, cloned so panels can steal focus safely. */
let savedRange: Range | null = null;

/** Snapshots the current selection if it sits inside the Notes editor. */
export function saveNotesSelection() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && isNotesSelectionActive()) {
    savedRange = sel.getRangeAt(0).cloneRange();
  }
}

/** Restores the snapshot taken by saveNotesSelection, refocusing the editor. */
export function restoreNotesSelection() {
  if (!savedRange || !editor) return;
  editor.focus();
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(savedRange);
}

/** Total plain-text length of a node's contents. */
function textLength(node: Node): number {
  return node.textContent?.length ?? 0;
}

/** Plain-text offset of a (container, offset) position inside `root`. */
function offsetOf(root: HTMLElement, container: Node, offset: number): number {
  let total = 0;
  if (container.nodeType === Node.TEXT_NODE) {
    total = offset;
  } else {
    for (let i = 0; i < offset && i < container.childNodes.length; i += 1) {
      total += textLength(container.childNodes[i]!);
    }
  }
  let node: Node | null = container;
  while (node && node !== root) {
    let sib = node.previousSibling;
    while (sib) {
      total += textLength(sib);
      sib = sib.previousSibling;
    }
    node = node.parentNode;
  }
  return total;
}

/** Saves the caret position if the selection currently sits in the editor. */
export function saveNotesCaret() {
  const el = editor;
  const sel = window.getSelection();
  if (!el || !sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.startContainer)) return;
  savedCaretOffset = offsetOf(el, range.startContainer, range.startOffset);
}

export function getSavedNotesCaret(): number | null {
  return savedCaretOffset;
}

export function clearSavedNotesCaret() {
  savedCaretOffset = null;
}

/**
 * Restores the saved caret offset inside `el`. Returns false when there is
 * nothing saved, so the caller can fall back to placing the caret at the end.
 */
export function restoreNotesCaret(el: HTMLElement): boolean {
  if (savedCaretOffset === null) return false;
  const sel = window.getSelection();
  if (!sel) return false;

  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let remaining = savedCaretOffset;
  let target: Text | null = null;
  let targetOffset = 0;
  let node = walker.nextNode() as Text | null;
  while (node) {
    const len = node.data.length;
    if (remaining <= len) {
      target = node;
      targetOffset = remaining;
      break;
    }
    remaining -= len;
    node = walker.nextNode() as Text | null;
  }

  const range = document.createRange();
  if (target) {
    range.setStart(target, targetOffset);
  } else {
    range.selectNodeContents(el);
    range.collapse(false);
  }
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  return true;
}

/**
 * Puts a fresh collapsed range inside a just-cleared (empty) editor so the
 * browser keeps a live selection and the custom caret stays visible.
 */
export function resetEditorSelection(el: HTMLElement) {
  el.focus();
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  savedCaretOffset = 0;
}


function withEditor(fn: (el: HTMLElement) => void) {
  if (!editor) return;
  editor.focus();
  const sel = window.getSelection();
  if (sel && sel.rangeCount === 0) {
    const r = document.createRange();
    r.selectNodeContents(editor);
    r.collapse(false);
    sel.addRange(r);
  }
  fn(editor);
  editor.dispatchEvent(new Event("input", { bubbles: true }));
}

export function execNotesCommand(command: string, value?: string) {
  withEditor(() => {
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(command, false, value);
  });
}

/** Toggles a bulleted list (`<ul><li>`) around the current selection/line. */
export function toggleNotesList() {
  execNotesCommand("insertUnorderedList");
}

/**
 * Wraps the current selection in a `<mark style="background-color: …">` using
 * the chosen pastel background and its matching saturated text color.
 */
export function applyNotesHighlight(bgColor: string, textColor: string) {
  withEditor(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;

    const mark = document.createElement("mark");
    mark.style.backgroundColor = bgColor;
    mark.style.color = textColor;
    mark.appendChild(range.extractContents());
    range.insertNode(mark);

    // Keep the highlighted text selected after applying.
    sel.removeAllRanges();
    const next = document.createRange();
    next.selectNodeContents(mark);
    sel.addRange(next);
  });
}

export function insertNotesImage(dataUrl: string) {
  withEditor(() => {
    document.execCommand(
      "insertHTML",
      false,
      `<img src="${dataUrl}" alt="" style="max-width:100%;border-radius:10px;margin:6px 0;" />`,
    );
  });
}

const ZWSP = "\u200B";

/**
 * Applies an exact pixel font size.
 *
 * execCommand("fontSize") is not used at all: with styleWithCSS enabled Chrome
 * emits `<span style="font-size: xxx-large">` (no `<font size="7">` marker to
 * swap), so the exact px value was silently lost. Instead every text node the
 * selection touches is wrapped in its own `<span style="font-size:Npx">`,
 * which keeps nested bold/italic/color intact and works across element
 * boundaries.
 *
 * With a collapsed caret we insert an empty sized span holding a zero-width
 * space and put the caret inside it, so the next typed characters inherit the
 * chosen size ("pending style" behaviour).
 */
export function applyNotesFontSize(px: number) {
  applyNotesInlineStyle("fontSize", `${px}px`);
}

/**
 * Applies a font family using the same sticky-span technique as font size, so
 * a collapsed caret carries the choice forward into newly typed characters.
 */
export function applyNotesFontFamily(family: string) {
  applyNotesInlineStyle("fontFamily", family);
}

type InlineStyleProp = "fontSize" | "fontFamily";

function applyNotesInlineStyle(prop: InlineStyleProp, value: string) {
  const el = editor;
  if (!el) {
    console.warn("[notes-format] applyNotesInlineStyle called with no editor registered");
    return;
  }
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.anchorNode || !el.contains(sel.anchorNode)) {
    return;
  }

  const range = sel.getRangeAt(0);

  const sized = (child: Node) => {
    const span = document.createElement("span");
    span.style[prop] = value;
    span.appendChild(child);
    return span;
  };

  if (range.collapsed) {
    el.focus();
    const span = sized(document.createTextNode(ZWSP));
    range.insertNode(span);
    const next = document.createRange();
    next.setStart(span.firstChild!, 1);
    next.collapse(true);
    sel.removeAllRanges();
    sel.addRange(next);
  } else {
    // Split the boundary text nodes so only the selected part gets wrapped.
    if (range.startContainer.nodeType === Node.TEXT_NODE && range.startOffset > 0) {
      const node = (range.startContainer as Text).splitText(range.startOffset);
      range.setStart(node, 0);
    }
    if (
      range.endContainer.nodeType === Node.TEXT_NODE &&
      range.endOffset < (range.endContainer as Text).length
    ) {
      (range.endContainer as Text).splitText(range.endOffset);
    }

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const targets: Text[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (!node.nodeValue) continue;
      if (range.intersectsNode(node) && sel.containsNode(node, true)) targets.push(node);
    }

    const wrappers: HTMLElement[] = [];
    targets.forEach((node) => {
      const parent = node.parentElement;
      // Reuse an existing span that wraps exactly this text node.
      if (
        parent &&
        parent !== el &&
        parent.tagName === "SPAN" &&
        parent.childNodes.length === 1
      ) {
        parent.style[prop] = value;
        wrappers.push(parent);
        return;
      }
      const span = sized(document.createTextNode(node.nodeValue ?? ""));
      node.replaceWith(span);
      wrappers.push(span);
    });

    if (wrappers.length > 0) {
      const next = document.createRange();
      next.setStartBefore(wrappers[0]!);
      next.setEndAfter(wrappers[wrappers.length - 1]!);
      sel.removeAllRanges();
      sel.addRange(next);
    }
  }

  el.dispatchEvent(new Event("input", { bubbles: true }));
}




/** True when the caret/selection currently sits inside the notes editor. */
export function isNotesSelectionActive(): boolean {
  const sel = window.getSelection();
  if (!editor || !sel || sel.rangeCount === 0 || !sel.anchorNode) return false;
  return editor.contains(sel.anchorNode);
}

/** Reads the font size (px) at the current caret/selection, if any. */
export function getNotesFontSize(): number | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !isNotesSelectionActive()) return null;
  const node = sel.anchorNode;
  if (!node) return null;
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  if (!el) return null;
  const size = window.getComputedStyle(el).fontSize;
  const parsed = Number.parseFloat(size);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

/** Reads the font family at the current caret/selection, if any. */
export function getNotesFontFamily(): string | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !isNotesSelectionActive()) return null;
  const node = sel.anchorNode;
  if (!node) return null;
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  if (!el) return null;
  return window.getComputedStyle(el).fontFamily || null;
}
