package com.org.report_generator.importing.model;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TabularMergeTest {

    @Test
    void shouldCreateMergeWithRowAndColSpan() {
        TabularMerge merge = new TabularMerge(3, 4);
        
        assertThat(merge.rowSpan()).isEqualTo(3);
        assertThat(merge.colSpan()).isEqualTo(4);
    }

    @Test
    void shouldCreateSingleCellMerge() {
        TabularMerge merge = new TabularMerge(1, 1);
        
        assertThat(merge.rowSpan()).isEqualTo(1);
        assertThat(merge.colSpan()).isEqualTo(1);
    }

    @Test
    void shouldSupportEquality() {
        TabularMerge merge1 = new TabularMerge(2, 3);
        TabularMerge merge2 = new TabularMerge(2, 3);
        TabularMerge merge3 = new TabularMerge(1, 1);
        
        assertThat(merge1).isEqualTo(merge2);
        assertThat(merge1).isNotEqualTo(merge3);
    }

    @Test
    void shouldSupportHashCode() {
        TabularMerge merge1 = new TabularMerge(2, 3);
        TabularMerge merge2 = new TabularMerge(2, 3);
        
        assertThat(merge1.hashCode()).isEqualTo(merge2.hashCode());
    }
}
