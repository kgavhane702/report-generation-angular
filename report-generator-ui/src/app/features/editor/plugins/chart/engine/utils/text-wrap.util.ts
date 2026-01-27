export interface WrapSpec {
  maxLines: number;
  mode: 'word' | 'char';
}

/**
 * Wrap a label into multiple lines using a max character budget per line.
 * Returns an array of lines suitable for Chart.js multiline ticks.
 *
 * Notes:
 * - We do NOT add ellipsis; if text exceeds `maxLines`, it is simply clipped.
 * - This is a heuristic (char-based), but works well for chart labels where
 *   we don't have a reliable pixel width measurement.
 */
export function wrapTextByChars(text: unknown, maxCharsPerLine: number, spec: WrapSpec): string[] {
  const raw = (text ?? '').toString();
  const maxLines = Math.max(1, Math.trunc(spec.maxLines || 1));
  const maxChars = Math.max(4, Math.trunc(maxCharsPerLine || 12));

  const normalized = raw.replace(/\s+/g, ' ').trim();
  if (!normalized) return [''];

  // Short-circuit
  if (normalized.length <= maxChars) return [normalized];

  if (spec.mode === 'char') {
    return wrapByChar(normalized, maxChars, maxLines);
  }
  return wrapByWord(normalized, maxChars, maxLines);
}

export function toEChartsMultiline(lines: string[]): string {
  return (lines || []).join('\n');
}

function wrapByChar(text: string, maxChars: number, maxLines: number): string[] {
  const lines: string[] = [];
  let idx = 0;

  while (idx < text.length && lines.length < maxLines) {
    const next = text.slice(idx, idx + maxChars);
    idx += maxChars;
    lines.push(next);
  }
  return lines;
}

function wrapByWord(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  const pushLine = (line: string) => {
    if (lines.length < maxLines) lines.push(line);
  };

  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;

    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    // Current line is full; push it.
    if (current) {
      pushLine(current);
      current = '';
    }

    // If the single word is too long, fall back to char wrapping for this word.
    if (w.length > maxChars) {
      const parts = wrapByChar(w, maxChars, Math.max(1, maxLines - lines.length));
      for (const p of parts) {
        pushLine(p);
      }
      continue;
    }

    current = w;
    if (lines.length >= maxLines) break;
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  return lines;
}


