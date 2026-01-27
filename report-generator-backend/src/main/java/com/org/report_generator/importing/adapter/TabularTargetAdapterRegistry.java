package com.org.report_generator.importing.adapter;

import com.org.report_generator.importing.enums.ImportTarget;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Registry of {@link TabularTargetAdapter} implementations.
 */
@Component
public class TabularTargetAdapterRegistry {

    private final Map<ImportTarget, TabularTargetAdapter<?>> adaptersByTarget;

    public TabularTargetAdapterRegistry(List<TabularTargetAdapter<?>> adapters) {
        Map<ImportTarget, TabularTargetAdapter<?>> map = new EnumMap<>(ImportTarget.class);
        for (TabularTargetAdapter<?> adapter : adapters) {
            map.put(adapter.target(), adapter);
        }
        this.adaptersByTarget = Map.copyOf(map);
    }

    public <T> TabularTargetAdapter<T> get(ImportTarget target, Class<T> outputType) {
        if (target == null) {
            throw new IllegalArgumentException("Import target is required");
        }
        if (outputType == null) {
            throw new IllegalArgumentException("Output type is required");
        }
        TabularTargetAdapter<?> adapter = adaptersByTarget.get(target);
        if (adapter == null) {
            throw new IllegalArgumentException("Unsupported import target: " + target);
        }
        if (!outputType.equals(adapter.outputType())) {
            throw new IllegalArgumentException(
                    "Adapter output type mismatch for target " + target + ": expected " + outputType.getName()
                            + " but got " + adapter.outputType().getName()
            );
        }
        @SuppressWarnings("unchecked")
        TabularTargetAdapter<T> typed = (TabularTargetAdapter<T>) adapter;
        return typed;
    }
}


