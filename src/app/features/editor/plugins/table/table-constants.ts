/**
 * Shared constants for the Table widget.
 *
 * Keep these values in sync with:
 * - `TableWidgetComponent` sizing clamps (min row/col sizes)
 * - `WidgetFactoryService` default new-table sizing
 */
export const TABLE_DEFAULT_WIDTH_PX = 700;

/** Minimum top-level row height (px) used for manual row resize clamps. */
export const TABLE_MIN_ROW_PX = 24;

/** Minimum top-level column width (px) used for manual column resize clamps. */
export const TABLE_MIN_COL_PX = 40;

/** Split sub-cells can be smaller than top-level cells. */
export const TABLE_MIN_SPLIT_ROW_PX = 18;
export const TABLE_MIN_SPLIT_COL_PX = 24;

/**
 * Default initial row height (px) for a freshly inserted table widget.
 * This avoids the "huge empty table" look while still feeling PPT-like.
 */
export const TABLE_INITIAL_ROW_PX = 40;


