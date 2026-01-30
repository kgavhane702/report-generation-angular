package com.org.report_generator.importing.service;

import com.org.report_generator.importing.enums.ImportFormat;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class FormatDetectorTest {

    @Test
    void overrideAlwaysWins() {
        FormatDetector detector = new FormatDetector();
        ImportFormat fmt = detector.detect(ImportFormat.JSON, "http://example.com/data.csv", "text/csv", null);
        assertThat(fmt).isEqualTo(ImportFormat.JSON);
    }

    @Test
    void detectsByUrlExtension() {
        FormatDetector detector = new FormatDetector();
        ImportFormat fmt = detector.detect(null, "https://example.com/data.xml?x=1", null, null);
        assertThat(fmt).isEqualTo(ImportFormat.XML);
    }

    @Test
    void detectsByContentType() {
        FormatDetector detector = new FormatDetector();
        ImportFormat fmt = detector.detect(null, null, "application/json", null);
        assertThat(fmt).isEqualTo(ImportFormat.JSON);
    }

    @Test
    void detectsBySniffingBytes() {
        FormatDetector detector = new FormatDetector();
        ImportFormat fmt = detector.detect(null, null, null, "{\"a\":1}".getBytes());
        assertThat(fmt).isEqualTo(ImportFormat.JSON);

        ImportFormat xml = detector.detect(null, null, null, "<root></root>".getBytes());
        assertThat(xml).isEqualTo(ImportFormat.XML);

        ImportFormat xlsx = detector.detect(null, null, null, new byte[]{'P', 'K', 3, 4});
        assertThat(xlsx).isEqualTo(ImportFormat.XLSX);
    }

    @Test
    void defaultsToCsvWhenUnknown() {
        FormatDetector detector = new FormatDetector();
        ImportFormat fmt = detector.detect(null, null, "text/plain", "hello".getBytes());
        assertThat(fmt).isEqualTo(ImportFormat.CSV);
    }
}
