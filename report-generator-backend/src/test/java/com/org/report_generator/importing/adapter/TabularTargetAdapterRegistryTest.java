package com.org.report_generator.importing.adapter;

import com.fasterxml.jackson.databind.JsonNode;
import com.org.report_generator.importing.enums.ImportTarget;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TabularTargetAdapterRegistryTest {

    @Mock
    private TabularTargetAdapter<JsonNode> tableAdapter;

    private TabularTargetAdapterRegistry registry;

    @BeforeEach
    void setUp() {
        when(tableAdapter.target()).thenReturn(ImportTarget.TABLE);
        when(tableAdapter.outputType()).thenReturn(JsonNode.class);
        
        registry = new TabularTargetAdapterRegistry(List.of(tableAdapter));
    }

    @Test
    void get_withValidTargetAndType_returnsAdapter() {
        TabularTargetAdapter<JsonNode> result = registry.get(ImportTarget.TABLE, JsonNode.class);
        
        assertThat(result).isEqualTo(tableAdapter);
    }

    @Test
    void get_withNullTarget_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> registry.get(null, JsonNode.class))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Import target is required");
    }

    @Test
    void get_withNullOutputType_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> registry.get(ImportTarget.TABLE, null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Output type is required");
    }

    @Test
    void get_withUnsupportedTarget_throwsIllegalArgumentException() {
        TabularTargetAdapterRegistry emptyRegistry = new TabularTargetAdapterRegistry(List.of());
        
        assertThatThrownBy(() -> emptyRegistry.get(ImportTarget.TABLE, JsonNode.class))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Unsupported import target");
    }

    @Test
    void get_withMismatchedOutputType_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> registry.get(ImportTarget.TABLE, String.class))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Adapter output type mismatch");
    }
}
