import { TableToolbarService } from './table-toolbar.service';

describe('TableToolbarService - mixed-state readback', () => {
  it('reports mixed tri-state/value formatting for multi-cell selection with differing styles', () => {
    const s = new TableToolbarService();

    const surfaceA = document.createElement('div');
    surfaceA.className = 'table-widget__cell-surface';
    surfaceA.setAttribute('data-vertical-align', 'top');
    const a = document.createElement('div');
    a.style.fontWeight = 'bold';
    a.style.textAlign = 'left';
    a.style.fontFamily = 'Arial';
    a.style.fontSize = '12px';
    a.style.color = 'rgb(255, 0, 0)';
    surfaceA.appendChild(a);

    const surfaceB = document.createElement('div');
    surfaceB.className = 'table-widget__cell-surface';
    surfaceB.setAttribute('data-vertical-align', 'bottom');
    const b = document.createElement('div');
    b.style.fontWeight = 'normal';
    b.style.textAlign = 'right';
    b.style.fontFamily = 'Times New Roman';
    b.style.fontSize = '12px';
    b.style.color = 'rgb(0, 0, 255)';
    surfaceB.appendChild(b);

    document.body.appendChild(surfaceA);
    document.body.appendChild(surfaceB);

    try {
      s.setSelectedCellsGetter(() => [a, b]);
      s.setSelectedCells(new Set(['0-0', '0-1']));

      s.updateFormattingState();

      const state = s.formattingState();
      expect(state.isBold).toBe('mixed');
      expect(state.textAlign).toBe('mixed');
      expect(state.verticalAlign).toBe('mixed');
      expect(state.fontFamily).toBe('');
      expect(state.fontSizePx).toBe(12);
      expect(state.textColor).toBe('');
    } finally {
      surfaceA.remove();
      surfaceB.remove();
      s.setSelectedCellsGetter(null);
      s.setSelectedCells(new Set());
    }
  });
});
