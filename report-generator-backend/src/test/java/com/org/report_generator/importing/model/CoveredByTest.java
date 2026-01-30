package com.org.report_generator.importing.model;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CoveredByTest {

    @Test
    void shouldCreateCoveredByWithRowAndCol() {
        CoveredBy coveredBy = new CoveredBy(5, 10);
        
        assertThat(coveredBy.row()).isEqualTo(5);
        assertThat(coveredBy.col()).isEqualTo(10);
    }

    @Test
    void shouldCreateCoveredByWithZeroIndices() {
        CoveredBy coveredBy = new CoveredBy(0, 0);
        
        assertThat(coveredBy.row()).isEqualTo(0);
        assertThat(coveredBy.col()).isEqualTo(0);
    }

    @Test
    void shouldSupportEquality() {
        CoveredBy cb1 = new CoveredBy(1, 2);
        CoveredBy cb2 = new CoveredBy(1, 2);
        CoveredBy cb3 = new CoveredBy(3, 4);
        
        assertThat(cb1).isEqualTo(cb2);
        assertThat(cb1).isNotEqualTo(cb3);
    }

    @Test
    void shouldSupportHashCode() {
        CoveredBy cb1 = new CoveredBy(1, 2);
        CoveredBy cb2 = new CoveredBy(1, 2);
        
        assertThat(cb1.hashCode()).isEqualTo(cb2.hashCode());
    }
}
