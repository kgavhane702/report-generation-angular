import { TableWidgetComponent } from './table-widget.component';

describe('TableWidgetComponent - shared split boundary resize', () => {
  it('propagates split column resize to other owners on same line (delta-based, per-owner boundary index)', () => {
    // We unit-test the propagation math via private handler, without DOM.
    // Setup: two split owners with different split shapes; resizing should update the correct boundary per owner.

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
    const ownerB = { split: { cols: 3, rows: 1, columnFractions: [0.2, 0.3, 0.5], rowFractions: [1], cells: [] } };

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
      ownerBoundaryIndexMap: new Map<string, number>([
        ['A', 1],
        // In B, the aligned boundary corresponds to its second internal boundary (between cols 2 and 3).
        ['B', 2],
      ]),
      ownerContainerWidthPx: new Map<string, number>([
        ['A', 100],
        ['B', 200],
      ]),
      pointerId: 1,
      startClientX: 0,
      startClientY: 0,
      startFractions: [0.6, 0.4],
      containerWidthPx: 100,
      containerHeightPx: 50,
      zoomScale: 1,
    };

    // Move pointer +10px:
    // - owner A width=100 => +0.10 on the left side of boundary 1
    // - owner B width=200 => +0.05 on the left side of boundary 2
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
    expect(map.get('A')?.[0]).toBeCloseTo(0.7, 6);
    expect(map.get('A')?.[1]).toBeCloseTo(0.3, 6);

    // Owner B boundary 2 is between [0.3,0.5] (total=0.8). +10px at width=200 => +0.05 => [0.35,0.45].
    expect(map.get('B')?.[0]).toBeCloseTo(0.2, 6);
    expect(map.get('B')?.[1]).toBeCloseTo(0.35, 6);
    expect(map.get('B')?.[2]).toBeCloseTo(0.45, 6);
  });
});
