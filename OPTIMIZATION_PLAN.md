# Widget Save System - Edge Cases & Performance Optimization Plan

## Identified Issues

### Edge Cases
1. **Orphaned Widget Registrations**: When pages are deleted, widgets are destroyed but may still be registered in WidgetSaveService
2. **Document Replacement**: When document is replaced, widget registrations need cleanup (currently handled but could be improved)
3. **Race Conditions**: Rapid page switching could cause overlapping save operations
4. **Widget Registration Timing**: Widgets not yet registered when save is called (should resolve immediately)
5. **Page Deletion During Save**: If a page is deleted while save is in progress, widgets may be orphaned
6. **Concurrent Save Queue**: Queue processing uses saveAllPendingChanges which may not match the original request

### Performance Issues
1. **O(n) Widget Filtering**: `filter(w => w.pageId === pageId)` on every save - should use Map for O(1) lookup
2. **Sequential Widget Saving**: Widgets saved one-by-one even on same page - could be parallel
3. **Document Observable Wait**: 500ms timeout waiting for document$ to emit on every save
4. **No Widget Indexing**: No efficient way to find widgets by pageId
5. **Array-based Storage**: Using Array instead of Map/Set for faster lookups

### Architecture Improvements Needed
1. **Data Structure**: Use `Map<pageId, Set<WidgetContainer>>` for O(1) lookups
2. **Parallel Saving**: Save widgets on same page in parallel using Promise.all()
3. **Batch Document Updates**: Reduce document observable waits
4. **Cleanup Methods**: Add method to clean up widgets for deleted pages
5. **Better Error Recovery**: Handle partial failures gracefully

## Implementation Plan

### Phase 1: Data Structure Optimization
**File**: `src/app/core/services/widget-save.service.ts`

- Replace `Array<{widgetId, pageId, savePending}>` with:
  - `Map<string, Map<string, WidgetContainer>>` where key1=pageId, key2=widgetId
  - Or `Map<pageId, Set<WidgetContainer>>` with widgetId in container
- Benefits: O(1) lookup instead of O(n) filter

### Phase 2: Parallel Saving
**File**: `src/app/core/services/widget-save.service.ts`

- Change sequential `reduce()` to `Promise.all()` for widgets on same page
- Benefits: Faster saves when multiple widgets on same page

### Phase 3: Cleanup & Edge Cases
**File**: `src/app/core/services/widget-save.service.ts`

- Add `unregisterPageWidgets(pageId: string)` method
- Call it when page is deleted
- Update `replaceDocument()` to call `clearAllWidgetStatus()`

**File**: `src/app/core/services/document.service.ts`

- Call `widgetSaveService.unregisterPageWidgets(pageId)` in `deletePage()`

### Phase 4: Performance Optimizations
**File**: `src/app/features/editor/widgets/widget-container/widget-container.component.ts`

- Reduce document observable wait time or make it optional
- Consider batching multiple widget updates

### Phase 5: Queue Management
**File**: `src/app/core/services/widget-save.service.ts`

- Store original pageId in queue to preserve intent
- Process queue with correct method (saveActivePageWidgets vs saveAllPendingChanges)

## Detailed Changes

### 1. Optimize WidgetSaveService Data Structure

```typescript
// Current: Array-based (O(n) lookup)
private widgetContainers: Array<{ widgetId: string; pageId: string; savePending: () => Promise<void> }> = [];

// Optimized: Map-based (O(1) lookup)
private widgetContainersByPage: Map<string, Map<string, WidgetContainer>> = new Map();

interface WidgetContainer {
  widgetId: string;
  pageId: string;
  savePending: () => Promise<void>;
}
```

### 2. Parallel Widget Saving

```typescript
// Current: Sequential
widgetsToSave.reduce((promise, widget) => {
  return promise.then(() => widget.savePending());
}, Promise.resolve())

// Optimized: Parallel
Promise.all(widgetsToSave.map(w => w.savePending()))
```

### 3. Add Page Cleanup Method

```typescript
unregisterPageWidgets(pageId: string): void {
  this.widgetContainersByPage.delete(pageId);
}
```

### 4. Update Document Service

```typescript
deletePage(subsectionId: string, pageId: string): string | null {
  // Clean up widget registrations for deleted page
  this.widgetSaveService.unregisterPageWidgets(pageId);
  // ... rest of delete logic
}
```

### 5. Improve Queue Processing

```typescript
private saveQueue: Array<{
  pageId: string | null; // Store original intent
  resolve: () => void;
  reject: (error: Error) => void;
}> = [];

private processSaveQueue(): void {
  if (this.saveQueue.length > 0 && !this.isSaving) {
    const nextSave = this.saveQueue.shift();
    if (nextSave) {
      if (nextSave.pageId !== null) {
        this.saveActivePageWidgets(nextSave.pageId)
          .then(() => nextSave.resolve())
          .catch((error) => nextSave.reject(error));
      } else {
        this.saveAllPendingChanges()
          .then(() => nextSave.resolve())
          .catch((error) => nextSave.reject(error));
      }
    }
  }
}
```

## Expected Performance Improvements

1. **Widget Lookup**: O(n) → O(1) - 10x faster for pages with many widgets
2. **Parallel Saving**: 3-5x faster when saving multiple widgets on same page
3. **Memory**: Better cleanup prevents memory leaks
4. **User Experience**: Faster page switches and widget additions

## Testing Checklist

- [ ] Test page deletion with widgets
- [ ] Test rapid page switching
- [ ] Test document replacement
- [ ] Test concurrent save operations
- [ ] Test widget deletion during save
- [ ] Test page deletion during save
- [ ] Performance benchmark: save time for 10 widgets
- [ ] Performance benchmark: page switch time with 50 widgets


