import { Injectable } from '@angular/core';
import * as Highcharts from 'highcharts';
import { ChartWidgetProps, WidgetModel } from '../../models/widget.model';
import { DocumentModel } from '../../models/document.model';

/**
 * Service for exporting charts to base64 images
 */
@Injectable({
  providedIn: 'root',
})
export class ChartExportService {
  /**
   * Export chart widget to base64 image
   * @param widget Chart widget model
   * @returns Promise resolving to base64 image string or null if failed
   */
  async exportChartToBase64(widget: WidgetModel): Promise<string | null> {
    try {
      const props = widget.props as ChartWidgetProps;
      const provider = props.provider || 'highcharts';

      if (provider === 'highcharts') {
        return await this.exportHighchartsToBase64(widget);
      }

      // For other providers, try to find the chart container and export
      return await this.exportGenericChartToBase64(widget);
    } catch (error) {
      console.error('Error exporting chart to base64:', error);
      return null;
    }
  }

  /**
   * Export Highcharts chart to base64
   */
  private async exportHighchartsToBase64(widget: WidgetModel): Promise<string | null> {
    try {
      // Small delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Find the chart container element
      const widgetElement = document.querySelector(`[data-widget-id="${widget.id}"]`) as HTMLElement;
      
      if (!widgetElement) {
        console.warn(`Chart widget element not found: ${widget.id}`);
        return null;
      }

      // Ensure widget is visible (scroll into view if needed)
      const rect = widgetElement.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0;
      
      if (!isVisible) {
        // Scroll widget into view
        widgetElement.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
        // Wait for scroll to complete
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Find the Highcharts container
      let chartContainer = widgetElement.querySelector('.chart-widget__container') as HTMLElement;
      
      // If container not found, try the widget element itself
      if (!chartContainer) {
        chartContainer = widgetElement;
      }
      
      if (!chartContainer) {
        console.warn(`Chart container not found for widget: ${widget.id}`);
        return null;
      }

      // Check if container has any content
      const hasContent = chartContainer.children.length > 0 || 
                        chartContainer.querySelector('svg') || 
                        chartContainer.querySelector('canvas') ||
                        chartContainer.querySelector('.highcharts-root');
      
      if (!hasContent) {
        console.warn(`Chart container is empty for widget: ${widget.id}`);
        return null;
      }

      // Method 1: Try to get Highcharts instance from the container (stored by component)
      let highchartsInstance = (chartContainer as any).highchartsChart;
      
      // Method 2: Try to get from Highcharts internal registry
      if (!highchartsInstance && Highcharts && Highcharts.charts) {
        for (const chart of Highcharts.charts) {
          if (chart) {
            const chartAny = chart as any;
            if (chartAny.renderTo === chartContainer || chart.container === chartContainer) {
              highchartsInstance = chart;
              break;
            }
          }
        }
      }

      // Method 3: Try to get directly from container
      if (!highchartsInstance) {
        highchartsInstance = (chartContainer as any).chart;
      }

      // Method 4: Try to find by iterating through all Highcharts charts
      if (!highchartsInstance && Highcharts && Highcharts.charts) {
        for (let i = 0; i < Highcharts.charts.length; i++) {
          const chart = Highcharts.charts[i];
          if (chart) {
            const chartAny = chart as any;
            if (chart.container === chartContainer || chartAny.renderTo === chartContainer) {
              highchartsInstance = chart;
              break;
            }
          }
        }
      }

      // Method 5: Check if widget element itself has the chart instance
      if (!highchartsInstance) {
        highchartsInstance = (widgetElement as any).highchartsChart;
      }

      // If we found the instance, use its getSVG method
      if (highchartsInstance && typeof highchartsInstance.getSVG === 'function') {
        try {
          const svg = highchartsInstance.getSVG({
            exporting: {
              sourceWidth: widget.size.width || 400,
              sourceHeight: widget.size.height || 300,
            },
          });

          if (svg) {
            return await this.svgToBase64(svg, widget.size.width || 400, widget.size.height || 300);
          }
        } catch (svgError) {
          console.warn('Error getting SVG from Highcharts instance:', svgError);
        }
      }

      // Alternative: Try to find Highcharts SVG element
      const highchartsSvg = chartContainer.querySelector('svg.highcharts-root');
      if (highchartsSvg) {
        const svgString = new XMLSerializer().serializeToString(highchartsSvg);
        return await this.svgToBase64(svgString, widget.size.width || 400, widget.size.height || 300);
      }

      // Fallback: try to find any SVG element in the container
      const svgElement = chartContainer.querySelector('svg');
      if (svgElement) {
        const svgString = new XMLSerializer().serializeToString(svgElement);
        return await this.svgToBase64(svgString, widget.size.width || 400, widget.size.height || 300);
      }

      // Last resort: try canvas if available
      const canvas = chartContainer.querySelector('canvas');
      if (canvas) {
        return canvas.toDataURL('image/png');
      }

      return null;
    } catch (error) {
      console.error(`Error exporting Highcharts chart:`, error);
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
   */
  async exportAllCharts(document: DocumentModel): Promise<DocumentModel> {
    // Deep clone the document to avoid modifying frozen objects
    const updatedDocument = this.deepClone(document);
    
    // Process all sections, subsections, and pages
    if (updatedDocument.sections) {
      for (const section of updatedDocument.sections) {
        if (section.subsections) {
          for (const subsection of section.subsections) {
            if (subsection.pages) {
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
        }
      }
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

