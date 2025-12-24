import { TableWidgetComponent } from './table-widget.component';

describe('TableWidgetComponent - shared split boundary resize', () => {
  it('propagates split column resize to other owners on same line (ratio-based)', () => {
    // We unit-test the propagation math via private handler, without DOM.
    // Setup: two split owners with 2 cols each; resizing boundary 1 should update both.

    const c = Object.create(TableWidgetComponent.prototype) as TableWidgetComponent as any;

    // Minimal plumbing / no-op deps
    c.minSplitColPx = 24;
    c.minSplitRowPx = 18;
    const makeSignal = <T,>(initial: T) => {
      const fn: any = () => fn.value as T;
      fn.value = initial;
      fn.set = (v: T) => {
        fn.value = v;
      };
      return fn;
    };

    c.pendingSplitColFractions = makeSignal<Map<string, number[]>>(new Map());
    c.pendingSplitRowFractions = makeSignal<Map<string, number[]>>(new Map());
    c.ghostSplitColWithinPercent = makeSignal<Map<string, number>>(new Map());
    c.ghostSplitRowWithinPercent = makeSignal<Map<string, number>>(new Map());
    c.ghostSharedSplitColPercent = makeSignal<number | null>(null);
    c.ghostSharedSplitRowPercent = makeSignal<number | null>(null);

    c.normalizeFractions = (arr: number[], count: number) => {
      if (arr.length !== count) return Array.from({ length: count }, () => 1 / count);
      const sum = arr.reduce((a, b) => a + b, 0);
      return arr.map((x) => x / sum);
    };
    c.clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

    const ownerA = { split: { cols: 2, rows: 1, columnFractions: [0.6, 0.4], rowFractions: [1], cells: [] } };
    const ownerB = { split: { cols: 2, rows: 1, columnFractions: [0.2, 0.8], rowFractions: [1], cells: [] } };

    c.getCellModelByLeafId = (leafId: string) => (leafId === 'A' ? ownerA : leafId === 'B' ? ownerB : null);

    c.getSplitColFractions = (_ownerLeafId: string, cell: any) => cell.split.columnFractions;
    c.getSplitRowFractions = (_ownerLeafId: string, cell: any) => cell.split.rowFractions;

    c.cdr = { markForCheck: () => void 0 };

    c.isResizingSplitGrid = true;
    c.activeSplitResize = {
      kind: 'col',
      ownerLeafId: 'A',
      sharedOwnerLeafIds: ['A', 'B'],
      boundaryIndex: 1,
      pointerId: 1,
      startClientX: 0,
      startClientY: 0,
      startFractions: [0.6, 0.4],
      containerWidthPx: 100,
      containerHeightPx: 50,
      zoomScale: 1,
    };

    // Move pointer +10px => deltaF=0.1, clampedLeft=0.7, ratio=0.7
    c.handleSplitResizePointerMove({
      preventDefault: () => void 0,
      stopPropagation: () => void 0,
      pointerId: 1,
      pointerType: 'mouse',
      buttons: 1,
      clientX: 10,
      clientY: 0,
    } as any);

    const map = c.pendingSplitColFractions();
    expect(map.get('A')).toEqual([0.7, 0.3]);

    // Owner B total is 1.0, ratio=0.7 => [0.7,0.3]
    expect(map.get('B')).toEqual([0.7, 0.3]);
  });
});
