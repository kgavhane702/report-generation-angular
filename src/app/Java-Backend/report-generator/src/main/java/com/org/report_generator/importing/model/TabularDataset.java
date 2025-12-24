package com.org.report_generator.importing.model;

import java.util.List;

/**
 * Format-agnostic internal representation (IR) for imported tabular data.
 *
 * This is the key decoupling point: parsers produce TabularDataset, and adapters
 * convert it for specific consumers (Table widget now, Chart later).
 */
public record TabularDataset(
        List<TabularRow> rows,
        List<Double> columnFractions,
        List<Double> rowFractions
) {
}


