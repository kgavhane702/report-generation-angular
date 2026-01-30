package com.org.report_generator.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

class ImportLimitsConfigTest {

    @Test
    void defaultValues_areSet() {
        ImportLimitsConfig config = new ImportLimitsConfig();

        assertThat(config.getMaxFileSizeBytes()).isEqualTo(10 * 1024 * 1024);
        assertThat(config.getMaxRows()).isEqualTo(10_000);
        assertThat(config.getMaxColumns()).isEqualTo(1_000);
        assertThat(config.getMaxCells()).isEqualTo(10_000_000L);
    }

    @Test
    void setMaxFileSizeBytes_updatesValue() {
        ImportLimitsConfig config = new ImportLimitsConfig();
        config.setMaxFileSizeBytes(50 * 1024 * 1024);

        assertThat(config.getMaxFileSizeBytes()).isEqualTo(50 * 1024 * 1024);
    }

    @Test
    void setMaxRows_updatesValue() {
        ImportLimitsConfig config = new ImportLimitsConfig();
        config.setMaxRows(50_000);

        assertThat(config.getMaxRows()).isEqualTo(50_000);
    }

    @Test
    void setMaxColumns_updatesValue() {
        ImportLimitsConfig config = new ImportLimitsConfig();
        config.setMaxColumns(2_000);

        assertThat(config.getMaxColumns()).isEqualTo(2_000);
    }

    @Test
    void setMaxCells_updatesValue() {
        ImportLimitsConfig config = new ImportLimitsConfig();
        config.setMaxCells(50_000_000L);

        assertThat(config.getMaxCells()).isEqualTo(50_000_000L);
    }
}
