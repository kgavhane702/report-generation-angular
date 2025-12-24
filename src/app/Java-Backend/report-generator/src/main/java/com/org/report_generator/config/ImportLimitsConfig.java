package com.org.report_generator.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration for import file size and dimension limits.
 */
@Configuration
@ConfigurationProperties(prefix = "import.limits")
public class ImportLimitsConfig {
    
    /**
     * Maximum file size in bytes (default: 10MB)
     */
    private long maxFileSizeBytes = 10 * 1024 * 1024;
    
    /**
     * Maximum number of rows allowed (default: 10,000)
     */
    private int maxRows = 10_000;
    
    /**
     * Maximum number of columns allowed (default: 1,000)
     */
    private int maxColumns = 1_000;
    
    /**
     * Maximum number of cells (rows * columns) allowed (default: 10,000,000)
     */
    private long maxCells = 10_000_000L;

    public long getMaxFileSizeBytes() {
        return maxFileSizeBytes;
    }

    public void setMaxFileSizeBytes(long maxFileSizeBytes) {
        this.maxFileSizeBytes = maxFileSizeBytes;
    }

    public int getMaxRows() {
        return maxRows;
    }

    public void setMaxRows(int maxRows) {
        this.maxRows = maxRows;
    }

    public int getMaxColumns() {
        return maxColumns;
    }

    public void setMaxColumns(int maxColumns) {
        this.maxColumns = maxColumns;
    }

    public long getMaxCells() {
        return maxCells;
    }

    public void setMaxCells(long maxCells) {
        this.maxCells = maxCells;
    }
}

