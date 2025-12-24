package com.org.report_generator.importing.parser;

import com.org.report_generator.importing.enums.ImportFormat;
import com.org.report_generator.importing.model.ImportOptions;
import com.org.report_generator.importing.model.TabularDataset;
import org.springframework.web.multipart.MultipartFile;

/**
 * Strategy interface for parsing tabular data from different file formats.
 */
public interface TabularParser {
    ImportFormat format();

    TabularDataset parse(MultipartFile file, ImportOptions options) throws Exception;
}


