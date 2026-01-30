package com.org.report_generator.importing.service;

import com.org.report_generator.config.ImportLimitsConfig;
import com.org.report_generator.importing.adapter.TabularTargetAdapter;
import com.org.report_generator.importing.adapter.TabularTargetAdapterRegistry;
import com.org.report_generator.importing.enums.ImportFormat;
import com.org.report_generator.importing.enums.ImportTarget;
import com.org.report_generator.importing.factory.TabularParserFactory;
import com.org.report_generator.importing.model.ImportOptions;
import com.org.report_generator.importing.model.TabularCell;
import com.org.report_generator.importing.model.TabularDataset;
import com.org.report_generator.importing.model.TabularRow;
import com.org.report_generator.importing.parser.TabularParser;
import com.org.report_generator.importing.service.impl.TabularImportServiceImpl;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;

class TabularImportServiceImplTest {

    @Test
    void importDataset_rejectsEmptyFile() {
        TabularParserFactory parserFactory = Mockito.mock(TabularParserFactory.class);
        TabularTargetAdapterRegistry adapterRegistry = Mockito.mock(TabularTargetAdapterRegistry.class);
        ImportLimitsConfig limits = new ImportLimitsConfig();

        TabularImportServiceImpl svc = new TabularImportServiceImpl(parserFactory, adapterRegistry, limits);

        MockMultipartFile file = new MockMultipartFile("file", "empty.csv", "text/csv", new byte[0]);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                svc.importDataset(file, ImportFormat.CSV, new ImportOptions(null, null)));
        assertThat(ex.getMessage()).contains("Import file is required");
    }

    @Test
    void importDataset_rejectsOversizedFile() {
        TabularParserFactory parserFactory = Mockito.mock(TabularParserFactory.class);
        TabularTargetAdapterRegistry adapterRegistry = Mockito.mock(TabularTargetAdapterRegistry.class);
        ImportLimitsConfig limits = new ImportLimitsConfig();
        limits.setMaxFileSizeBytes(2);

        TabularImportServiceImpl svc = new TabularImportServiceImpl(parserFactory, adapterRegistry, limits);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "big.csv",
                "text/csv",
                "1234".getBytes(StandardCharsets.UTF_8)
        );

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                svc.importDataset(file, ImportFormat.CSV, new ImportOptions(null, null)));
        assertThat(ex.getMessage()).contains("File size exceeds maximum limit");
    }

    @Test
    void importForTarget_parsesAndAdapts() throws Exception {
        TabularParserFactory parserFactory = Mockito.mock(TabularParserFactory.class);
        TabularTargetAdapterRegistry adapterRegistry = Mockito.mock(TabularTargetAdapterRegistry.class);
        ImportLimitsConfig limits = new ImportLimitsConfig();

        TabularParser parser = Mockito.mock(TabularParser.class);
        TabularTargetAdapter<String> adapter = Mockito.mock(TabularTargetAdapter.class);

        TabularDataset dataset = new TabularDataset(
                List.of(new TabularRow("r-0", List.of(new TabularCell("0-0", "A", null, null)))),
                List.of(1.0),
                List.of(1.0)
        );

        Mockito.when(parserFactory.get(ImportFormat.CSV)).thenReturn(parser);
        Mockito.when(parser.parse(any(), any())).thenReturn(dataset);
        Mockito.when(adapterRegistry.get(eq(ImportTarget.TABLE), eq(String.class))).thenReturn(adapter);
        Mockito.when(adapter.adapt(dataset)).thenReturn("ok");

        TabularImportServiceImpl svc = new TabularImportServiceImpl(parserFactory, adapterRegistry, limits);
        MockMultipartFile file = new MockMultipartFile("file", "a.csv", "text/csv", "A".getBytes(StandardCharsets.UTF_8));

        String out = svc.importForTarget(file, ImportFormat.CSV, ImportTarget.TABLE, new ImportOptions(null, null), String.class);

        assertThat(out).isEqualTo("ok");
    }
}
