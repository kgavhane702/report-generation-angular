# Image Widget Functionality - Design Plan & Architecture

## Overview
This document outlines the design and architecture for implementing full image widget functionality, including file upload, browse button, and proper state management.

## Current State Analysis

### Existing Components
- **ImageWidgetComponent**: Basic component that displays an image from `ImageWidgetProps.src`
- **WidgetModel**: Already includes `ImageWidgetProps` with `src`, `alt`, and `fit` properties
- **WidgetFactoryService**: Creates image widgets with placeholder URL
- **WidgetContainerComponent**: Handles widget selection, dragging, resizing, and prop updates
- **ImageConverterUtil**: Utility for converting images to base64

### Current Limitations
1. No file upload capability
2. No browse button UI
3. No placeholder state when no image is selected
4. No image loading/error states
5. No way to change image after initial creation
6. Props changes not properly emitted to parent

## Architecture Design

### 1. Component Architecture

```
ImageWidgetComponent
├── Display Mode (when image exists)
│   ├── Image element with fit modes (cover/contain/stretch)
│   └── Click to edit/replace image
├── Upload Mode (when no image or editing)
│   ├── Placeholder UI
│   ├── Browse button
│   └── File input (hidden)
└── Loading/Error States
    ├── Loading spinner
    └── Error message
```

### 2. Data Flow

```
User Action (Click Browse/Image)
    ↓
File Input Dialog Opens
    ↓
File Selected
    ↓
FileReader converts to base64
    ↓
ImageWidgetComponent emits propsChange
    ↓
WidgetContainerComponent.onContentChange()
    ↓
DocumentService.updateWidget()
    ↓
NgRx Store Update
    ↓
Component Re-renders with new image
```

### 3. Component Responsibilities

#### ImageWidgetComponent
- **Input**: `widget: WidgetModel` (required)
- **Output**: `propsChange: EventEmitter<Partial<ImageWidgetProps>>`
- **Responsibilities**:
  - Display image when `src` exists
  - Show placeholder/browse UI when `src` is empty or invalid
  - Handle file selection via hidden file input
  - Convert selected file to base64 data URL
  - Emit prop changes to parent
  - Handle image loading states (loading, success, error)
  - Apply image fit modes (cover, contain, stretch)
  - Support click-to-replace functionality

#### WidgetContainerComponent
- **Responsibilities**:
  - Listen to `propsChange` from ImageWidgetComponent
  - Call `onContentChange()` to update widget props
  - Already handles selection, dragging, resizing

### 4. File Upload Strategy

#### Option A: Base64 Data URLs (Recommended for MVP)
- **Pros**: 
  - No backend required
  - Works offline
  - Simple implementation
  - Already have utility function
- **Cons**:
  - Increases document JSON size
  - Not ideal for large images
- **Implementation**: Use `FileReader.readAsDataURL()`

#### Option B: File Upload Service (Future Enhancement)
- Upload to backend/CDN
- Store URL reference in widget props
- Better for production with large files

**Decision**: Start with Option A (base64) for MVP, design for easy migration to Option B later.

### 5. Image Fit Modes

The `ImageWidgetProps.fit` property supports:
- `'cover'`: Image covers entire widget, may crop (default)
- `'contain'`: Image fits within widget, maintains aspect ratio
- `'stretch'`: Image stretches to fill widget, may distort

Implementation via CSS `object-fit` property.

### 6. User Experience Flow

1. **Initial State** (No Image):
   - Show placeholder with "Click to upload image" or "Browse" button
   - Clicking opens file dialog

2. **Image Selected**:
   - Show loading state (optional spinner)
   - Convert to base64
   - Display image with fit mode
   - Emit props change

3. **Image Displayed**:
   - Show image with proper fit
   - Click on image to replace (optional - can be added later)
   - Widget can be dragged/resized normally

4. **Error State**:
   - If image fails to load, show error message
   - Allow retry/browse again

### 7. File Validation

- **Accepted Types**: `image/*` (or specific: jpeg, png, gif, webp, svg)
- **Size Limit**: Consider 5-10MB max (configurable)
- **Validation**: Check file type and size before processing

### 8. Implementation Details

#### ImageWidgetComponent Structure
```typescript
export class ImageWidgetComponent {
  @Input() widget!: WidgetModel;
  @Output() propsChange = new EventEmitter<Partial<ImageWidgetProps>>();
  
  // State
  isUploading = false;
  imageError = false;
  fileInputRef?: HTMLInputElement;
  
  // Methods
  onBrowseClick()
  onFileSelected(event: Event)
  convertFileToBase64(file: File): Promise<string>
  handleImageError()
  get imageProps(): ImageWidgetProps
  get hasImage(): boolean
  get imageFitStyle(): string
}
```

#### Template Structure
```html
<div class="image-widget">
  <!-- Image Display Mode -->
  <ng-container *ngIf="hasImage && !imageError">
    <img 
      [src]="imageProps.src" 
      [alt]="imageProps.alt || 'Image'"
      [style.object-fit]="imageProps.fit || 'cover'"
      (error)="handleImageError()"
    />
  </ng-container>
  
  <!-- Upload/Placeholder Mode -->
  <ng-container *ngIf="!hasImage || imageError">
    <div class="image-widget__placeholder">
      <button (click)="onBrowseClick()" [disabled]="isUploading">
        {{ isUploading ? 'Uploading...' : 'Browse Image' }}
      </button>
      <input 
        #fileInput
        type="file"
        accept="image/*"
        (change)="onFileSelected($event)"
        style="display: none"
      />
    </div>
  </ng-container>
  
  <!-- Loading State (optional) -->
  <div *ngIf="isUploading" class="image-widget__loading">
    <span>Loading...</span>
  </div>
</div>
```

### 9. Integration Points

1. **WidgetContainerComponent**: 
   - Add `(propsChange)="onContentChange($event)"` to image-widget case
   - Already implemented for text-widget, same pattern

2. **WidgetFactoryService**:
   - Update `createImageWidget()` to use empty `src` initially
   - Or keep placeholder, but make it clear it needs replacement

3. **ImageWidgetProps Model**:
   - Already has `src`, `alt`, `fit` - no changes needed
   - Consider adding `originalFileName` for future reference

### 10. Styling Considerations

- Placeholder should be visually distinct
- Browse button should be prominent and accessible
- Image should respect widget boundaries
- Loading state should be subtle
- Error state should be clear but not intrusive
- Maintain consistent styling with other widgets

### 11. Accessibility

- File input should have proper labels
- Alt text support for images
- Keyboard navigation support
- ARIA labels for buttons
- Screen reader friendly messages

### 12. Future Enhancements

1. **Image Editor**: Crop, rotate, filters
2. **URL Input**: Allow pasting image URLs
3. **Drag & Drop**: Drop images directly onto widget
4. **Image Library**: Browse previously used images
5. **Backend Upload**: Upload to CDN/backend instead of base64
6. **Image Optimization**: Compress/resize before storing
7. **Replace on Click**: Click image to replace (currently browse only on placeholder)

## Implementation Checklist

- [x] Design architecture
- [ ] Update ImageWidgetComponent with file upload logic
- [ ] Add file input and browse button UI
- [ ] Implement base64 conversion
- [ ] Add loading/error states
- [ ] Emit propsChange events
- [ ] Update WidgetContainerComponent to handle image props
- [ ] Add proper styling
- [ ] Test file validation
- [ ] Test with different image formats
- [ ] Test image fit modes
- [ ] Test widget resize with different fit modes
- [ ] Accessibility testing

## Testing Strategy

1. **Unit Tests**:
   - File selection and conversion
   - Props change emission
   - Error handling
   - Fit mode application

2. **Integration Tests**:
   - Widget creation and image upload
   - Props update through document service
   - Widget resize with different fit modes

3. **E2E Tests**:
   - Complete upload flow
   - Image display and interaction
   - Widget operations (drag, resize, delete)

