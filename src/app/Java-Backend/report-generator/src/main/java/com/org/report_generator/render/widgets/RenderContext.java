package com.org.report_generator.render.widgets;

import com.org.report_generator.model.document.DocumentModel;
import com.org.report_generator.model.document.Page;

/**
 * Additional context for widget rendering.
 * Keep minimal for now; can be extended later without touching widget render signatures.
 */
public record RenderContext(
        DocumentModel document,
        Page page
) {}


