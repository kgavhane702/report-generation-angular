package com.org.report_generator.importing.factory;

import com.org.report_generator.importing.enums.ImportFormat;
import com.org.report_generator.importing.parser.TabularParser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TabularParserFactoryTest {

    @Mock
    private TabularParser xlsxParser;

    @Mock
    private TabularParser csvParser;

    @Mock
    private TabularParser jsonParser;

    private TabularParserFactory factory;

    @BeforeEach
    void setUp() {
        when(xlsxParser.format()).thenReturn(ImportFormat.XLSX);
        when(csvParser.format()).thenReturn(ImportFormat.CSV);
        when(jsonParser.format()).thenReturn(ImportFormat.JSON);
        
        factory = new TabularParserFactory(List.of(xlsxParser, csvParser, jsonParser));
    }

    @Test
    void get_withXlsxFormat_returnsXlsxParser() {
        TabularParser result = factory.get(ImportFormat.XLSX);
        
        assertThat(result).isEqualTo(xlsxParser);
    }

    @Test
    void get_withCsvFormat_returnsCsvParser() {
        TabularParser result = factory.get(ImportFormat.CSV);
        
        assertThat(result).isEqualTo(csvParser);
    }

    @Test
    void get_withJsonFormat_returnsJsonParser() {
        TabularParser result = factory.get(ImportFormat.JSON);
        
        assertThat(result).isEqualTo(jsonParser);
    }

    @Test
    void get_withNullFormat_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> factory.get(null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Import format is required");
    }

    @Test
    void get_withUnsupportedFormat_throwsIllegalArgumentException() {
        TabularParserFactory emptyFactory = new TabularParserFactory(List.of());
        
        assertThatThrownBy(() -> emptyFactory.get(ImportFormat.XLSX))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Unsupported import format");
    }

    @Test
    void constructor_withDuplicateParsers_usesLatest() {
        when(xlsxParser.format()).thenReturn(ImportFormat.XLSX);
        TabularParser anotherXlsxParser = org.mockito.Mockito.mock(TabularParser.class);
        when(anotherXlsxParser.format()).thenReturn(ImportFormat.XLSX);
        
        TabularParserFactory factoryWithDuplicates = new TabularParserFactory(
            List.of(xlsxParser, anotherXlsxParser)
        );
        
        TabularParser result = factoryWithDuplicates.get(ImportFormat.XLSX);
        assertThat(result).isEqualTo(anotherXlsxParser);
    }
}
