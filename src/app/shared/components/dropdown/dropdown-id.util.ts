let nextId = 1;

export function createDropdownId(prefix = 'dropdown'): string {
  return `${prefix}-${nextId++}`;
}
