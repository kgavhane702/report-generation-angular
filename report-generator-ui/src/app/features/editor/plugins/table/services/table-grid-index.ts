import type { TableCell, TableRow, TableWidgetProps } from '../../../../../models/widget.model';

export type ColumnTargetKind = 'whole' | 'leaf';

export type ColumnCatalogEntry =
  | { kind: 'whole'; topColIndex: number; name: string }
  | { kind: 'leaf'; topColIndex: number; leafPath: number[]; name: string };

/**
 * Pure derived view-model over a table grid.
 *
 * Phase-1 intent: centralize merge+split traversal and header naming so UI + services can share it later.
 * This file is intentionally dependency-free (no Angular).
 */
export class TableGridIndex {
  private readonly htmlTextCache = new Map<string, string>();

  readonly rows: TableRow[];
  readonly colCount: number;

  constructor(readonly props: TableWidgetProps | null) {
    this.rows = Array.isArray(props?.rows) ? (props!.rows as any) : [];
    this.colCount = this.getColumnCount(this.rows, props);
  }

  /**
   * Build selectable column targets (whole columns + split-leaf columns), including display labels.
   * Mirrors the current dropdown behavior in `TableColumnRulesDialogComponent`.
   */
  buildColumnCatalog(): ColumnCatalogEntry[] {
    const props = this.props;
    const rows = this.rows;

    const colCount = this.colCount;
    if (colCount <= 0) return [];

    const headerRowCountForNaming = this.getHeaderRowCountForNaming(props, rows, colCount);

    const out: ColumnCatalogEntry[] = [];
    const seen = new Set<string>();

    const colIndices = Array.from({ length: colCount }, (_, i) => i).filter((i) => !this.isColumnAlwaysCovered(rows, i));

    for (const colIndex of colIndices) {
      const leafColPaths = this.getLeafColPathsForTopCol(rows, headerRowCountForNaming, colIndex);
      const hasLeafCols = leafColPaths.length > 0;

      // 1) Leaf column targets (split-cols behave like real columns)
      if (hasLeafCols) {
        for (const leafPath of leafColPaths) {
          const parts: string[] = [];
          for (let r = 0; r < headerRowCountForNaming; r++) {
            const resolved = this.getResolvedCellAt(rows, r, colIndex);
            if (!resolved) continue;
            const layers = this.getHeaderCellLayersForLeafCol(resolved, leafPath, 0);
            for (const label of layers) {
              if (!label) continue;
              const last = parts[parts.length - 1];
              if (last !== label) parts.push(label);
            }
          }
          const name = parts.join(' > ') || `Column ${colIndex + 1}`;
          const key = `leaf:${colIndex}:${leafPath.join('-')}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ topColIndex: colIndex, kind: 'leaf', leafPath, name });
        }
      }

      // 2) Whole top-level column target
      {
        const parts: string[] = [];
        for (let r = 0; r < headerRowCountForNaming; r++) {
          const resolved = this.getResolvedCellAt(rows, r, colIndex);
          if (!resolved) continue;
          const layers = this.getHeaderCellLayersWhole(resolved, 0);
          for (const label of layers) {
            if (!label) continue;
            const last = parts[parts.length - 1];
            if (last !== label) parts.push(label);
          }
        }

        const baseName = parts.join(' > ') || `Column ${colIndex + 1}`;
        const name = hasLeafCols ? `${baseName} (whole)` : baseName;
        const key = `whole:${colIndex}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ topColIndex: colIndex, kind: 'whole', name });
        }
      }
    }

    return out;
  }

  // ─────────────────────────────────────────────────────────────────
  // Column + header naming (mirrors current UI behavior)
  // ─────────────────────────────────────────────────────────────────

  private getColumnCount(rows: any[], props: TableWidgetProps | null): number {
    const fromRows = Math.max(0, ...rows.map((r) => (Array.isArray(r?.cells) ? r.cells.length : 0)));
    const fromFractions = Array.isArray(props?.columnFractions) ? (props!.columnFractions!.length as number) : 0;
    return Math.max(1, fromRows, fromFractions || 0);
  }

  private getEffectiveHeaderRowCount(props: TableWidgetProps | null): number {
    if (!props?.headerRow) return 0;
    const n =
      typeof (props as any).headerRowCount === 'number' && Number.isFinite((props as any).headerRowCount)
        ? Math.trunc((props as any).headerRowCount)
        : 1;
    return Math.max(0, n);
  }

  private getHeaderRowCountForNaming(props: TableWidgetProps | null, rows: any[], colCount: number): number {
    if (!Array.isArray(rows) || rows.length === 0) return 0;
    if (!props?.headerRow) return 0;

    const persisted = Math.max(1, Math.min(4, this.getEffectiveHeaderRowCount(props) || 1));
    const metaDepth = this.getHeaderDepthFromMeta(rows, persisted, colCount);
    const effective = Math.max(persisted, metaDepth);

    if (effective < 2 && rows.length >= 2 && this.looksLikeTwoHeaderRows(rows, colCount)) {
      return 2;
    }

    const capped = Math.min(4, rows.length, effective);
    return this.clampHeaderRowCountForNaming(rows, capped, colCount, persisted);
  }

  private looksLikeTwoHeaderRows(rows: any[], colCount: number): boolean {
    const row0 = rows[0];
    const row1 = rows[1];
    if (!row0 || !row1) return false;

    const hasMergeMeta = (row: any): boolean => {
      const cells = Array.isArray(row?.cells) ? row.cells : [];
      return cells.some((c: any) => !!c?.merge && !c?.coveredBy);
    };
    if (!hasMergeMeta(row0)) return false;

    const labels0 = this.getRowLabels(row0, rows, 0, colCount);
    const labels1 = this.getRowLabels(row1, rows, 1, colCount);

    const nonEmpty0 = labels0.filter(Boolean);
    const nonEmpty1 = labels1.filter(Boolean);

    const uniq0 = new Set(nonEmpty0.map((s) => s.toLowerCase())).size;
    const uniq1 = new Set(nonEmpty1.map((s) => s.toLowerCase())).size;

    const hasManyLabels = nonEmpty1.length >= Math.ceil(colCount * 0.6);
    const hasMoreDistinct = uniq1 >= uniq0 + 2;
    return hasManyLabels && hasMoreDistinct;
  }

  private getHeaderDepthFromMeta(rows: any[], baseHeaderCount: number, colCount: number): number {
    const maxRows = Math.min(4, rows.length);
    const rowHasMeta = (row: any): boolean => {
      const cells = Array.isArray(row?.cells) ? row.cells : [];
      return cells.some((c: any) => !!c?.merge && !c?.coveredBy);
    };

    const isNumericish = (txt: string): boolean => {
      const s = (txt ?? '').toString().trim();
      if (!s) return false;
      const isNum = (x: string) => /^[0-9.\-+, ]+$/.test((x ?? '').toString().trim());
      if (isNum(s)) return true;
      if (s.includes('/')) {
        const parts = s
          .split('/')
          .map((p) => p.trim())
          .filter(Boolean);
        return parts.length > 0 && parts.every(isNum);
      }
      return false;
    };

    let depth = 0;
    for (let r = 0; r < maxRows; r++) {
      if (!rowHasMeta(rows[r])) break;

      if (r >= Math.max(1, Math.trunc(baseHeaderCount || 0))) {
        const labels = this.getRowLabels(rows[r], rows, r, colCount).filter(Boolean);
        const nonEmpty = labels.length;
        const numeric = labels.filter(isNumericish).length;
        const ratio = nonEmpty > 0 ? numeric / nonEmpty : 0;
        if (nonEmpty >= 1 && ratio >= 0.9) break;
      }

      depth = r + 1;
    }
    return depth;
  }

  private clampHeaderRowCountForNaming(rows: any[], requested: number, colCount: number, baseHeaderCount: number): number {
    const max = Math.max(0, Math.min(4, rows.length, Math.trunc(requested || 0)));
    if (max <= 1) return max;
    const base = Math.max(0, Math.min(max, Math.trunc(baseHeaderCount || 0)));

    const isNumericish = (txt: string): boolean => {
      const s = (txt ?? '').toString().trim();
      if (!s) return false;
      const isNum = (x: string) => /^[0-9.\-+, ]+$/.test((x ?? '').toString().trim());
      if (isNum(s)) return true;
      if (s.includes('/')) {
        const parts = s
          .split('/')
          .map((p) => p.trim())
          .filter(Boolean);
        return parts.length > 0 && parts.every(isNum);
      }
      return false;
    };

    for (let r = 1; r < max; r++) {
      const labels = this.getRowLabels(rows[r], rows, r, colCount).filter(Boolean);
      const nonEmpty = labels.length;
      const numeric = labels.filter(isNumericish).length;
      const ratio = nonEmpty > 0 ? numeric / nonEmpty : 0;

      if (r >= base && nonEmpty >= 1 && ratio >= 0.9) return r;
      if (nonEmpty >= 2 && ratio >= 0.7) return r;
    }

    return max;
  }

  private isColumnAlwaysCovered(rows: any[], colIndex: number): boolean {
    if (!Array.isArray(rows) || rows.length === 0) return false;
    let sawCell = false;
    for (let r = 0; r < rows.length; r++) {
      const cells = Array.isArray(rows[r]?.cells) ? rows[r].cells : [];
      const cell = cells[colIndex] as any;
      if (!cell) continue;
      sawCell = true;
      if (!cell.coveredBy) return false;
    }
    return sawCell;
  }

  // ─────────────────────────────────────────────────────────────────
  // Merge resolution
  // ─────────────────────────────────────────────────────────────────

  private getRowLabels(row: any, rows: any[], rowIndex: number, colCount: number): string[] {
    const cells = Array.isArray(row?.cells) ? row.cells : [];
    return Array.from({ length: colCount }, (_, colIndex) => {
      const cell = cells[colIndex] as TableCell | undefined;
      const resolved = this.resolveCoveredCell(rows, rowIndex, colIndex, cell);
      return resolved ? this.getCellLabel(resolved) : '';
    });
  }

  private getResolvedCellAt(rows: any[], rowIndex: number, colIndex: number): TableCell | null {
    const row = rows[rowIndex];
    const cells = Array.isArray(row?.cells) ? row.cells : [];
    const cell = cells[colIndex] as TableCell | undefined;
    return this.resolveCoveredCell(rows, rowIndex, colIndex, cell);
  }

  private resolveCoveredCell(rows: any[], rowIndex: number, colIndex: number, cell: TableCell | undefined): TableCell | null {
    let cur: any = cell ?? null;
    let guard = 0;
    while (cur && cur.coveredBy && guard < 6) {
      const r = Number(cur.coveredBy.row);
      const c = Number(cur.coveredBy.col);
      if (!Number.isFinite(r) || !Number.isFinite(c)) break;
      const nextRow = rows[r];
      const next = (Array.isArray(nextRow?.cells) ? nextRow.cells[c] : null) as any;
      if (!next || next === cur) break;
      cur = next;
      guard++;
    }
    return cur as TableCell | null;
  }

  // ─────────────────────────────────────────────────────────────────
  // Split traversal + header layers
  // ─────────────────────────────────────────────────────────────────

  private getCellLabel(cell: TableCell): string {
    const layers = this.getHeaderCellLayersWhole(cell, 0);
    return layers.join(' > ');
  }

  private getLeafColPathsForTopCol(rows: any[], headerRowCount: number, topColIndex: number): number[][] {
    const encode = (p: number[]) => p.join('-');
    const decode = (s: string): number[] =>
      (s ?? '')
        .toString()
        .trim()
        .split('-')
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n) && n >= 0)
        .map((n) => Math.trunc(n));

    const safe = Math.max(0, Math.min(rows.length, Math.trunc(headerRowCount || 0)));
    for (let r = 0; r < safe; r++) {
      const resolved = this.getResolvedCellAt(rows, r, topColIndex);
      if (!resolved) continue;
      const rowSet = new Set<string>();
      for (const p of this.collectLeafColPaths(resolved, 0)) {
        if (Array.isArray(p) && p.length > 0) rowSet.add(encode(p));
      }

      // Prefer the first relevant header layer that actually defines split leaf columns.
      // This avoids path noise from unioning multiple header rows with different structures.
      if (rowSet.size > 0) {
        const segs = (s: string) => s.split('-').map((x) => Number(x));
        return Array.from(rowSet)
          .sort((a, b) => {
            const A = segs(a);
            const B = segs(b);
            const n = Math.max(A.length, B.length);
            for (let i = 0; i < n; i++) {
              const av = Number.isFinite(A[i]) ? (A[i] as number) : -1;
              const bv = Number.isFinite(B[i]) ? (B[i] as number) : -1;
              if (av !== bv) return av - bv;
            }
            return a.localeCompare(b);
          })
          .map(decode);
      }
    }

    return [];
  }

  private collectLeafColPaths(cell: TableCell | null | undefined, depth: number): number[][] {
    if (!cell || depth > 8) return [];
    const split = (cell as any)?.split as { rows?: number; cols?: number; cells?: any[] } | undefined;
    if (!split || !Array.isArray(split.cells)) return [];

    const rows = Math.max(1, Math.trunc(split.rows ?? 1));
    const cols = Math.max(1, Math.trunc(split.cols ?? 1));

    if (cols > 1) {
      const encode = (p: number[]) => p.join('-');
      const decode = (s: string): number[] =>
        (s ?? '')
          .toString()
          .trim()
          .split('-')
          .map((x) => Number(x))
          .filter((n) => Number.isFinite(n) && n >= 0)
          .map((n) => Math.trunc(n));

      const out: number[][] = [];
      for (let c = 0; c < cols; c++) {
        const nested = new Set<string>();
        for (let r = 0; r < rows; r++) {
          const idx = r * cols + c;
          const sub = split.cells[idx] as TableCell | undefined;
          const inner = this.collectLeafColPaths(sub, depth + 1);
          for (const p of inner) nested.add(encode(p));
        }
        if (nested.size === 0) {
          out.push([c]);
        } else {
          for (const p of nested) out.push([c, ...decode(p)]);
        }
      }
      return out;
    }

    const encode = (p: number[]) => p.join('-');
    const decode = (s: string): number[] =>
      (s ?? '')
        .toString()
        .trim()
        .split('-')
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n) && n >= 0)
        .map((n) => Math.trunc(n));

    const nestedAll = new Set<string>();
    for (let r = 0; r < rows; r++) {
      const sub = split.cells[r * cols] as TableCell | undefined;
      const inner = this.collectLeafColPaths(sub, depth + 1);
      for (const p of inner) nestedAll.add(encode(p));
    }
    return Array.from(nestedAll).map(decode);
  }

  private getHeaderCellLayersForLeafCol(cell: TableCell | null | undefined, leafPath: number[], depth: number): string[] {
    if (!cell || depth > 8) return [];

    const own = this.htmlToText(cell.contentHtml ?? '');
    if (own) return [own];

    const split = (cell as any)?.split as { rows?: number; cols?: number; cells?: any[] } | undefined;
    if (!split || !Array.isArray(split.cells)) return [];

    const rows = Math.max(1, Math.trunc(split.rows ?? 1));
    const cols = Math.max(1, Math.trunc(split.cols ?? 1));

    const parts = Array.isArray(leafPath) ? leafPath : [];
    const pickCol = cols > 1 ? Number(parts[0]) : 0;
    const rest = cols > 1 ? parts.slice(1) : parts;

    const colIdx = Number.isFinite(pickCol) && pickCol >= 0 && pickCol < cols ? pickCol : 0;

    const layers: string[] = [];
    for (let r = 0; r < rows; r++) {
      const idx = r * cols + colIdx;
      const sub = split.cells[idx] as TableCell | undefined;
      const subLayers = this.getHeaderCellLayersForLeafCol(sub, rest, depth + 1);
      const txt = subLayers.join(' / ');
      if (txt) layers.push(txt);
    }

    const deduped: string[] = [];
    for (const l of layers) {
      if (!l) continue;
      if (deduped[deduped.length - 1] !== l) deduped.push(l);
    }

    return deduped.slice(0, 6);
  }

  private getHeaderCellLayersWhole(cell: TableCell | null | undefined, depth: number): string[] {
    if (!cell || depth > 8) return [];

    const own = this.htmlToText(cell.contentHtml ?? '');
    if (own) return [own];

    const split = (cell as any)?.split as { rows?: number; cols?: number; cells?: any[] } | undefined;
    if (!split || !Array.isArray(split.cells)) return [];

    const rows = Math.max(1, Math.trunc(split.rows ?? 1));
    const cols = Math.max(1, Math.trunc(split.cols ?? 1));

    const layers: string[] = [];
    for (let r = 0; r < rows; r++) {
      const rowParts: string[] = [];
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const sub = split.cells[idx] as TableCell | undefined;
        const subLayers = this.getHeaderCellLayersWhole(sub, depth + 1);
        const txt = subLayers.join(' / ');
        if (txt) rowParts.push(txt);
      }
      const uniq = Array.from(new Set(rowParts));
      if (uniq.length > 0) layers.push(uniq.join(' / '));
    }

    return layers.slice(0, 6);
  }

  // ─────────────────────────────────────────────────────────────────
  // HTML → text (shared)
  // ─────────────────────────────────────────────────────────────────

  private htmlToText(html: string): string {
    const key = html ?? '';
    const cached = this.htmlTextCache.get(key);
    if (cached !== undefined) return cached;

    // Prefer DOM parsing when available; otherwise fall back to a conservative strip.
    let text = '';
    try {
      if (typeof document !== 'undefined') {
        const el = document.createElement('div');
        el.innerHTML = key;
        text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      } else {
        text = (key ?? '').toString().replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      }
    } catch {
      text = (key ?? '').toString().replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    this.htmlTextCache.set(key, text);
    return text;
  }

  /**
   * Convert the widget leaf `path` (row-major indices through split grids) into a *leaf column path*,
   * which is the sequence of column indices encountered only across splits where `cols > 1`.
   *
   * This is used to match `ColumnTarget.kind === 'leaf'` against rendered split sub-cells.
   */
  static leafColPathForRenderedCell(
    rows: TableRow[],
    rowIndex: number,
    topColIndex: number,
    leafPath: string
  ): number[] | null {
    const p = (leafPath ?? '').toString().trim();
    if (!p) return null;

    const baseRow = rows?.[rowIndex];
    const baseCell = (Array.isArray(baseRow?.cells) ? baseRow.cells[topColIndex] : null) as any;
    if (!baseCell) return null;

    const indices = p
      .split('-')
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n) && n >= 0)
      .map((n) => Math.trunc(n));
    if (indices.length === 0) return null;

    let cur: any = baseCell;
    const outCols: number[] = [];

    for (const idx of indices) {
      const split = cur?.split as { rows?: number; cols?: number; cells?: any[] } | undefined;
      if (!split || !Array.isArray(split.cells)) return outCols.length > 0 ? outCols : null;

      const cols = Math.max(1, Math.trunc(split.cols ?? 1));
      const col = idx % cols;
      if (cols > 1) outCols.push(col);

      const next = split.cells[idx];
      if (!next) break;
      cur = next;
    }

    return outCols.length > 0 ? outCols : null;
  }
}


