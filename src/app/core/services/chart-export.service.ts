import { Injectable, inject, ApplicationRef, NgZone } from '@angular/core';
import { ChartWidgetProps, WidgetModel } from '../../models/widget.model';
import { DocumentModel } from '../../models/document.model';
import { EditorStateService } from './editor-state.service';

@Injectable({
  providedIn: 'root',
})
export class ChartExportService {
  private readonly editorState = inject(EditorStateService);
  private readonly appRef = inject(ApplicationRef);
  private readonly ngZone = inject(NgZone);

  async exportChartToBase64(widget: WidgetModel): Promise<string | null> {
    try {
      return await this.exportGenericChartToBase64(widget);
    } catch {
      return null;
    }
  }

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

      const svgElement = chartContainer.querySelector('svg');
      if (svgElement) {
        const svgString = new XMLSerializer().serializeToString(svgElement);
        return await this.svgToBase64(svgString, widget.size.width, widget.size.height);
      }

      const canvas = chartContainer.querySelector('canvas');
      if (canvas) {
        return canvas.toDataURL('image/png');
      }

      return null;
    } catch {
      return null;
    }
  }

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

      const img = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      return new Promise<string>((resolve, reject) => {
        img.onload = () => {
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/png'));
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

  async exportAllCharts(document: DocumentModel): Promise<DocumentModel> {
    const updatedDocument = this.deepClone(document);
    const currentSubsectionId = this.editorState.activeSubsectionId();
    const subsectionsWithCharts: Array<{ sectionId: string; subsectionId: string }> = [];

    if (updatedDocument.sections) {
      for (const section of updatedDocument.sections) {
        if (section.subsections) {
          for (const subsection of section.subsections) {
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

    for (const { subsectionId } of subsectionsWithCharts) {
      this.ngZone.run(() => {
        this.editorState.setActiveSubsection(subsectionId);
        this.appRef.tick();
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      const section = updatedDocument.sections.find(s =>
        s.subsections.some(sub => sub.id === subsectionId)
      );
      const subsection = section?.subsections.find(sub => sub.id === subsectionId);

      if (subsection && subsection.pages) {
        for (const page of subsection.pages) {
          if (page.widgets) {
            for (const widget of page.widgets) {
              if (widget.type === 'chart') {
                const base64Image = await this.exportChartToBase64(widget);
                if (base64Image) {
                  const props = widget.props as ChartWidgetProps;
                  widget.props = {
                    ...props,
                    exportedImage: base64Image,
                  } as ChartWidgetProps;
                }
              }
            }
          }
        }
      }
    }

    if (currentSubsectionId) {
      this.ngZone.run(() => {
        this.editorState.setActiveSubsection(currentSubsectionId);
        this.appRef.tick();
      });
    }

    return updatedDocument;
  }

  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}

