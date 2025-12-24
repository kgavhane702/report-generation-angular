package com.org.report_generator.importing.adapter;

import com.org.report_generator.importing.enums.ImportTarget;
import com.org.report_generator.importing.model.TabularDataset;

/**
 * Adapter interface to convert a {@link TabularDataset} into a specific consumer output.
 *
 * Example: TabularDataset -> ExcelTableImportResponse (TABLE), later TabularDataset -> ChartData (CHART).
 */
public interface TabularTargetAdapter<T> {
    ImportTarget target();

    Class<T> outputType();

    T adapt(TabularDataset dataset);
}


