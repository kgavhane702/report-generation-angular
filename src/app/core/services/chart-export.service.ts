import { Injectable, inject, ApplicationRef, NgZone } from '@angular/core';
import { ChartWidgetProps, WidgetModel } from '../../models/widget.model';
import { DocumentModel } from '../../models/document.model';
import { EditorStateService } from './editor-state.service';

/**
 * Service for exporting charts to base64 images
 */
@Injectable({
  providedIn: 'root',
})
export class ChartExportService {
  private readonly editorState = inject(EditorStateService);
  private readonly appRef = inject(ApplicationRef);
  private readonly ngZone = inject(NgZone);
  /**
   * Export chart widget to base64 image
   * @param widget Chart widget model
   * @returns Promise resolving to base64 image string or null if failed
   */
  async exportChartToBase64(widget: WidgetModel): Promise<string | null> {
    try {
      // For all providers, try to find the chart container and export
      return await this.exportGenericChartToBase64(widget);
    } catch (error) {
      console.error('Error exporting chart to base64:', error);
      return null;
    }
  }


  /**
   * Export generic chart to base64 (fallback)
   */
  private async exportGenericChartToBase64(widget: WidgetModel): Promise<string | null> {
    try {
      const widgetElement = document.querySelector(`[data-widget-id="${widget.id}"]`);
      if (!widgetElement) {
        return null;
      }

      const chartContainer = widgetElement.querySelector('.chart-widget__container') as HTMLElement;
      if (!chartContainer) {
        return null;
      }

      // Try SVG first
      const svgElement = chartContainer.querySelector('svg');
      if (svgElement) {
        const svgString = new XMLSerializer().serializeToString(svgElement);
        return await this.svgToBase64(svgString, widget.size.width, widget.size.height);
      }

      // Try canvas
      const canvas = chartContainer.querySelector('canvas');
      if (canvas) {
        return canvas.toDataURL('image/png');
      }

      return null;
    } catch (error) {
      console.error('Error exporting generic chart:', error);
      return null;
    }
  }

  /**
   * Convert SVG string to base64 image
   */
  private async svgToBase64(svgString: string, width: number, height: number): Promise<string> {
    try {
      // Create a canvas to render the SVG
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Create an image from the SVG
      const img = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      return new Promise<string>((resolve, reject) => {
        img.onload = () => {
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          URL.revokeObjectURL(url);
          const base64 = canvas.toDataURL('image/png');
          resolve(base64);
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to load SVG image'));
        };

        img.src = url;
      }).catch(() => {
        // Fallback: return SVG as data URL directly
        const base64Svg = btoa(unescape(encodeURIComponent(svgString)));
        return `data:image/svg+xml;base64,${base64Svg}`;
      });
    } catch (error) {
      console.error('Error converting SVG to base64:', error);
      // Fallback: return SVG as data URL directly
      const base64Svg = btoa(unescape(encodeURIComponent(svgString)));
      return `data:image/svg+xml;base64,${base64Svg}`;
    }
  }

  /**
   * Export all charts in a document to base64
   * This should be called before exporting the document
   * Temporarily activates each subsection to ensure all pages are rendered in the DOM
   */
  async exportAllCharts(document: DocumentModel): Promise<DocumentModel> {
    // Deep clone the document to avoid modifying frozen objects
    const updatedDocument = this.deepClone(document);
    
    // Store current active subsection to restore later
    const currentSubsectionId = this.editorState.activeSubsectionId();
    
    // Collect all subsections that have charts
    const subsectionsWithCharts: Array<{ sectionId: string; subsectionId: string }> = [];
    
    if (updatedDocument.sections) {
      for (const section of updatedDocument.sections) {
        if (section.subsections) {
          for (const subsection of section.subsections) {
            // Check if this subsection has any charts
            let hasCharts = false;
            if (subsection.pages) {
              for (const page of subsection.pages) {
                if (page.widgets) {
                  for (const widget of page.widgets) {
                    if (widget.type === 'chart') {
                      hasCharts = true;
                      break;
                    }
                  }
                }
                if (hasCharts) break;
              }
            }
            
            if (hasCharts) {
              subsectionsWithCharts.push({
                sectionId: section.id,
                subsectionId: subsection.id
              });
            }
          }
        }
      }
    }
    
    // Process charts subsection by subsection
    // This ensures each subsection's pages are rendered in the DOM before we try to export
    for (const { subsectionId } of subsectionsWithCharts) {
      // Activate this subsection to render its pages
      this.ngZone.run(() => {
        this.editorState.setActiveSubsection(subsectionId);
        this.appRef.tick();
      });
      
      // Wait for pages to render
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Now export charts from this subsection
      const section = updatedDocument.sections.find(s => 
        s.subsections.some(sub => sub.id === subsectionId)
      );
      const subsection = section?.subsections.find(sub => sub.id === subsectionId);
      
      if (subsection && subsection.pages) {
        for (const page of subsection.pages) {
          if (page.widgets) {
            for (const widget of page.widgets) {
              if (widget.type === 'chart') {
                console.log('Exporting chart widget:', widget.id);
                // Export chart to base64
                const base64Image = await this.exportChartToBase64(widget);
                if (base64Image) {
                  console.log('Successfully exported chart to base64 for widget:', widget.id, 'Length:', base64Image.length);
                  // Update widget props with exported image (on cloned object)
                  const props = widget.props as ChartWidgetProps;
                  // Create new props object with exportedImage
                  widget.props = {
                    ...props,
                    exportedImage: base64Image,
                  } as ChartWidgetProps;
                  // Verify it was set
                  const updatedProps = widget.props as ChartWidgetProps;
                  if (updatedProps.exportedImage) {
                    console.log('exportedImage successfully set on widget:', widget.id);
                  } else {
                    console.error('Failed to set exportedImage on widget:', widget.id);
                  }
                } else {
                  console.warn('Failed to export chart to base64 for widget:', widget.id);
                }
              }
            }
          }
        }
      }
    }
    
    // Restore original active subsection
    if (currentSubsectionId) {
      this.ngZone.run(() => {
        this.editorState.setActiveSubsection(currentSubsectionId);
        this.appRef.tick();
      });
    }

    return updatedDocument;
  }

  /**
   * Deep clone an object
   */
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}

