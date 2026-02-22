import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Subject } from 'rxjs';

import { TableWidgetComponent } from './table-widget.component';
import { TableToolbarService } from '../../../../../core/services/table-toolbar.service';
import { UIStateService } from '../../../../../core/services/ui-state.service';
import { PendingChangesRegistry } from '../../../../../core/services/pending-changes-registry.service';
import { DraftStateService } from '../../../../../core/services/draft-state.service';
import { LoggerService } from '../../../../../core/services/logger.service';
import { TableConditionalFormattingService } from '../services/table-conditional-formatting.service';
import { RemoteWidgetAutoLoadService } from '../../../../../core/services/remote-widget-auto-load.service';

describe('TableWidgetComponent - editing border regression', () => {
  let fixture: ComponentFixture<TableWidgetComponent>;
  let component: TableWidgetComponent;

  beforeEach(async () => {
    const noop$ = new Subject<any>();

    await TestBed.configureTestingModule({
      declarations: [TableWidgetComponent],
      providers: [
        {
          provide: TableToolbarService,
          useValue: {
            activeTableWidgetId: null,
            splitCellRequested$: noop$,
            mergeCellsRequested$: noop$,
            insertRequested$: noop$,
            deleteRequested$: noop$,
            fitRowRequested$: noop$,
            tableOptionsRequested$: noop$,
            preserveHeaderOnUrlLoadRequested$: noop$,
            columnRulesRequested$: noop$,
            importFromExcelRequested$: noop$,
            textAlignRequested$: noop$,
            verticalAlignRequested$: noop$,
            cellBackgroundColorRequested$: noop$,
            cellBorderRequested$: noop$,
            fontFamilyRequested$: noop$,
            fontSizeRequested$: noop$,
            fontWeightRequested$: noop$,
            fontStyleRequested$: noop$,
            textDecorationRequested$: noop$,
            textColorRequested$: noop$,
            textHighlightRequested$: noop$,
            lineHeightRequested$: noop$,
            clearActiveCell: () => {},
            setSelectedCellsGetter: () => {},
            syncTableOptionsFromProps: () => {},
            setCanMergeSelection: () => {},
            setSelectedCells: () => {},
            updateFormattingState: () => {},
            setActiveCell: () => {},
          },
        },
        {
          provide: UIStateService,
          useValue: {
            zoomLevel: () => 100,
            activeWidgetId: () => null,
            resizingWidgetId: () => null,
            onWidgetSelectRequest$: noop$,
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
          template: `
            <div class="table-widget" [class.table-widget--editing]="editing">
              <div class="table-widget__cell" data-test-cell="1"></div>
            </div>
          `,
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TableWidgetComponent);
    component = fixture.componentInstance;

    spyOn(component as any, 'ngOnInit').and.callFake(() => {});
    spyOn(component as any, 'ngAfterViewInit').and.callFake(() => {});

    (component as any).widget = {
      id: 'w1',
      size: { width: 300, height: 200 },
      props: { rows: [{ id: 'r0', cells: [{ id: 'c0', contentHtml: '' }] }], showBorders: true },
    };

    fixture.detectChanges();
  });

  it('keeps main table cell border color unchanged when entering editing mode', () => {
    const cell = fixture.nativeElement.querySelector('[data-test-cell="1"]') as HTMLElement;
    expect(cell).toBeTruthy();

    const before = window.getComputedStyle(cell).borderTopColor;

    (component as any).isActivelyEditing.set(true);
    fixture.detectChanges();

    const after = window.getComputedStyle(cell).borderTopColor;
    expect(after).toBe(before);
  });
});
