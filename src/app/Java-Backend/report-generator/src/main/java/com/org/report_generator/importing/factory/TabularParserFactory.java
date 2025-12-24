package com.org.report_generator.importing.factory;

import com.org.report_generator.importing.enums.ImportFormat;
import com.org.report_generator.importing.parser.TabularParser;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Factory/Registry that selects the correct {@link TabularParser} based on {@link ImportFormat}.
 */
@Component
public class TabularParserFactory {

    private final Map<ImportFormat, TabularParser> parsersByFormat;

    public TabularParserFactory(List<TabularParser> parsers) {
        Map<ImportFormat, TabularParser> map = new EnumMap<>(ImportFormat.class);
        for (TabularParser parser : parsers) {
            map.put(parser.format(), parser);
        }
        this.parsersByFormat = Map.copyOf(map);
    }

    public TabularParser get(ImportFormat format) {
        if (format == null) {
            throw new IllegalArgumentException("Import format is required");
        }
        TabularParser parser = parsersByFormat.get(format);
        if (parser == null) {
            throw new IllegalArgumentException("Unsupported import format: " + format);
        }
        return parser;
    }
}


