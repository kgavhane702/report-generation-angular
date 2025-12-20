import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * safeHtml
 *
 * The table widget stores rich text as HTML strings and renders via `[innerHTML]`.
 * Angular's default sanitizer strips inline `style` attributes, which removes
 * text color/highlight (e.g. `<span style="color: ...">`).
 *
 * This pipe:
 * - Removes obviously dangerous tags/attributes (basic XSS hardening)
 * - Preserves a small allowlist of inline CSS properties used by the editor
 * - Returns a trusted SafeHtml value (cached per input string to avoid re-render churn)
 */
@Pipe({
  name: 'safeHtml',
  standalone: true,
  pure: true,
})
export class SafeHtmlPipe implements PipeTransform {
  private readonly cache = new Map<string, SafeHtml>();

  constructor(private readonly sanitizer: DomSanitizer) {}

  transform(value: string | null | undefined): SafeHtml {
    const html = value ?? '';
    const cached = this.cache.get(html);
    if (cached) return cached;

    const cleaned = sanitizeRichTextHtml(html);
    const trusted = this.sanitizer.bypassSecurityTrustHtml(cleaned);
    this.cache.set(html, trusted);
    return trusted;
  }
}

function sanitizeRichTextHtml(input: string): string {
  // Fast path for plain text-ish strings.
  if (!input || input.indexOf('<') === -1) return input ?? '';

  // DOMParser is available in the browser; in non-browser contexts return raw.
  if (typeof DOMParser === 'undefined') return input;

  const parser = new DOMParser();
  const doc = parser.parseFromString(input, 'text/html');

  // Remove dangerous elements completely.
  const forbiddenSelectors = 'script,style,iframe,object,embed,link,meta';
  doc.querySelectorAll(forbiddenSelectors).forEach((el) => el.remove());

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  const toProcess: Element[] = [];
  while (walker.nextNode()) {
    toProcess.push(walker.currentNode as Element);
  }

  for (const el of toProcess) {
    // Strip event handlers and risky attributes.
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value ?? '';

      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
        continue;
      }

      if (name === 'style') {
        const nextStyle = sanitizeInlineStyle(value);
        if (nextStyle) {
          el.setAttribute('style', nextStyle);
        } else {
          el.removeAttribute('style');
        }
        continue;
      }

      if (name === 'href') {
        // Prevent `javascript:` URLs.
        if (!isSafeHref(value)) {
          el.removeAttribute('href');
        }
        continue;
      }

      // Drop src to avoid unexpected remote loads inside editor content.
      if (name === 'src') {
        el.removeAttribute('src');
        continue;
      }
    }
  }

  return doc.body.innerHTML;
}

function sanitizeInlineStyle(style: string): string {
  const allowedProps = new Set([
    'color',
    'background-color',
    'font-weight',
    'font-style',
    'text-decoration',
    'white-space',
  ]);

  const parts = style
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  const kept: string[] = [];
  for (const part of parts) {
    const idx = part.indexOf(':');
    if (idx === -1) continue;
    const prop = part.slice(0, idx).trim().toLowerCase();
    const val = part.slice(idx + 1).trim();
    if (!allowedProps.has(prop)) continue;
    if (!isSafeCssValue(val)) continue;
    kept.push(`${prop}: ${val}`);
  }

  return kept.join('; ');
}

function isSafeCssValue(value: string): boolean {
  const v = (value ?? '').trim().toLowerCase();
  if (!v) return false;
  // Reject common script vectors.
  if (v.includes('url(')) return false;
  if (v.includes('expression(')) return false;
  if (v.includes('javascript:')) return false;
  // Keep values fairly permissive but plain.
  // (colors like #fff, rgb(...), hsl(...), and keywords like "bold"/"italic"/"pre-wrap")
  return /^[#a-z0-9(),.%\s-]+$/i.test(v);
}

function isSafeHref(href: string): boolean {
  const v = (href ?? '').trim().toLowerCase();
  if (!v) return false;
  if (v.startsWith('javascript:')) return false;
  if (v.startsWith('data:')) return false;
  // Allow relative and common safe protocols.
  return (
    v.startsWith('http://') ||
    v.startsWith('https://') ||
    v.startsWith('mailto:') ||
    v.startsWith('tel:') ||
    v.startsWith('/') ||
    v.startsWith('#')
  );
}


