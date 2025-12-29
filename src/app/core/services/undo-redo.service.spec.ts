import { TestBed } from '@angular/core/testing';

import { Command, UndoRedoService } from './undo-redo.service';

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
});


