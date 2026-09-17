import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  addNotesTableColumn,
  addNotesTableRow,
  deleteNotesTableColumn,
  deleteNotesTableRow,
  notesTableColumnCount,
  notifyNotesTableChange,
  NOTES_TABLE_MAX_COLS,
  NOTES_TABLE_MAX_ROWS,
  reorderNotesTableRow,
} from "./notes-format";

type Props = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  editorRef: React.RefObject<HTMLDivElement | null>;
};

type Hover = { table: HTMLTableElement; col: number; row: number } | null;
type MenuKind = "col" | "row" | null;

/** Rect of `el` expressed in the container's scrollable coordinate space. */
function relRect(el: Element, container: HTMLElement) {
  const r = el.getBoundingClientRect();
  const c = container.getBoundingClientRect();
  return {
    top: r.top - c.top + container.scrollTop,
    left: r.left - c.left + container.scrollLeft,
    width: r.width,
    height: r.height,
  };
}

export function NotesTableOverlay({ containerRef, editorRef }: Props) {
  const [hover, setHover] = useState<Hover>(null);
  const [menu, setMenu] = useState<MenuKind>(null);
  const [, forceTick] = useState(0);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const draggingRef = useRef(false);
  const busyRef = useRef(false);

  const refresh = useCallback(() => forceTick((t) => t + 1), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onMove = (e: MouseEvent) => {
      if (busyRef.current || menu) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-table-overlay-control]")) return;
      const cell = target.closest("td, th") as HTMLTableCellElement | null;
      const table = cell?.closest(
        "table[data-notes-table]",
      ) as HTMLTableElement | null;
      if (!cell || !table || !editorRef.current?.contains(table)) {
        setHover(null);
        return;
      }
      const row = cell.parentElement as HTMLTableRowElement;
      setHover({ table, col: cell.cellIndex, row: row.rowIndex });
    };
    const onLeave = () => {
      if (busyRef.current || menu) return;
      setHover(null);
    };

    container.addEventListener("mousemove", onMove);
    container.addEventListener("mouseleave", onLeave);
    container.addEventListener("scroll", refresh);
    return () => {
      container.removeEventListener("mousemove", onMove);
      container.removeEventListener("mouseleave", onLeave);
      container.removeEventListener("scroll", refresh);
    };
  }, [containerRef, editorRef, menu, refresh]);

  // Close menus on outside click.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("[data-table-overlay-control]")) return;
      setMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menu]);

  const container = containerRef.current;
  if (!container || !hover) return null;
  const { table, col, row } = hover;
  if (!table.isConnected) return null;

  const rows = Array.from(table.rows);
  const colCount = notesTableColumnCount(table);
  const headerCells = Array.from(rows[0]?.cells ?? []);
  const hoveredCell = headerCells[col];
  const hoveredRow = rows[row];
  if (!hoveredCell || !hoveredRow) return null;

  const tableRect = relRect(table, container);
  const colRect = relRect(hoveredCell, container);
  const rowRect = relRect(hoveredRow, container);

  const after = (fn: () => void) => {
    fn();
    notifyNotesTableChange();
    setMenu(null);
    setHover(null);
  };

  const stop = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const startResize = (boundary: number, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    busyRef.current = true;
    const cells = Array.from(rows[0]?.cells ?? []);
    const widths = cells.map((c) => c.getBoundingClientRect().width);
    const total = table.getBoundingClientRect().width;
    let colgroup = table.querySelector("colgroup");
    if (!colgroup) {
      colgroup = document.createElement("colgroup");
      cells.forEach(() => colgroup!.appendChild(document.createElement("col")));
      table.insertBefore(colgroup, table.firstChild);
    }
    const cols = Array.from(colgroup.children) as HTMLTableColElement[];
    cols.forEach((c, i) => {
      c.style.width = `${widths[i] ?? 0}px`;
    });
    table.style.width = `${total}px`;

    const leftIdx = boundary - 1;
    const rightIdx = boundary;
    const startX = e.clientX;
    const startLeft = widths[leftIdx] ?? 0;
    const startRight = widths[rightIdx] ?? 0;
    const pair = startLeft + startRight;

    const onMove = (ev: PointerEvent) => {
      let left = startLeft + (ev.clientX - startX);
      left = Math.max(40, Math.min(pair - 40, left));
      if (cols[leftIdx]) cols[leftIdx].style.width = `${left}px`;
      if (cols[rightIdx]) cols[rightIdx].style.width = `${pair - left}px`;
      refresh();
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      busyRef.current = false;
      notifyNotesTableChange();
      refresh();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const startRowDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    busyRef.current = true;
    draggingRef.current = false;
    const startY = e.clientY;

    const onMove = (ev: PointerEvent) => {
      if (!draggingRef.current && Math.abs(ev.clientY - startY) < 4) return;
      draggingRef.current = true;
      let index = rows.length - 1;
      for (let i = 0; i < rows.length; i += 1) {
        const r = rows[i]!.getBoundingClientRect();
        if (ev.clientY < r.top + r.height / 2) {
          index = i;
          break;
        }
      }
      setDropIndex(index);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      busyRef.current = false;
      if (draggingRef.current) {
        const target = dropIndexRef.current;
        if (target !== null) {
          reorderNotesTableRow(table, row, target);
          notifyNotesTableChange();
        }
        setDropIndex(null);
        setHover(null);
      } else {
        setMenu("row");
      }
      draggingRef.current = false;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // Keep the latest drop index readable from the pointerup closure.
  dropIndexRef.current = dropIndex;

  const menuItem = (
    label: string,
    onClick: () => void,
    opts?: { disabled?: boolean; destructive?: boolean },
  ) => (
    <button
      type="button"
      disabled={opts?.disabled}
      onMouseDown={stop}
      onClick={(e) => {
        stop(e);
        onClick();
      }}
      className={cn(
        "w-full whitespace-nowrap rounded-md px-2 py-1 text-left text-[12px] transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40",
        opts?.destructive ? "text-destructive" : "text-popover-foreground",
      )}
    >
      {label}
    </button>
  );

  const dropRow = dropIndex !== null ? rows[dropIndex] : null;
  const dropTop = dropRow
    ? relRect(dropRow, container).top
    : tableRect.top + tableRect.height;

  return (
    <>
      {/* Column pill */}
      <div
        data-table-overlay-control
        onMouseDown={stop}
        onClick={stop}
        className="absolute z-20"
        style={{
          top: Math.max(2, tableRect.top - 20),
          left: colRect.left,
          width: colRect.width,
        }}
      >
        <button
          type="button"
          onMouseDown={stop}
          onClick={(e) => {
            stop(e);
            setMenu(menu === "col" ? null : "col");
          }}
          className="mx-auto flex h-[18px] items-center gap-0.5 rounded-full border border-border bg-secondary px-3 text-[10px] leading-none text-muted-foreground transition-colors hover:bg-muted"
          aria-label="Column options"
        >
          <span className="tracking-widest">···</span>
          <ChevronDown className="size-2.5" />
        </button>
        {menu === "col" && (
          <div className="absolute left-1/2 top-[22px] z-30 w-[170px] -translate-x-1/2 rounded-lg border border-border bg-popover p-1 shadow-lg">
            {menuItem(
              "Add Column Before",
              () => after(() => addNotesTableColumn(table, col, "before")),
              { disabled: colCount >= NOTES_TABLE_MAX_COLS },
            )}
            {menuItem(
              "Add Column After",
              () => after(() => addNotesTableColumn(table, col, "after")),
              { disabled: colCount >= NOTES_TABLE_MAX_COLS },
            )}
            {menuItem(
              "Delete Column",
              () => after(() => deleteNotesTableColumn(table, col)),
              { disabled: colCount <= 1, destructive: true },
            )}
          </div>
        )}
      </div>

      {/* Row grip */}
      <div
        data-table-overlay-control
        onClick={stop}
        className="absolute z-20"
        style={{ top: rowRect.top, left: Math.max(2, tableRect.left - 20), height: rowRect.height }}
      >
        <button
          type="button"
          onPointerDown={startRowDrag}
          onClick={stop}
          aria-label="Row options"
          className="flex h-full w-[18px] cursor-grab items-center justify-center rounded-md border border-border bg-secondary text-muted-foreground transition-colors hover:bg-muted active:cursor-grabbing"
        >
          <GripVertical className="size-3" />
        </button>
        {menu === "row" && (
          <div className="absolute left-[22px] top-0 z-30 w-[150px] rounded-lg border border-border bg-popover p-1 shadow-lg">
            {menuItem(
              "Add Row Above",
              () => after(() => addNotesTableRow(table, row, "above")),
              { disabled: rows.length >= NOTES_TABLE_MAX_ROWS },
            )}
            {menuItem(
              "Add Row Below",
              () => after(() => addNotesTableRow(table, row, "below")),
              { disabled: rows.length >= NOTES_TABLE_MAX_ROWS },
            )}
            {menuItem(
              "Delete Row",
              () => after(() => deleteNotesTableRow(table, row)),
              { disabled: rows.length <= 1, destructive: true },
            )}
          </div>
        )}
      </div>

      {/* Column resize handles */}
      {headerCells.slice(1).map((cell, i) => {
        const r = relRect(cell, container);
        return (
          <div
            key={i}
            data-table-overlay-control
            onPointerDown={(e) => startResize(i + 1, e)}
            onClick={stop}
            className="absolute z-20 flex h-[16px] w-[16px] cursor-col-resize items-center justify-center"
            style={{ top: tableRect.top - 8, left: r.left - 8 }}
          >
            <span className="size-[6px] rounded-full bg-muted-foreground/60" />
          </div>
        );
      })}

      {/* Row drop indicator */}
      {dropIndex !== null && (
        <div
          data-table-overlay-control
          className="pointer-events-none absolute z-30 h-[2px] bg-muted-foreground"
          style={{ top: dropTop, left: tableRect.left, width: tableRect.width }}
        />
      )}
    </>
  );
}

const dropIndexRef = { current: null as number | null };
