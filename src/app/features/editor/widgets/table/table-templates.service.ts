import { Injectable } from '@angular/core';

import { TableTemplate, TableStyleSettings } from '../../../../models/table-style.model';

/**
 * Service providing table templates/presets similar to MS Word/PowerPoint
 */
@Injectable({
  providedIn: 'root',
})
export class TableTemplatesService {
  private readonly templates: TableTemplate[] = [
    {
      id: 'plain-table',
      name: 'Plain Table',
      description: 'Simple table with basic borders',
      styleSettings: {
        borderColor: '#000000',
        borderWidth: 1,
        borderStyle: 'solid',
        cellPadding: 8,
        headerBackgroundColor: '#ffffff',
        headerTextColor: '#000000',
        backgroundColor: '#ffffff',
        textColor: '#000000',
        fontSize: 14,
        fontFamily: 'Arial, sans-serif',
      },
    },
    {
      id: 'grid-table',
      name: 'Grid Table',
      description: 'Table with full grid borders',
      styleSettings: {
        borderColor: '#cccccc',
        borderWidth: 1,
        borderStyle: 'solid',
        cellPadding: 10,
        headerBackgroundColor: '#f3f4f6',
        headerTextColor: '#1f2937',
        headerBorderColor: '#cccccc',
        headerBorderWidth: 1,
        backgroundColor: '#ffffff',
        textColor: '#1f2937',
        alternateRowColor: '#f9fafb',
        fontSize: 14,
        fontFamily: 'Arial, sans-serif',
      },
    },
    {
      id: 'modern-table',
      name: 'Modern Table',
      description: 'Modern design with colored header',
      styleSettings: {
        borderColor: '#e5e7eb',
        borderWidth: 0,
        borderStyle: 'solid',
        cellPadding: 12,
        headerBackgroundColor: '#3b82f6',
        headerTextColor: '#ffffff',
        headerBorderColor: '#3b82f6',
        headerBorderWidth: 0,
        backgroundColor: '#ffffff',
        textColor: '#1f2937',
        alternateRowColor: '#f3f4f6',
        fontSize: 14,
        fontFamily: 'Inter, system-ui, sans-serif',
        headerStyle: {
          fontWeight: 600,
          fontSize: 14,
        },
      },
    },
    {
      id: 'zebra-table',
      name: 'Zebra Stripes',
      description: 'Alternating row colors',
      styleSettings: {
        borderColor: '#e5e7eb',
        borderWidth: 1,
        borderStyle: 'solid',
        cellPadding: 10,
        headerBackgroundColor: '#4b5563',
        headerTextColor: '#ffffff',
        headerBorderColor: '#4b5563',
        headerBorderWidth: 0,
        backgroundColor: '#ffffff',
        textColor: '#1f2937',
        alternateRowColor: '#f3f4f6',
        fontSize: 14,
        fontFamily: 'Arial, sans-serif',
        headerStyle: {
          fontWeight: 600,
        },
      },
    },
    {
      id: 'elegant-table',
      name: 'Elegant Table',
      description: 'Elegant design with subtle borders',
      styleSettings: {
        borderColor: '#d1d5db',
        borderWidth: 1,
        borderStyle: 'solid',
        cellPadding: 14,
        headerBackgroundColor: '#ffffff',
        headerTextColor: '#111827',
        headerBorderColor: '#111827',
        headerBorderWidth: 2,
        backgroundColor: '#ffffff',
        textColor: '#374151',
        fontSize: 14,
        fontFamily: 'Georgia, serif',
        headerStyle: {
          fontWeight: 700,
          fontSize: 15,
        },
      },
    },
    {
      id: 'dark-table',
      name: 'Dark Table',
      description: 'Dark theme table',
      styleSettings: {
        borderColor: '#374151',
        borderWidth: 1,
        borderStyle: 'solid',
        cellPadding: 10,
        headerBackgroundColor: '#1f2937',
        headerTextColor: '#ffffff',
        headerBorderColor: '#1f2937',
        headerBorderWidth: 0,
        backgroundColor: '#111827',
        textColor: '#e5e7eb',
        alternateRowColor: '#1f2937',
        fontSize: 14,
        fontFamily: 'Arial, sans-serif',
        headerStyle: {
          fontWeight: 600,
        },
      },
    },
    {
      id: 'colorful-table',
      name: 'Colorful Table',
      description: 'Vibrant colors with alternating columns',
      styleSettings: {
        borderColor: '#e5e7eb',
        borderWidth: 0,
        borderStyle: 'solid',
        cellPadding: 12,
        headerBackgroundColor: '#8b5cf6',
        headerTextColor: '#ffffff',
        headerBorderColor: '#8b5cf6',
        headerBorderWidth: 0,
        backgroundColor: '#ffffff',
        textColor: '#1f2937',
        alternateRowColor: '#faf5ff',
        alternateColumnColor: '#f3f4f6',
        fontSize: 14,
        fontFamily: 'Arial, sans-serif',
        headerStyle: {
          fontWeight: 600,
        },
      },
    },
  ];

  /**
   * Get all available templates
   */
  getTemplates(): TableTemplate[] {
    return [...this.templates];
  }

  /**
   * Get a template by ID
   */
  getTemplate(id: string): TableTemplate | undefined {
    return this.templates.find(t => t.id === id);
  }

  /**
   * Apply template styles to a table style settings object
   */
  applyTemplate(templateId: string, existingSettings?: TableStyleSettings): TableStyleSettings {
    const template = this.getTemplate(templateId);
    if (!template) {
      return existingSettings || {};
    }

    return {
      ...existingSettings,
      ...template.styleSettings,
    };
  }
}

