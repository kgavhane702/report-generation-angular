package com.org.report_generator.importing.model;

import java.util.List;

/**
 * A single row in a tabular dataset.
 */
public record TabularRow(
        String id,
        List<TabularCell> cells
) {
}


