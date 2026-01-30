package com.org.report_generator.importing.parser.impl;

import com.org.report_generator.config.ImportLimitsConfig;
import com.org.report_generator.importing.model.ImportOptions;
import com.org.report_generator.importing.model.TabularCell;
import com.org.report_generator.importing.model.TabularDataset;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class CsvTabularParserTest {

    @Test
    void semicolonDelimitedCsv_isDetectedAndParsed() throws Exception {
        String csv = "A;B\n1;2\n";
        ImportLimitsConfig limits = new ImportLimitsConfig();
        CsvTabularParser parser = new CsvTabularParser(limits);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "sample.csv",
                "text/csv",
                csv.getBytes(StandardCharsets.UTF_8)
        );

        TabularDataset ds = parser.parse(file, new ImportOptions(null, null));

        assertThat(ds.rows()).hasSize(2);
        assertThat(ds.rows().get(0).cells()).hasSize(2);
        assertThat(ds.rows().get(0).cells().get(0).contentHtml()).contains("A");
        assertThat(ds.rows().get(1).cells().get(1).contentHtml()).contains("2");
    }

    @Test
    void mergedHeaderHeuristic_infersRowAndColumnSpans() throws Exception {
        String csv = """
                Employee ID,Personal Info,,Performance,,,Attendance,
                ,Name,Department,Q1,Q2,Q3,Present Days,Absent Days
                1001,Amit,IT,78,82,80,220,10
                """;

        ImportLimitsConfig limits = new ImportLimitsConfig();
        CsvTabularParser parser = new CsvTabularParser(limits);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "headers.csv",
                "text/csv",
                csv.getBytes(StandardCharsets.UTF_8)
        );

        TabularDataset ds = parser.parse(file, new ImportOptions(null, null));

        TabularCell employeeId = ds.rows().get(0).cells().get(0);
        assertThat(employeeId.merge()).isNotNull();
        assertThat(employeeId.merge().rowSpan()).isEqualTo(2);
        assertThat(employeeId.merge().colSpan()).isEqualTo(1);

        TabularCell personalInfo = ds.rows().get(0).cells().get(1);
        assertThat(personalInfo.merge()).isNotNull();
        assertThat(personalInfo.merge().colSpan()).isEqualTo(2);

        TabularCell performance = ds.rows().get(0).cells().get(3);
        assertThat(performance.merge()).isNotNull();
        assertThat(performance.merge().colSpan()).isEqualTo(3);

        TabularCell attendance = ds.rows().get(0).cells().get(6);
        assertThat(attendance.merge()).isNotNull();
        assertThat(attendance.merge().colSpan()).isEqualTo(2);

        TabularCell covered = ds.rows().get(0).cells().get(2);
        assertThat(covered.coveredBy()).isNotNull();
        assertThat(covered.coveredBy().row()).isEqualTo(0);
        assertThat(covered.coveredBy().col()).isEqualTo(1);
    }

    @Test
    void respectsRowLimit() {
        String csv = "A,B\n1,2\n3,4\n";
        ImportLimitsConfig limits = new ImportLimitsConfig();
        limits.setMaxRows(1);
        CsvTabularParser parser = new CsvTabularParser(limits);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "limit.csv",
                "text/csv",
                csv.getBytes(StandardCharsets.UTF_8)
        );

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                parser.parse(file, new ImportOptions(null, null)));
        assertThat(ex.getMessage()).contains("too many rows");
    }
}
