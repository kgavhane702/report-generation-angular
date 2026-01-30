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
import static org.junit.jupiter.api.Assertions.assertThrows;

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

    @Test
    void chartLikeWrapper_withDataArray_unwrapsDataAndParsesAsTable() throws Exception {
        String json = """
                {
                  "chartId": "sales-distribution-pie",
                  "chartType": "pie",
                  "title": "Sales Distribution by Product",
                  "data": [
                    { "label": "Product A", "value": 420 },
                    { "label": "Product B", "value": 310 },
                    { "label": "Product C", "value": 190 },
                    { "label": "Product D", "value": 80 }
                  ]
                }
                """;

        JsonTabularParser parser = new JsonTabularParser(new ObjectMapper(), new ImportLimitsConfig());
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "pie-chart-sample.json",
                "application/json",
                json.getBytes(StandardCharsets.UTF_8)
        );

        TabularDataset ds = parser.parse(file, new ImportOptions(null, null));

        // Header + 4 rows, 2 columns: label/value
        assertThat(ds.rows()).hasSize(5);
        assertThat(ds.rows().get(0).cells()).hasSize(2);
        assertThat(ds.rows().get(0).cells().get(0).contentHtml()).contains("label");
        assertThat(ds.rows().get(0).cells().get(1).contentHtml()).contains("value");

        TabularCell r1c0 = ds.rows().get(1).cells().get(0);
        TabularCell r1c1 = ds.rows().get(1).cells().get(1);
        assertThat(r1c0.contentHtml()).contains("Product A");
        assertThat(r1c1.contentHtml()).contains("420");
    }

    @Test
    void categoriesAndSeriesShape_parsesIntoCategoryPlusSeriesColumns() throws Exception {
        String json = """
                {
                  "categories": ["Jan","Feb","Mar"],
                  "series": [
                    { "name": "Product A", "stack": "total", "data": [120, 150, 180] },
                    { "name": "Product B", "stack": "total", "data": [80, 90, 110] }
                  ]
                }
                """;

        JsonTabularParser parser = new JsonTabularParser(new ObjectMapper(), new ImportLimitsConfig());
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "stacked-bar-multiple-data.json",
                "application/json",
                json.getBytes(StandardCharsets.UTF_8)
        );

        TabularDataset ds = parser.parse(file, new ImportOptions(null, null));

        // Header + 3 category rows; 1 category column + 2 series columns.
        assertThat(ds.rows()).hasSize(4);
        assertThat(ds.rows().get(0).cells()).hasSize(3);
        assertThat(ds.rows().get(0).cells().get(0).contentHtml()).contains("Category");
        assertThat(ds.rows().get(0).cells().get(1).contentHtml()).contains("Product A");
        assertThat(ds.rows().get(0).cells().get(2).contentHtml()).contains("Product B");

        TabularCell jan = ds.rows().get(1).cells().get(0);
        TabularCell janA = ds.rows().get(1).cells().get(1);
        TabularCell janB = ds.rows().get(1).cells().get(2);
        assertThat(jan.contentHtml()).contains("Jan");
        assertThat(janA.contentHtml()).contains("120");
        assertThat(janB.contentHtml()).contains("80");
    }

          @Test
          void arrayOfArrays_trimsEmptyRowsAndCols() throws Exception {
        String json = """
          [
            ["A", "B", ""],
            ["1", "2", ""],
            ["", "", ""]
          ]
          """;

        JsonTabularParser parser = new JsonTabularParser(new ObjectMapper(), new ImportLimitsConfig());
        MockMultipartFile file = new MockMultipartFile(
          "file",
          "grid.json",
          "application/json",
          json.getBytes(StandardCharsets.UTF_8)
        );

        TabularDataset ds = parser.parse(file, new ImportOptions(null, null));

        assertThat(ds.rows()).hasSize(2);
        assertThat(ds.rows().get(0).cells()).hasSize(2);
        assertThat(ds.rows().get(0).cells().get(0).contentHtml()).contains("A");
        assertThat(ds.rows().get(1).cells().get(1).contentHtml()).contains("2");
          }

          @Test
          void arrayOfObjects_withNestedObjects_flattensKeys() throws Exception {
        String json = """
          [
            {
              "name": "Amit",
              "address": { "city": "Pune", "geo": { "lat": 18.52 } }
            },
            {
              "name": "Rohit",
              "address": { "city": "Delhi", "geo": { "lat": 28.61 } }
            }
          ]
          """;

        JsonTabularParser parser = new JsonTabularParser(new ObjectMapper(), new ImportLimitsConfig());
        MockMultipartFile file = new MockMultipartFile(
          "file",
          "nested.json",
          "application/json",
          json.getBytes(StandardCharsets.UTF_8)
        );

        TabularDataset ds = parser.parse(file, new ImportOptions(null, null));

        // Parser creates hierarchical headers for nested objects plus 2 data rows
        assertThat(ds.rows()).hasSize(5);
        
        // Check header contains expected keys (may be in different rows for hierarchical structure)
        String allHeaders = ds.rows().stream()
            .limit(3) // First 3 rows are headers
            .flatMap(r -> r.cells().stream())
            .map(TabularCell::contentHtml)
            .reduce("", String::concat);
        assertThat(allHeaders).contains("name");
        assertThat(allHeaders).contains("address");
        assertThat(allHeaders).contains("city");
        assertThat(allHeaders).contains("lat");

        // Check data rows contain expected values
        String row1 = ds.rows().get(3).cells().stream().map(TabularCell::contentHtml).reduce("", String::concat);
        assertThat(row1).contains("Amit");
        assertThat(row1).contains("Pune");
        assertThat(row1).contains("18.52");
          }

          @Test
          void columnsAndRowsObject_buildsHeaderRow() throws Exception {
        String json = """
          {
            "columns": ["A", "B"],
            "rows": [[1, 2], [3, 4]]
          }
          """;

        JsonTabularParser parser = new JsonTabularParser(new ObjectMapper(), new ImportLimitsConfig());
        MockMultipartFile file = new MockMultipartFile(
          "file",
          "columns-rows.json",
          "application/json",
          json.getBytes(StandardCharsets.UTF_8)
        );

        TabularDataset ds = parser.parse(file, new ImportOptions(null, null));

        assertThat(ds.rows()).hasSize(3);
        assertThat(ds.rows().get(0).cells().get(0).contentHtml()).contains("A");
        assertThat(ds.rows().get(0).cells().get(1).contentHtml()).contains("B");
        assertThat(ds.rows().get(2).cells().get(1).contentHtml()).contains("4");
          }

          @Test
          void apiResponseEnvelope_isUnwrapped() throws Exception {
        String json = """
          {
            "success": true,
            "data": [
              ["A", "B"],
              [1, 2]
            ]
          }
          """;

        JsonTabularParser parser = new JsonTabularParser(new ObjectMapper(), new ImportLimitsConfig());
        MockMultipartFile file = new MockMultipartFile(
          "file",
          "envelope.json",
          "application/json",
          json.getBytes(StandardCharsets.UTF_8)
        );

        TabularDataset ds = parser.parse(file, new ImportOptions(null, null));

        assertThat(ds.rows()).hasSize(2);
        assertThat(ds.rows().get(0).cells().get(0).contentHtml()).contains("A");
        assertThat(ds.rows().get(1).cells().get(1).contentHtml()).contains("2");
          }

          @Test
          void invalidJson_throwsHelpfulError() {
        String json = "{ invalid json";
        JsonTabularParser parser = new JsonTabularParser(new ObjectMapper(), new ImportLimitsConfig());
        MockMultipartFile file = new MockMultipartFile(
          "file",
          "bad.json",
          "application/json",
          json.getBytes(StandardCharsets.UTF_8)
        );

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
          parser.parse(file, new ImportOptions(null, null)));
        assertThat(ex.getMessage()).contains("Invalid JSON");
          }

          @Test
          void emptyFile_throwsError() {
        JsonTabularParser parser = new JsonTabularParser(new ObjectMapper(), new ImportLimitsConfig());
        MockMultipartFile file = new MockMultipartFile(
          "file",
          "empty.json",
          "application/json",
          new byte[0]
        );

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
          parser.parse(file, new ImportOptions(null, null)));
        assertThat(ex.getMessage()).contains("JSON file is required");
          }
}


