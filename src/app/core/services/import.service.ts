import { Injectable } from '@angular/core';
import { DocumentModel } from '../../models/document.model';
import { DocumentExport } from './export.service';

/**
 * Import result with validation information
 */
export interface ImportResult {
  success: boolean;
  document?: DocumentModel;
  error?: string;
  warnings?: string[];
  metadata?: DocumentExport['metadata'];
}

/**
 * Service for importing documents from JSON format
 */
@Injectable({
  providedIn: 'root',
})
export class ImportService {
  /**
   * Import document from JSON string
   */
  importFromJson(jsonString: string): ImportResult {
    try {
      const data = JSON.parse(jsonString) as DocumentExport | DocumentModel;
      
      // Handle both formats: with metadata or just document
      let document: DocumentModel;
      let metadata: DocumentExport['metadata'] | undefined;
      
      if ('document' in data && 'metadata' in data) {
        // New format with metadata
        document = data.document;
        metadata = data.metadata;
      } else {
        // Legacy format or direct document
        document = data as DocumentModel;
      }

      // Validate document structure
      const validation = this.validateDocument(document);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error || 'Invalid document structure',
          warnings: validation.warnings,
        };
      }

      return {
        success: true,
        document: this.normalizeDocument(document),
        metadata,
        warnings: validation.warnings,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse JSON',
      };
    }
  }

  /**
   * Import document from file
   */
  async importFromFile(file: File): Promise<ImportResult> {
    try {
      const text = await file.text();
      return this.importFromJson(text);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read file',
      };
    }
  }

  /**
   * Validate document structure
   */
  private validateDocument(document: any): {
    valid: boolean;
    error?: string;
    warnings?: string[];
  } {
    const warnings: string[] = [];

    if (!document) {
      return { valid: false, error: 'Document is null or undefined' };
    }

    if (typeof document !== 'object') {
      return { valid: false, error: 'Document must be an object' };
    }

    // Check required fields
    if (!document.id || typeof document.id !== 'string') {
      return { valid: false, error: 'Document must have a valid id' };
    }

    if (!document.title || typeof document.title !== 'string') {
      warnings.push('Document title is missing or invalid');
    }

    if (!document.pageSize) {
      return { valid: false, error: 'Document must have pageSize' };
    }

    if (!document.pageSize.widthMm || !document.pageSize.heightMm) {
      return { valid: false, error: 'Document pageSize must have widthMm and heightMm' };
    }

    if (!document.sections || !Array.isArray(document.sections)) {
      return { valid: false, error: 'Document must have sections array' };
    }

    // Validate sections structure
    for (const section of document.sections) {
      if (!section.id || !section.title) {
        warnings.push('Some sections are missing id or title');
      }
      if (!Array.isArray(section.subsections)) {
        return { valid: false, error: 'Sections must have subsections array' };
      }

      // Validate subsections
      for (const subsection of section.subsections) {
        if (!subsection.id || !subsection.title) {
          warnings.push('Some subsections are missing id or title');
        }
        if (!Array.isArray(subsection.pages)) {
          return { valid: false, error: 'Subsections must have pages array' };
        }

        // Validate pages
        for (const page of subsection.pages) {
          if (!page.id) {
            warnings.push('Some pages are missing id');
          }
          if (!Array.isArray(page.widgets)) {
            warnings.push('Some pages are missing widgets array');
          }
        }
      }
    }

    return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };
  }

  /**
   * Normalize document to ensure all required fields are present
   */
  private normalizeDocument(document: DocumentModel): DocumentModel {
    return {
      id: document.id,
      title: document.title || 'Imported Document',
      version: document.version || '1.0.0',
      pageSize: {
        widthMm: document.pageSize.widthMm || 254, // Default to PPT widescreen
        heightMm: document.pageSize.heightMm || 190.5,
        dpi: document.pageSize.dpi || 96,
      },
      sections: document.sections.map((section) => ({
        id: section.id,
        title: section.title || 'Untitled Section',
        subsections: section.subsections.map((subsection) => ({
          id: subsection.id,
          title: subsection.title || 'Untitled Subsection',
          pages: subsection.pages.map((page) => ({
            ...page,
            widgets: page.widgets || [],
            // Ensure each page has an orientation (default to landscape if missing)
            orientation: page.orientation || 'landscape',
          })),
        })),
      })),
      metadata: document.metadata || {},
    };
  }
}

