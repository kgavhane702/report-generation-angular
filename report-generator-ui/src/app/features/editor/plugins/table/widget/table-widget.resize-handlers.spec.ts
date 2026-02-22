import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { TableWidgetComponent } from './table-widget.component';
import { TableToolbarService } from '../../../../../core/services/table-toolbar.service';
import { UIStateService } from '../../../../../core/services/ui-state.service';
import { PendingChangesRegistry } from '../../../../../core/services/pending-changes-registry.service';
import { DraftStateService } from '../../../../../core/services/draft-state.service';
import { LoggerService } from '../../../../../core/services/logger.service';
import { TableConditionalFormattingService } from '../services/table-conditional-formatting.service';
import { RemoteWidgetAutoLoadService } from '../../../../../core/services/remote-widget-auto-load.service';

describe('TableWidgetComponent - resize handlers (fixture)', () => {
  let fixture: ComponentFixture<TableWidgetComponent>;
  let component: TableWidgetComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TableWidgetComponent],
      providers: [
        {
          provide: TableToolbarService,
          useValue: {
            activeTableWidgetId: null,
            clearActiveCell: () => {},
            setSelectedCellsGetter: () => {},
          },
        },
        {
          provide: UIStateService,
          useValue: {
            zoomLevel: () => 100,
            activeWidgetId: () => null,
            resizingWidgetId: () => null,
          },
        },
        { provide: PendingChangesRegistry, useValue: { register: () => {}, unregister: () => {} } },
        {
          provide: DraftStateService,
          useValue: {
            updateDraftSize: () => {},
            commitDraft: () => {},
            hasDraft: () => false,
          },
        },
        { provide: LoggerService, useValue: { debug: () => {}, warn: () => {}, error: () => {} } },
        {
          provide: TableConditionalFormattingService,
          useValue: {
            getConditionalCellSurfaceClass: () => null,
            getConditionalCellSurfaceStyle: () => ({}),
            getConditionalTooltip: () => null,
          },
        },
        { provide: RemoteWidgetAutoLoadService, useValue: { shouldAutoLoad: () => false } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(TableWidgetComponent, {
        set: {
          template: '<div></div>',
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TableWidgetComponent);
    component = fixture.componentInstance;

    // Keep lifecycle requirements minimal for handler-level tests.
    (component as any).widget = {
      id: 'w1',
      size: { width: 300, height: 200 },
      props: { rows: [{ id: 'r0', cells: [{ id: 'c0', contentHtml: '' }] }], showBorders: true },
    };
  });

  it('clamps top-level column resize by minColPx in pointer-move', () => {
    const c = component as any;

    c.minColPx = 40;
    c.isResizingGrid = true;
    c.activeGridResize = {
      kind: 'col',
      boundaryIndex: 1,
      startClientX: 0,
      startClientY: 0,
      startFractions: [0.5, 0.5],
      tableWidthPx: 100,
      tableHeightPx: 100,
      zoomScale: 1,
    };

    c.handleGridResizePointerMove({
      preventDefault: () => {},
      stopPropagation: () => {},
      clientX: -40,
      clientY: 0,
    } as any);

    expect(c.ghostTopColPercent()).toBeCloseTo(40, 6);
  });

  it('clamps top-level row resize by minRowPx/minTopRowHeightPx in pointer-move', () => {
    const c = component as any;

    c.minRowPx = 20;
    c.isResizingGrid = true;
    c.activeGridResize = {
      kind: 'row',
      boundaryIndex: 1,
      startClientX: 0,
      startClientY: 0,
      startFractions: [0.5, 0.5],
      tableWidthPx: 100,
      tableHeightPx: 100,
      zoomScale: 1,
      minTopRowHeightPx: 40,
    };

    c.handleGridResizePointerMove({
      preventDefault: () => {},
      stopPropagation: () => {},
      clientX: 0,
      clientY: -30,
    } as any);

    expect(c.ghostTopRowPercent()).toBeCloseTo(40, 6);
  });

  it('applies zoomScale when computing top-level column pointer delta', () => {
    const c = component as any;

    c.minColPx = 20;
    c.isResizingGrid = true;
    c.activeGridResize = {
      kind: 'col',
      boundaryIndex: 1,
      startClientX: 0,
      startClientY: 0,
      startFractions: [0.5, 0.5],
      tableWidthPx: 100,
      tableHeightPx: 100,
      zoomScale: 2,
    };

    c.handleGridResizePointerMove({
      preventDefault: () => {},
      stopPropagation: () => {},
      clientX: 20,
      clientY: 0,
    } as any);

    // 20 screen px / zoom 2 => 10 layout px => +10%.
    expect(c.ghostTopColPercent()).toBeCloseTo(60, 6);
  });

  it('updates top-level resize ghost on pointer-move without committing column fractions', () => {
    const c = component as any;

    c.columnFractions.set([0.5, 0.5]);
    c.minColPx = 20;
    c.isResizingGrid = true;
    c.activeGridResize = {
      kind: 'col',
      boundaryIndex: 1,
      startClientX: 0,
      startClientY: 0,
      startFractions: [0.5, 0.5],
      tableWidthPx: 100,
      tableHeightPx: 100,
      zoomScale: 1,
    };

    c.handleGridResizePointerMove({
      preventDefault: () => {},
      stopPropagation: () => {},
      clientX: 10,
      clientY: 0,
    } as any);

    expect(c.ghostTopColPercent()).toBeCloseTo(60, 6);
    expect(c.columnFractions()).toEqual([0.5, 0.5]);
  });

  it('clamps split-column resize by minSplitColPx in pointer-move', () => {
    const c = component as any;

    c.minSplitColPx = 24;

    const owner = { split: { cols: 2, rows: 1, columnFractions: [0.5, 0.5], rowFractions: [1], cells: [] } };
    c.getCellModelByLeafId = (id: string) => (id === 'A' ? owner : null);
    c.getSplitColFractions = (_ownerLeafId: string, cell: any) => cell.split.columnFractions;

    c.isResizingSplitGrid = true;
    c.activeSplitResize = {
      kind: 'col',
      ownerLeafId: 'A',
      sharedOwnerLeafIds: ['A'],
      boundaryIndex: 1,
      ownerBoundaryIndexMap: new Map<string, number>([['A', 1]]),
      ownerContainerWidthPx: new Map<string, number>([['A', 100]]),
      pointerId: 1,
      startClientX: 0,
      startClientY: 0,
      startFractions: [0.5, 0.5],
      containerWidthPx: 100,
      containerHeightPx: 50,
      zoomScale: 1,
    };

    c.handleSplitResizePointerMove({
      preventDefault: () => {},
      stopPropagation: () => {},
      pointerId: 1,
      pointerType: 'mouse',
      buttons: 1,
      clientX: -60,
      clientY: 0,
    } as any);

    const map = c.pendingSplitColFractions();
    expect(map.get('A')?.[0]).toBeCloseTo(0.24, 6);
    expect(map.get('A')?.[1]).toBeCloseTo(0.76, 6);
  });

  it('propagates shared split-column boundary updates across aligned owners', () => {
    const c = component as any;

    c.minSplitColPx = 10;

    const ownerA = { split: { cols: 2, rows: 1, columnFractions: [0.5, 0.5], rowFractions: [1], cells: [] } };
    const ownerB = { split: { cols: 2, rows: 1, columnFractions: [0.5, 0.5], rowFractions: [1], cells: [] } };

    c.getCellModelByLeafId = (id: string) => {
      if (id === 'A') return ownerA;
      if (id === 'B') return ownerB;
      return null;
    };
    c.getSplitColFractions = (_ownerLeafId: string, cell: any) => cell.split.columnFractions;

    c.isResizingSplitGrid = true;
    c.activeSplitResize = {
      kind: 'col',
      ownerLeafId: 'A',
      sharedOwnerLeafIds: ['A', 'B'],
      boundaryIndex: 1,
      ownerBoundaryIndexMap: new Map<string, number>([
        ['A', 1],
        ['B', 1],
      ]),
      ownerContainerWidthPx: new Map<string, number>([
        ['A', 100],
        ['B', 100],
      ]),
      pointerId: 1,
      startClientX: 0,
      startClientY: 0,
      startFractions: [0.5, 0.5],
      containerWidthPx: 100,
      containerHeightPx: 100,
      tableWidthPx: 200,
      tableHeightPx: 200,
      startSharedBoundaryAbs: 0.5,
      zoomScale: 1,
    };

    c.handleSplitResizePointerMove({
      preventDefault: () => {},
      stopPropagation: () => {},
      pointerId: 1,
      pointerType: 'mouse',
      buttons: 1,
      clientX: 10,
      clientY: 0,
    } as any);

    const colMap = c.pendingSplitColFractions();
    expect(colMap.get('A')?.[0]).toBeCloseTo(0.6, 6);
    expect(colMap.get('A')?.[1]).toBeCloseTo(0.4, 6);
    expect(colMap.get('B')?.[0]).toBeCloseTo(0.6, 6);
    expect(colMap.get('B')?.[1]).toBeCloseTo(0.4, 6);

    const ghostMap = c.ghostSplitColWithinPercent();
    expect(ghostMap.get('A')).toBeCloseTo(60, 6);
    expect(ghostMap.get('B')).toBeCloseTo(60, 6);
    expect(c.ghostSharedSplitColPercent()).toBeCloseTo(55, 6);
  });

  it('clamps split-row resize by minSplitRowPx in pointer-move', () => {
    const c = component as any;

    c.minSplitRowPx = 24;

    const owner = { split: { rows: 2, cols: 1, rowFractions: [0.5, 0.5], columnFractions: [1], cells: [] } };
    c.getCellModelByLeafId = (id: string) => (id === 'A' ? owner : null);
    c.getSplitRowFractions = (_ownerLeafId: string, cell: any) => cell.split.rowFractions;

    c.isResizingSplitGrid = true;
    c.activeSplitResize = {
      kind: 'row',
      ownerLeafId: 'A',
      sharedOwnerLeafIds: ['A'],
      boundaryIndex: 1,
      ownerBoundaryIndexMap: new Map<string, number>([['A', 1]]),
      ownerContainerHeightPx: new Map<string, number>([['A', 100]]),
      pointerId: 1,
      startClientX: 0,
      startClientY: 0,
      startFractions: [0.5, 0.5],
      containerWidthPx: 50,
      containerHeightPx: 100,
      zoomScale: 1,
    };

    c.handleSplitResizePointerMove({
      preventDefault: () => {},
      stopPropagation: () => {},
      pointerId: 1,
      pointerType: 'mouse',
      buttons: 1,
      clientX: 0,
      clientY: -60,
    } as any);

    const map = c.pendingSplitRowFractions();
    expect(map.get('A')?.[0]).toBeCloseTo(0.24, 6);
    expect(map.get('A')?.[1]).toBeCloseTo(0.76, 6);
  });

  it('propagates shared split-row boundary updates across aligned owners', () => {
    const c = component as any;

    c.minSplitRowPx = 10;

    const ownerA = { split: { rows: 2, cols: 1, rowFractions: [0.5, 0.5], columnFractions: [1], cells: [] } };
    const ownerB = { split: { rows: 2, cols: 1, rowFractions: [0.5, 0.5], columnFractions: [1], cells: [] } };

    c.getCellModelByLeafId = (id: string) => {
      if (id === 'A') return ownerA;
      if (id === 'B') return ownerB;
      return null;
    };
    c.getSplitRowFractions = (_ownerLeafId: string, cell: any) => cell.split.rowFractions;

    c.isResizingSplitGrid = true;
    c.activeSplitResize = {
      kind: 'row',
      ownerLeafId: 'A',
      sharedOwnerLeafIds: ['A', 'B'],
      boundaryIndex: 1,
      ownerBoundaryIndexMap: new Map<string, number>([
        ['A', 1],
        ['B', 1],
      ]),
      ownerContainerHeightPx: new Map<string, number>([
        ['A', 100],
        ['B', 100],
      ]),
      pointerId: 1,
      startClientX: 0,
      startClientY: 0,
      startFractions: [0.5, 0.5],
      containerWidthPx: 100,
      containerHeightPx: 100,
      tableWidthPx: 200,
      tableHeightPx: 200,
      startSharedBoundaryAbs: 0.5,
      zoomScale: 1,
    };

    c.handleSplitResizePointerMove({
      preventDefault: () => {},
      stopPropagation: () => {},
      pointerId: 1,
      pointerType: 'mouse',
      buttons: 1,
      clientX: 0,
      clientY: 10,
    } as any);

    const rowMap = c.pendingSplitRowFractions();
    expect(rowMap.get('A')?.[0]).toBeCloseTo(0.6, 6);
    expect(rowMap.get('A')?.[1]).toBeCloseTo(0.4, 6);
    expect(rowMap.get('B')?.[0]).toBeCloseTo(0.6, 6);
    expect(rowMap.get('B')?.[1]).toBeCloseTo(0.4, 6);

    const ghostMap = c.ghostSplitRowWithinPercent();
    expect(ghostMap.get('A')).toBeCloseTo(60, 6);
    expect(ghostMap.get('B')).toBeCloseTo(60, 6);
    expect(c.ghostSharedSplitRowPercent()).toBeCloseTo(55, 6);
  });

  it('commits pending split row fractions on pointer-up and clears pending state', () => {
    const c = component as any;

    c.localRows.set([
      {
        id: 'r0',
        cells: [
          {
            id: 'owner',
            contentHtml: '',
            split: {
              rows: 2,
              cols: 1,
              rowFractions: [0.5, 0.5],
              columnFractions: [1],
              cells: [{ id: 's0', contentHtml: '' }, { id: 's1', contentHtml: '' }],
            },
          },
        ],
      },
    ]);

    c.parseLeafId = () => ({ row: 0, col: 0, path: [] });
    c.getCellAtPath = (cell: any) => cell;
    c.normalizeFractions = (arr: number[]) => {
      const sum = arr.reduce((a: number, b: number) => a + b, 0);
      return arr.map((v: number) => v / sum);
    };

    c.pendingSplitRowFractions.set(new Map<string, number[]>([['A', [0.7, 0.3]]]));
    c.pendingSplitColFractions.set(new Map<string, number[]>([['A', [1]]]));

    spyOn(c, 'emitPropsChange').and.callThrough();

    c.isResizingSplitGrid = true;
    c.activeSplitResize = {
      kind: 'row',
      ownerLeafId: 'A',
      sharedOwnerLeafIds: ['A'],
      pointerId: 1,
    };

    c.handleSplitResizePointerUp({
      preventDefault: () => {},
      stopPropagation: () => {},
      pointerId: 1,
    } as any);

    const rows = c.localRows();
    expect(rows[0].cells[0].split.rowFractions).toEqual([0.7, 0.3]);
    expect(c.emitPropsChange).toHaveBeenCalled();
    expect(c.pendingSplitRowFractions().has('A')).toBeFalse();
    expect(c.pendingSplitColFractions().has('A')).toBeFalse();
    expect(c.isResizingSplitGrid).toBeFalse();
    expect(c.activeSplitResize).toBeNull();
  });
});
