package com.org.report_generator.importing.service;

import com.org.report_generator.importing.enums.ImportFormat;
import com.org.report_generator.importing.enums.ImportTarget;
import com.org.report_generator.importing.model.ImportOptions;
import com.org.report_generator.importing.model.TabularDataset;
import org.springframework.web.multipart.MultipartFile;

/**
 * High-level service (interface) for tabular imports.
 *
 * Orchestrates: validate input -> select parser -> parse into TabularDataset -> adapt for a target.
 */
public interface TabularImportService {

    TabularDataset importDataset(MultipartFile file, ImportFormat format, ImportOptions options) throws Exception;

    <T> T importForTarget(
            MultipartFile file,
            ImportFormat format,
            ImportTarget target,
            ImportOptions options,
            Class<T> outputType
    ) throws Exception;
}


