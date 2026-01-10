import { Injectable } from '@angular/core';
import type {
  TableCell,
  TableCellStyle,
  TableColumnRuleSet,
  TableConditionRule,
  TableConditionThen,
  TableRow,
} from '../../../../../models/widget.model';

/**
 * Parsed comparable value from a cell for rule evaluation.
 */
export interface CellComparableValue {
  text: string;
  textLower: string;
  num: number | null;
  dateMs: number | null;
}

/**
 * Service that handles conditional formatting logic for table widgets.
 * Extracted to reduce file size and improve maintainability.
 */
@Injectable({ providedIn: 'root' })
export class TableConditionalFormattingService {
  private readonly htmlTextCache = new Map<string, string>();

  // ─────────────────────────────────────────────────────────────────
  // Text extraction
  // ─────────────────────────────────────────────────────────────────

  htmlToText(html: string): string {
    const key = html ?? '';
    const cached = this.htmlTextCache.get(key);
    if (cached !== undefined) return cached;

    const el = document.createElement('div');
    el.innerHTML = key;
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    this.htmlTextCache.set(key, text);
    return text;
  }

  // ─────────────────────────────────────────────────────────────────
  // Value parsing
  // ─────────────────────────────────────────────────────────────────

  parseNumber(text: string): number | null {
    const t = (text ?? '').trim();
    if (!t) return null;
    const normalized = t.replace(/[$€£¥₹,%]/g, '').replace(/\s+/g, '').replace(/,/g, '');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  parseDateMs(text: string): number | null {
    const t = (text ?? '').trim();
    if (!t) return null;
    const ms = Date.parse(t);
    return Number.isFinite(ms) ? ms : null;
  }

  getCellComparableValue(cell: TableCell): CellComparableValue {
    const text = this.htmlToText(cell?.contentHtml ?? '');
    return {
      text,
      textLower: text.toLowerCase(),
      num: this.parseNumber(text),
      dateMs: this.parseDateMs(text),
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Column key/name utilities
  // ─────────────────────────────────────────────────────────────────

  normalizeColumnKey(name: string): string {
    return (name ?? '').toString().trim().replace(/\s+/g, ' ').toLowerCase();
  }

  getHeaderCellLabel(cell: TableCell | null | undefined): string {
    const layers = this.getHeaderCellLayers(cell, 0);
    if (layers.length === 0) return '';
    // A split grid with 2+ rows is a vertical hierarchy; present it like a multi-row header.
    // Examples:
    // - 2x2: "f / s > b / r"
    // - 2x1 with nested 1x2: "r > a / b"
    return layers.join(' > ');
  }

  /**
   * Convert a cell (including split grids) into vertical header "layers".
   *
   * Key behavior for split-cells:
   * - We treat split ROWS as header depth (top-to-bottom).
   * - Each split row becomes one layer by joining that row's visible texts across split COLS.
   *
   * This prevents the header logic from "falling through" into the next top-level row and accidentally
   * picking up body values (e.g. "55") when the header depth is actually encoded inside the split.
   */
  private getHeaderCellLayers(cell: TableCell | null | undefined, depth: number): string[] {
    if (!cell || depth > 6) return [];

    const own = this.htmlToText(cell.contentHtml ?? '');
    if (own) return [own];

    const split = (cell as any)?.split as { rows?: number; cols?: number; cells?: any[] } | undefined;
    if (!split || !Array.isArray(split.cells)) return [];

    const rows = Math.max(1, Math.trunc(split.rows ?? 1));
    const cols = Math.max(1, Math.trunc(split.cols ?? 1));

    const compactLabel = (c: any): string => {
      // Prefer a single layer label for nested splits inside a split-row cell.
      // For nested vertical splits we keep it compact (leaf-joined) so we don't explode depth.
      const nestedLayers = this.getHeaderCellLayers(c as TableCell, depth + 1);
      if (nestedLayers.length === 0) return '';
      if (nestedLayers.length === 1) return nestedLayers[0];
      // Compact nested hierarchy into a single label so the outer split-row remains one layer.
      return nestedLayers.join(' / ');
    };

    const layers: string[] = [];
    for (let r = 0; r < rows; r++) {
      const rowParts: string[] = [];
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const sub = split.cells[idx];
        const txt = compactLabel(sub);
        if (txt) rowParts.push(txt);
      }
      // De-dupe within the row to avoid "a / a" noise.
      const uniq = Array.from(new Set(rowParts));
      if (uniq.length > 0) layers.push(uniq.join(' / '));
    }

    // Cap to keep keys stable and avoid excessive depth from pathological content.
    return layers.slice(0, 4);
  }

  /**
   * Build a map of normalized column key → column index from the header rows.
   *
   * Supports multi-row grouped headers by concatenating header labels like:
   * - "Performance > Q1"
   *
   * Also always includes a stable index-based key `col:{i}` as a fallback.
   */
  getColumnKeyToIndexMap(rows: TableRow[], headerRowCount: number): Map<string, number> {
    const map = new Map<string, number>();
    if (!Array.isArray(rows) || rows.length === 0) return map;

    const persisted = Math.max(0, Math.min(4, rows.length, Math.trunc(headerRowCount || 0)));
    const metaDepth = this.getHeaderDepthFromMeta(rows);
    const rawHeaderCount = Math.min(4, rows.length, Math.max(persisted, metaDepth));
    const safeHeaderCount = this.clampHeaderRowCountForNaming(rows, rawHeaderCount, persisted);
    const colCount = Math.max(
      1,
      ...rows
        .slice(0, Math.max(1, safeHeaderCount))
        .map((r) => (Array.isArray(r?.cells) ? r.cells.length : 0))
    );

    const resolveCovered = (cell: any): TableCell | null => {
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
    };

    for (let colIndex = 0; colIndex < colCount; colIndex++) {
      const parts: string[] = [];
      for (let r = 0; r < safeHeaderCount; r++) {
        const row = rows[r];
        const cells = Array.isArray(row?.cells) ? row.cells : [];
        const cell = cells[colIndex] as any;
        const resolved = resolveCovered(cell);
        if (!resolved) continue;

        const layers = this.getHeaderCellLayers(resolved, 0);
        if (layers.length === 0) continue;

        for (const label of layers) {
          if (!label) continue;
          const last = parts[parts.length - 1];
          if (last !== label) parts.push(label);
        }

        // If this header cell is a multi-row split, its header depth is encoded internally.
        // Do NOT keep consuming lower top-level rows for this column (prevents "… > 55" keys).
        if ((resolved as any)?.split && layers.length > 1) break;
      }

      const name = parts.join(' > ');
      const key = this.normalizeColumnKey(name) || `col:${colIndex}`;

      if (!map.has(key)) {
        map.set(key, colIndex);
      }
      // Always allow stable index-based addressing.
      map.set(`col:${colIndex}`, colIndex);
    }
    return map;
  }

  /**
   * Determine header depth from explicit header metadata (merges/coveredBy/splits) in the top rows.
   * This is safe because data rows typically do not contain merge metadata.
   */
  private getHeaderDepthFromMeta(rows: TableRow[]): number {
    const maxRows = Math.min(4, rows.length);
    const rowHasMeta = (row: TableRow | undefined): boolean => {
      const maybeCells = row?.cells;
      const cells = Array.isArray(maybeCells) ? maybeCells : [];
      // IMPORTANT: `split` is NOT a signal of multiple top-level header rows; it encodes depth within a single cell.
      // Counting split here can cause body rows with splits to be mistaken as extra header rows.
      // Also: do NOT treat `coveredBy` as header meta. Header merges can span into body rows.
      return cells.some((c: any) => !!c?.merge && !c?.coveredBy);
    };

    let depth = 0;
    for (let r = 0; r < maxRows; r++) {
      if (!rowHasMeta(rows[r])) break;
      depth = r + 1;
    }
    return depth;
  }

  /**
   * Clamp header row count used for naming/rules so body numeric rows don't get pulled into header labels.
   *
   * This protects against bad inferred/persisted headerRowCount values when a header merge spans into body rows,
   * which creates `coveredBy` in body rows and can otherwise inflate header depth.
   */
  private clampHeaderRowCountForNaming(rows: TableRow[], requested: number, baseHeaderCount: number): number {
    const max = Math.max(0, Math.min(4, rows.length, Math.trunc(requested || 0)));
    if (max <= 1) return max;
    const base = Math.max(0, Math.min(max, Math.trunc(baseHeaderCount || 0)));

    // Stop once we hit a row that looks like body data (mostly numeric).
    // IMPORTANT: body rows can still contain merge anchors (e.g. a merged "20" cell),
    // so we must not let merge metadata force the row to be treated as a header row.
    for (let r = 1; r < max; r++) {
      const row = rows[r];
      const cells = Array.isArray(row?.cells) ? row.cells : [];

      let nonEmpty = 0;
      let numeric = 0;
      for (const c of cells) {
        const txt = this.htmlToText((c as any)?.contentHtml ?? '');
        if (!txt) continue;
        nonEmpty++;
        if (/^[0-9.\-+, ]+$/.test(txt)) numeric++;
      }

      const ratio = nonEmpty > 0 ? numeric / nonEmpty : 0;

      // IMPORTANT: body merges can reduce non-empty count to 1 (e.g. "10" with other covered cells empty).
      // We only apply this aggressive stop beyond the persisted header row count.
      if (r >= base && nonEmpty >= 1 && ratio >= 0.9) {
        return r;
      }

      // If we have at least 2 non-empty values and most are numeric, treat as body and stop.
      if (nonEmpty >= 2 && ratio >= 0.7) {
        return r;
      }
    }

    return max;
  }

  /**
   * Resolve a rule set's target column index using its columnKey/columnName, falling back to index.
   */
  resolveRuleSetColIndex(rs: TableColumnRuleSet, keyMap: Map<string, number>): number | null {
    const parsed = this.parseRuleTargetFromKey(rs.columnKey || '');
    if (parsed.topColIndex !== null) return parsed.topColIndex;

    const key = rs.columnKey || this.normalizeColumnKey(rs.columnName || '');
    if (key) {
      const idx = keyMap.get(key);
      if (typeof idx === 'number') return idx;
    }
    const fallback =
      typeof (rs as any).fallbackColIndex === 'number'
        ? Math.trunc((rs as any).fallbackColIndex)
        : typeof rs.colIndex === 'number'
          ? Math.trunc(rs.colIndex)
          : null;
    return fallback !== null && Number.isFinite(fallback) && fallback >= 0 ? fallback : null;
  }

  /**
   * Find the rule set that applies to a given column index.
   */
  getColumnRuleSetForColIndex(
    colIndex: number,
    columnRules: TableColumnRuleSet[] | undefined,
    rows: TableRow[],
    headerRowCount: number
  ): TableColumnRuleSet | null {
    if (!Array.isArray(columnRules) || columnRules.length === 0) return null;
    const map = this.getColumnKeyToIndexMap(rows, headerRowCount);
    return (
      columnRules.find((r) => {
        if (!r || r.enabled === false) return false;
        const resolved = this.resolveRuleSetColIndex(r, map);
        return resolved === colIndex;
      }) ?? null
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // Rule evaluation
  // ─────────────────────────────────────────────────────────────────

  evaluateRuleMatch(rule: TableConditionRule, cell: TableCell): boolean {
    if (!rule || rule.enabled === false) return false;
    const when = rule.when;
    if (!when || !when.op) return false;

    const v = this.getCellComparableValue(cell);
    const valueRaw = (when.value ?? '').toString();
    const valueLower = valueRaw.toLowerCase();
    const ignoreCase = when.ignoreCase !== false;

    switch (when.op) {
      case 'isEmpty':
        return v.text.length === 0;
      case 'isNotEmpty':
        return v.text.length > 0;
      case 'equals':
        return ignoreCase ? v.textLower === valueLower : v.text === valueRaw;
      case 'notEquals':
        return ignoreCase ? v.textLower !== valueLower : v.text !== valueRaw;
      case 'equalsIgnoreCase':
        return v.textLower === valueLower;
      case 'contains':
        return ignoreCase ? v.textLower.includes(valueLower) : v.text.includes(valueRaw);
      case 'notContains':
        return ignoreCase ? !v.textLower.includes(valueLower) : !v.text.includes(valueRaw);
      case 'startsWith':
        return ignoreCase ? v.textLower.startsWith(valueLower) : v.text.startsWith(valueRaw);
      case 'endsWith':
        return ignoreCase ? v.textLower.endsWith(valueLower) : v.text.endsWith(valueRaw);
      case 'inList': {
        const list = Array.isArray(when.values)
          ? when.values
          : valueRaw.split(',').map((x) => x.trim()).filter(Boolean);
        const set = ignoreCase ? list.map((x) => x.toLowerCase()) : list;
        const cur = ignoreCase ? v.textLower : v.text;
        return set.includes(cur);
      }
      case 'notInList': {
        const list = Array.isArray(when.values)
          ? when.values
          : valueRaw.split(',').map((x) => x.trim()).filter(Boolean);
        const set = ignoreCase ? list.map((x) => x.toLowerCase()) : list;
        const cur = ignoreCase ? v.textLower : v.text;
        return !set.includes(cur);
      }
      case 'greaterThan': {
        const n = v.num;
        const cmp = this.parseNumber(valueRaw);
        return n !== null && cmp !== null && n > cmp;
      }
      case 'greaterThanOrEqual': {
        const n = v.num;
        const cmp = this.parseNumber(valueRaw);
        return n !== null && cmp !== null && n >= cmp;
      }
      case 'lessThan': {
        const n = v.num;
        const cmp = this.parseNumber(valueRaw);
        return n !== null && cmp !== null && n < cmp;
      }
      case 'lessThanOrEqual': {
        const n = v.num;
        const cmp = this.parseNumber(valueRaw);
        return n !== null && cmp !== null && n <= cmp;
      }
      case 'between':
      case 'notBetween': {
        const n = v.num;
        const min = this.parseNumber((when.min ?? '').toString());
        const max = this.parseNumber((when.max ?? '').toString());
        if (n === null || min === null || max === null) return false;
        const ok = n >= Math.min(min, max) && n <= Math.max(min, max);
        return when.op === 'between' ? ok : !ok;
      }
      case 'before':
      case 'after':
      case 'on': {
        const d = v.dateMs;
        const cmp = this.parseDateMs(valueRaw);
        if (d === null || cmp === null) return false;
        if (when.op === 'before') return d < cmp;
        if (when.op === 'after') return d > cmp;
        const a = new Date(d);
        const b = new Date(cmp);
        return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
      }
      case 'betweenDates': {
        const d = v.dateMs;
        const min = this.parseDateMs((when.min ?? '').toString());
        const max = this.parseDateMs((when.max ?? '').toString());
        if (d === null || min === null || max === null) return false;
        return d >= Math.min(min, max) && d <= Math.max(min, max);
      }
      default:
        return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Action merging and application
  // ─────────────────────────────────────────────────────────────────

  private mergeThen(into: TableConditionThen, then: TableConditionThen): TableConditionThen {
    return {
      ...into,
      ...then,
      cellClass: then.cellClass ? then.cellClass : into.cellClass,
      tooltip: then.tooltip ? then.tooltip : into.tooltip,
    };
  }

  /**
   * Get the merged "then" actions for a cell based on all matching rules.
   */
  getConditionalThenForCell(
    rowIndex: number,
    colIndex: number,
    path: string,
    cell: TableCell,
    columnRules: TableColumnRuleSet[] | undefined,
    rows: TableRow[],
    headerRowCount: number
  ): TableConditionThen | null {
    // Don't apply to header rows
    if (headerRowCount > 0 && rowIndex < headerRowCount) return null;

    if (!Array.isArray(columnRules) || columnRules.length === 0) return null;

    const renderedLeafColPath = this.getLeafColPathForRenderedCell(rows, rowIndex, colIndex, path);

    // Only build the expensive header key map if we have any name-based keys.
    const needsKeyMap = columnRules.some((rs) => {
      const k = (rs?.columnKey ?? '').toString();
      if (!k) return true;
      const parsed = this.parseRuleTargetFromKey(k);
      return parsed.topColIndex === null;
    });
    const keyMap = needsKeyMap ? this.getColumnKeyToIndexMap(rows, headerRowCount) : new Map<string, number>();

    type MatchedRuleSet = { rs: TableColumnRuleSet; leafColPath: string | null };
    const matched: MatchedRuleSet[] = [];

    for (const rs of columnRules) {
      if (!rs || rs.enabled === false || !Array.isArray(rs.rules) || rs.rules.length === 0) continue;
      const target = this.resolveRuleSetTarget(rs, keyMap);
      if (target.topColIndex === null) continue;
      if (target.topColIndex !== colIndex) continue;

      const targetLeaf = target.leafColPath;
      if (targetLeaf) {
        // Leaf-specific rule: match the rendered leaf column when available,
        // otherwise apply to the whole unsplit body cell (apply_whole behavior).
        if (renderedLeafColPath && renderedLeafColPath !== targetLeaf) continue;
      }

      matched.push({ rs, leafColPath: targetLeaf });
    }

    if (matched.length === 0) return null;

    // Deterministic precedence: apply whole-column rules first, then leaf-specific rules (leaf overrides on conflict).
    matched.sort((a, b) => (a.leafColPath ? 1 : 0) - (b.leafColPath ? 1 : 0));

    let out: TableConditionThen = {};
    for (const { rs } of matched) {
      const sorted = [...rs.rules].sort((a, b) => (a?.priority ?? 0) - (b?.priority ?? 0));
      for (const rule of sorted) {
        if (!rule || rule.enabled === false) continue;
        const matchedRule = this.evaluateRuleMatch(rule, cell);
        if (!matchedRule) continue;
        out = this.mergeThen(out, rule.then ?? {});
        if (rule.stopIfTrue) break;
      }
    }

    return Object.keys(out).length > 0 ? out : null;
  }

  // ─────────────────────────────────────────────────────────────────
  // Public convenience methods for templates
  // ─────────────────────────────────────────────────────────────────

  getConditionalCellSurfaceClass(
    rowIndex: number,
    colIndex: number,
    path: string,
    cell: TableCell,
    columnRules: TableColumnRuleSet[] | undefined,
    rows: TableRow[],
    headerRowCount: number
  ): string | null {
    const then = this.getConditionalThenForCell(rowIndex, colIndex, path, cell, columnRules, rows, headerRowCount);
    return then?.cellClass || null;
  }

  getConditionalCellSurfaceStyle(
    rowIndex: number,
    colIndex: number,
    path: string,
    cell: TableCell,
    columnRules: TableColumnRuleSet[] | undefined,
    rows: TableRow[],
    headerRowCount: number
  ): Partial<TableCellStyle> {
    const then = this.getConditionalThenForCell(rowIndex, colIndex, path, cell, columnRules, rows, headerRowCount);
    if (!then) return {};
    return {
      backgroundColor: then.backgroundColor,
      color: then.textColor,
      fontWeight: then.fontWeight,
      fontStyle: then.fontStyle,
      textDecoration: then.textDecoration,
    };
  }

  getConditionalTooltip(
    rowIndex: number,
    colIndex: number,
    path: string,
    cell: TableCell,
    columnRules: TableColumnRuleSet[] | undefined,
    rows: TableRow[],
    headerRowCount: number
  ): string | null {
    const then = this.getConditionalThenForCell(rowIndex, colIndex, path, cell, columnRules, rows, headerRowCount);
    return then?.tooltip || null;
  }

  /**
   * Clear the HTML text cache (call on widget destroy to free memory).
   */
  clearCache(): void {
    this.htmlTextCache.clear();
  }

  // ─────────────────────────────────────────────────────────────────
  // Split-leaf column helpers
  // ─────────────────────────────────────────────────────────────────

  private parseRuleTargetFromKey(key: string): { topColIndex: number | null; leafColPath: string | null } {
    const k = (key ?? '').toString().trim();
    if (!k) return { topColIndex: null, leafColPath: null };

    // leafcol:{top}:{leaf}
    const mLeaf = k.match(/^leafcol:(\d+):(.+)$/i);
    if (mLeaf) {
      const top = Number(mLeaf[1]);
      const leaf = (mLeaf[2] ?? '').toString().trim();
      return {
        topColIndex: Number.isFinite(top) ? Math.trunc(top) : null,
        leafColPath: leaf.length > 0 ? leaf : null,
      };
    }

    // col:{top}
    const mCol = k.match(/^col:(\d+)$/i);
    if (mCol) {
      const top = Number(mCol[1]);
      return { topColIndex: Number.isFinite(top) ? Math.trunc(top) : null, leafColPath: null };
    }

    return { topColIndex: null, leafColPath: null };
  }

  private resolveRuleSetTarget(
    rs: TableColumnRuleSet,
    keyMap: Map<string, number>
  ): { topColIndex: number | null; leafColPath: string | null } {
    const leafFromField =
      typeof (rs as any).leafColPath === 'string' && (rs as any).leafColPath.trim().length > 0
        ? (rs as any).leafColPath.trim()
        : null;

    const parsed = this.parseRuleTargetFromKey(rs.columnKey || '');

    const topColIndex =
      typeof (rs as any).fallbackColIndex === 'number'
        ? Math.trunc((rs as any).fallbackColIndex)
        : typeof (rs as any).colIndex === 'number'
          ? Math.trunc((rs as any).colIndex)
          : parsed.topColIndex !== null
            ? parsed.topColIndex
            : (() => {
                const key = rs.columnKey || this.normalizeColumnKey(rs.columnName || '');
                if (!key) return null;
                const idx = keyMap.get(key);
                return typeof idx === 'number' ? idx : null;
              })();

    return {
      topColIndex: topColIndex !== null && Number.isFinite(topColIndex) && topColIndex >= 0 ? topColIndex : null,
      leafColPath: leafFromField ?? parsed.leafColPath,
    };
  }

  /**
   * Convert the widget leaf `path` (row-major indices through split grids) into a *leaf column path*,
   * which is the sequence of column indices encountered only across splits where `cols > 1`.
   *
   * This makes split sub-cells behave like real columns and allows headers like:\n+   * - 2x2: f/s over b/r to map to leaf columns: 0 => f>b, 1 => s>r\n+   * - vertical split then nested 1x2: d over a/b to map to leaf columns: 0 => d>a, 1 => d>b
   */
  private getLeafColPathForRenderedCell(
    rows: TableRow[],
    rowIndex: number,
    topColIndex: number,
    leafPath: string
  ): string | null {
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
      if (!split || !Array.isArray(split.cells)) return outCols.length > 0 ? outCols.join('-') : null;

      const cols = Math.max(1, Math.trunc(split.cols ?? 1));
      const row = Math.floor(idx / cols);
      const col = idx % cols;

      if (cols > 1) outCols.push(col);

      const next = split.cells[idx];
      if (!next) break;
      cur = next;
    }

    return outCols.length > 0 ? outCols.join('-') : null;
  }
}

