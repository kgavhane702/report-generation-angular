import { TestBed } from '@angular/core/testing';

import { Command, UndoRedoService } from './undo-redo.service';
import type { GraphCommandTransaction } from '../graph/models/graph-transaction.model';

describe('UndoRedoService', () => {
  let service: UndoRedoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UndoRedoService);
    service.clearHistory();
  });

  it('should execute, undo, and redo document commands', () => {
    let value = 0;
    const cmd: Command = {
      execute: () => {
        value += 1;
      },
      undo: () => {
        value -= 1;
      },
    };

    expect(service.documentCanUndo()).toBe(false);
    expect(service.documentCanRedo()).toBe(false);

    service.executeDocumentCommand(cmd);
    expect(value).toBe(1);
    expect(service.documentCanUndo()).toBe(true);
    expect(service.documentCanRedo()).toBe(false);

    service.undoDocument();
    expect(value).toBe(0);
    expect(service.documentCanUndo()).toBe(false);
    expect(service.documentCanRedo()).toBe(true);

    service.redoDocument();
    expect(value).toBe(1);
    expect(service.documentCanUndo()).toBe(true);
    expect(service.documentCanRedo()).toBe(false);
  });

  it('preserves merged graph transaction metadata on coalesced commands', () => {
    let value = 0;

    const tx1: GraphCommandTransaction = {
      kind: 'widget-update',
      touchedWidgetIds: ['connector-1'],
      beforeEdges: [],
      afterEdges: [],
    };

    const tx2: GraphCommandTransaction = {
      kind: 'widget-update',
      touchedWidgetIds: ['connector-2'],
      beforeEdges: [],
      afterEdges: [],
    };

    class MergeableMockCommand implements Command {
      graphTransaction?: GraphCommandTransaction;

      constructor(private marker: number, transaction?: GraphCommandTransaction) {
        this.graphTransaction = transaction;
      }

      execute(): void {
        value = this.marker;
      }

      undo(): void {
        value = 0;
      }

      canMerge(next: Command): boolean {
        return next instanceof MergeableMockCommand;
      }

      merge(next: Command): void {
        if (!(next instanceof MergeableMockCommand)) {
          return;
        }

        this.marker = next.marker;
        this.graphTransaction = next.graphTransaction ?? this.graphTransaction;
      }
    }

    const first = new MergeableMockCommand(1, tx1);
    const second = new MergeableMockCommand(2, tx2);

    service.executeDocumentCommand(first);
    service.executeDocumentCommand(second);

    expect(value).toBe(2);
    expect(first.graphTransaction).toEqual(tx2);

    service.undoDocument();
    expect(value).toBe(0);

    service.redoDocument();
    expect(value).toBe(2);
    expect(first.graphTransaction).toEqual(tx2);
    expect(service.latestGraphTransaction()).toEqual(tx2);
    expect(service.latestGraphTransactionSource()).toBe('redo');
  });

  it('publishes graph transaction source for execute undo redo and resets on clear', () => {
    const tx: GraphCommandTransaction = {
      kind: 'widget-update',
      touchedWidgetIds: ['connector-9'],
      beforeEdges: [],
      afterEdges: [],
    };

    let value = 0;
    const cmd: Command = {
      graphTransaction: tx,
      execute: () => {
        value += 1;
      },
      undo: () => {
        value -= 1;
      },
    };

    service.executeDocumentCommand(cmd);
    expect(value).toBe(1);
    expect(service.latestGraphTransaction()).toEqual(tx);
    expect(service.latestGraphTransactionSource()).toBe('execute');
    expect(service.latestGraphTransactionSummary()).toContain('EXECUTE');

    service.undoDocument();
    expect(value).toBe(0);
    expect(service.latestGraphTransactionSource()).toBe('undo');

    service.redoDocument();
    expect(value).toBe(1);
    expect(service.latestGraphTransactionSource()).toBe('redo');

    service.clearHistory();
    expect(service.latestGraphTransaction()).toBeNull();
    expect(service.latestGraphTransactionSource()).toBeNull();
    expect(service.latestGraphTransactionSummary()).toBe('');
  });
});


