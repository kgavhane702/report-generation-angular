package com.org.report_generator.importing.parser.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.org.report_generator.config.ImportLimitsConfig;
import com.org.report_generator.importing.model.ImportOptions;
import com.org.report_generator.importing.model.TabularCell;
import com.org.report_generator.importing.model.TabularDataset;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class JsonTabularParserTest {

    @Test
    void coordinateGrid_withMergedHeaderNullPlaceholders_infersHeaderMerges_andSkipsUnsafeMergedCells() throws Exception {
        String json = """
                {
                  "rows": [
                    [
                      {"row":1,"col":1,"key":"Employee ID","value":"Employee ID"},
                      {"row":1,"col":2,"key":"Personal Info","value":"Personal Info"},
                      {"row":1,"col":3,"key":"column_3","value":null},
                      {"row":1,"col":4,"key":"Performance","value":"Performance"},
                      {"row":1,"col":5,"key":"column_5","value":null},
                      {"row":1,"col":6,"key":"column_6","value":null},
                      {"row":1,"col":7,"key":"Attendance","value":"Attendance"},
                      {"row":1,"col":8,"key":"column_8","value":null}
                    ],
                    [
                      {"row":2,"col":1,"key":"Employee ID","value":null},
                      {"row":2,"col":2,"key":"Personal Info","value":"Name"},
                      {"row":2,"col":3,"key":"column_3","value":"Department"},
                      {"row":2,"col":4,"key":"Performance","value":"Q1"},
                      {"row":2,"col":5,"key":"column_5","value":"Q2"},
                      {"row":2,"col":6,"key":"column_6","value":"Q3"},
                      {"row":2,"col":7,"key":"Attendance","value":"Present Days"},
                      {"row":2,"col":8,"key":"column_8","value":"Absent Days"}
                    ],
                    [
                      {"row":3,"col":1,"key":"Employee ID","value":1001},
                      {"row":3,"col":2,"key":"Personal Info","value":"Amit"},
                      {"row":3,"col":3,"key":"column_3","value":"IT"},
                      {"row":3,"col":4,"key":"Performance","value":78},
                      {"row":3,"col":5,"key":"column_5","value":82},
                      {"row":3,"col":6,"key":"column_6","value":80},
                      {"row":3,"col":7,"key":"Attendance","value":220},
                      {"row":3,"col":8,"key":"column_8","value":10}
                    ]
                  ],
                  "mergedCells": [
                    {"startRow":2,"startCol":1,"rowSpan":2,"colSpan":1},
                    {"startRow":4,"startCol":1,"rowSpan":3,"colSpan":1},
                    {"startRow":7,"startCol":1,"rowSpan":2,"colSpan":1},
                    {"startRow":1,"startCol":1,"rowSpan":1,"colSpan":2}
                  ]
                }
                """;

        JsonTabularParser parser = new JsonTabularParser(new ObjectMapper(), new ImportLimitsConfig());
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "sample.json",
                "application/json",
                json.getBytes(StandardCharsets.UTF_8)
        );

        TabularDataset ds = parser.parse(file, new ImportOptions(null, null));

        assertThat(ds.rows()).hasSize(3);
        assertThat(ds.rows().get(0).cells()).hasSize(8);

        TabularCell c00 = ds.rows().get(0).cells().get(0);
        assertThat(c00.merge()).isNotNull();
        assertThat(c00.merge().rowSpan()).isEqualTo(2);
        assertThat(c00.merge().colSpan()).isEqualTo(1);

        TabularCell c01 = ds.rows().get(0).cells().get(1);
        assertThat(c01.merge()).isNotNull();
        assertThat(c01.merge().rowSpan()).isEqualTo(1);
        assertThat(c01.merge().colSpan()).isEqualTo(2);

        TabularCell c03 = ds.rows().get(0).cells().get(3);
        assertThat(c03.merge()).isNotNull();
        assertThat(c03.merge().rowSpan()).isEqualTo(1);
        assertThat(c03.merge().colSpan()).isEqualTo(3);

        TabularCell c06 = ds.rows().get(0).cells().get(6);
        assertThat(c06.merge()).isNotNull();
        assertThat(c06.merge().rowSpan()).isEqualTo(1);
        assertThat(c06.merge().colSpan()).isEqualTo(2);

        // Ensure explicit unsafe merge (1,1) colspan=2 was NOT applied.
        assertThat(c00.merge().colSpan()).isEqualTo(1);

        // Verify that data is still present where expected (Employee ID 1001 is in the first data row).
        TabularCell dataId = ds.rows().get(2).cells().get(0);
        assertThat(dataId.contentHtml()).contains("1001");
    }
}


