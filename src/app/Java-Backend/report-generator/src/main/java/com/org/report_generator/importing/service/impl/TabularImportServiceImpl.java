package com.org.report_generator.importing.service.impl;

import com.org.report_generator.importing.adapter.TabularTargetAdapter;
import com.org.report_generator.importing.adapter.TabularTargetAdapterRegistry;
import com.org.report_generator.importing.enums.ImportFormat;
import com.org.report_generator.importing.enums.ImportTarget;
import com.org.report_generator.importing.factory.TabularParserFactory;
import com.org.report_generator.importing.model.ImportOptions;
import com.org.report_generator.importing.model.TabularDataset;
import com.org.report_generator.importing.parser.TabularParser;
import com.org.report_generator.importing.service.TabularImportService;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * Default implementation of {@link TabularImportService}.
 */
@Service
public class TabularImportServiceImpl implements TabularImportService {

    private final TabularParserFactory parserFactory;
    private final TabularTargetAdapterRegistry adapterRegistry;

    public TabularImportServiceImpl(
            TabularParserFactory parserFactory,
            TabularTargetAdapterRegistry adapterRegistry
    ) {
        this.parserFactory = parserFactory;
        this.adapterRegistry = adapterRegistry;
    }

    @Override
    public TabularDataset importDataset(MultipartFile file, ImportFormat format, ImportOptions options) throws Exception {
        validateFile(file);
        TabularParser parser = parserFactory.get(format);
        return parser.parse(file, options);
    }

    @Override
    public <T> T importForTarget(
            MultipartFile file,
            ImportFormat format,
            ImportTarget target,
            ImportOptions options,
            Class<T> outputType
    ) throws Exception {
        TabularDataset dataset = importDataset(file, format, options);
        TabularTargetAdapter<T> adapter = adapterRegistry.get(target, outputType);
        return adapter.adapt(dataset);
    }

    private static void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Import file is required");
        }
    }
}


