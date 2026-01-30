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

class XmlTabularParserTest {

    @Test
    void xmlCoordinateGrid_withMergedHeaderNullPlaceholders_infersHeaderMerges_andSkipsUnsafeMergedCells() throws Exception {
        String xml = """
                <table>
                  <rows>
                    <row>
                      <cell row="1" col="1" value="Employee ID"/>
                      <cell row="1" col="2" value="Personal Info"/>
                      <cell row="1" col="3"></cell>
                      <cell row="1" col="4" value="Performance"/>
                      <cell row="1" col="5"></cell>
                      <cell row="1" col="6"></cell>
                      <cell row="1" col="7" value="Attendance"/>
                      <cell row="1" col="8"></cell>
                    </row>
                    <row>
                      <cell row="2" col="1"></cell>
                      <cell row="2" col="2" value="Name"/>
                      <cell row="2" col="3" value="Department"/>
                      <cell row="2" col="4" value="Q1"/>
                      <cell row="2" col="5" value="Q2"/>
                      <cell row="2" col="6" value="Q3"/>
                      <cell row="2" col="7" value="Present Days"/>
                      <cell row="2" col="8" value="Absent Days"/>
                    </row>
                    <row>
                      <cell row="3" col="1" value="1001"/>
                      <cell row="3" col="2" value="Amit"/>
                      <cell row="3" col="3" value="IT"/>
                      <cell row="3" col="4" value="78"/>
                      <cell row="3" col="5" value="82"/>
                      <cell row="3" col="6" value="80"/>
                      <cell row="3" col="7" value="220"/>
                      <cell row="3" col="8" value="10"/>
                    </row>
                  </rows>
                  <mergedCells>
                    <mergedCell startRow="2" startCol="1" rowSpan="2" colSpan="1"/>
                    <mergedCell startRow="4" startCol="1" rowSpan="3" colSpan="1"/>
                    <mergedCell startRow="7" startCol="1" rowSpan="2" colSpan="1"/>
                    <mergedCell startRow="1" startCol="1" rowSpan="1" colSpan="2"/>
                  </mergedCells>
                </table>
                """;

        ObjectMapper om = new ObjectMapper();
        ImportLimitsConfig limits = new ImportLimitsConfig();
        JsonTabularParser json = new JsonTabularParser(om, limits);
        XmlTabularParser xmlParser = new XmlTabularParser(om, json);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "sample.xml",
                "application/xml",
                xml.getBytes(StandardCharsets.UTF_8)
        );

        TabularDataset ds = xmlParser.parse(file, new ImportOptions(null, null));

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

        TabularCell dataId = ds.rows().get(2).cells().get(0);
        assertThat(dataId.contentHtml()).contains("1001");
    }

    @Test
    void genericXml_withoutRowsElement_importsAsTableWithHeaderRow() throws Exception {
        String xml = """
                <employees>
                  <employee id="1001">
                    <name>Amit</name>
                    <department>IT</department>
                    <performance>
                      <q1>78</q1>
                      <q2>82</q2>
                    </performance>
                  </employee>
                  <employee id="1002">
                    <name>Rohit</name>
                    <department>HR</department>
                    <performance>
                      <q1>70</q1>
                      <q2>75</q2>
                    </performance>
                  </employee>
                </employees>
                """;

        ObjectMapper om = new ObjectMapper();
        ImportLimitsConfig limits = new ImportLimitsConfig();
        JsonTabularParser json = new JsonTabularParser(om, limits);
        XmlTabularParser xmlParser = new XmlTabularParser(om, json);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "employees.xml",
                "application/xml",
                xml.getBytes(StandardCharsets.UTF_8)
        );

        TabularDataset ds = xmlParser.parse(file, new ImportOptions(null, null));

        // JsonTabularParser produces hierarchical headers: 2 header rows + 2 data rows
        assertThat(ds.rows()).hasSize(4);
        assertThat(ds.rows().get(0).cells()).isNotEmpty();

        // First header row contains parent headers (performance spans q1, q2)
        String headerRow0 = ds.rows().get(0).cells().stream().map(TabularCell::contentHtml).reduce("", String::concat);
        assertThat(headerRow0).contains("name");
        assertThat(headerRow0).contains("@id");
        assertThat(headerRow0).contains("department");
        assertThat(headerRow0).contains("performance");

        // Second header row contains sub-headers (q1, q2 under performance)
        String headerRow1 = ds.rows().get(1).cells().stream().map(TabularCell::contentHtml).reduce("", String::concat);
        assertThat(headerRow1).contains("q1");
        assertThat(headerRow1).contains("q2");

        String row1 = ds.rows().get(2).cells().stream().map(TabularCell::contentHtml).reduce("", String::concat);
        assertThat(row1).contains("Amit");
        assertThat(row1).contains("1001");
        assertThat(row1).contains("IT");

        String row2 = ds.rows().get(3).cells().stream().map(TabularCell::contentHtml).reduce("", String::concat);
        assertThat(row2).contains("Rohit");
        assertThat(row2).contains("1002");
        assertThat(row2).contains("HR");
    }

    @Test
    void spreadsheetLikeRowCellXml_importsAsCoordinateGrid_andInfersHeaderMerges() throws Exception {
        String xml = """
                <?xml version='1.0' encoding='utf-8'?>
                <Workbook>
                  <Sheet name="EmployeeReport">
                    <Row index="1">
                      <Cell col="1">Employee ID</Cell>
                      <Cell col="2">Personal Info</Cell>
                      <Cell col="3" />
                      <Cell col="4">Performance</Cell>
                      <Cell col="5" />
                      <Cell col="6" />
                      <Cell col="7">Attendance</Cell>
                      <Cell col="8" />
                    </Row>
                    <Row index="2">
                      <Cell col="1" />
                      <Cell col="2">Name</Cell>
                      <Cell col="3">Department</Cell>
                      <Cell col="4">Q1</Cell>
                      <Cell col="5">Q2</Cell>
                      <Cell col="6">Q3</Cell>
                      <Cell col="7">Present Days</Cell>
                      <Cell col="8">Absent Days</Cell>
                    </Row>
                    <Row index="3">
                      <Cell col="1">1001</Cell>
                      <Cell col="2">Amit</Cell>
                      <Cell col="3">IT</Cell>
                      <Cell col="4">78</Cell>
                      <Cell col="5">82</Cell>
                      <Cell col="6">80</Cell>
                      <Cell col="7">220</Cell>
                      <Cell col="8">10</Cell>
                    </Row>
                  </Sheet>
                </Workbook>
                """;

        ObjectMapper om = new ObjectMapper();
        ImportLimitsConfig limits = new ImportLimitsConfig();
        JsonTabularParser json = new JsonTabularParser(om, limits);
        XmlTabularParser xmlParser = new XmlTabularParser(om, json);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "employee_report.xml",
                "application/xml",
                xml.getBytes(StandardCharsets.UTF_8)
        );

        TabularDataset ds = xmlParser.parse(file, new ImportOptions(null, null));

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
    }

    @Test
    void chartLikeXml_categoriesAndSeries_isParsedAsCategoryPlusSeriesColumns() throws Exception {
        String xml = """
                <chart>
                  <categories>
                    <category>Jan</category>
                    <category>Feb</category>
                    <category>Mar</category>
                  </categories>
                  <series>
                    <item>
                      <name>Product A</name>
                      <stack>total</stack>
                      <data>
                        <v>120</v>
                        <v>150</v>
                        <v>180</v>
                      </data>
                    </item>
                    <item>
                      <name>Product B</name>
                      <stack>total</stack>
                      <data>
                        <v>80</v>
                        <v>90</v>
                        <v>110</v>
                      </data>
                    </item>
                  </series>
                </chart>
                """;

        ObjectMapper om = new ObjectMapper();
        ImportLimitsConfig limits = new ImportLimitsConfig();
        JsonTabularParser json = new JsonTabularParser(om, limits);
        XmlTabularParser xmlParser = new XmlTabularParser(om, json);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "stacked-bar-multiple-data.xml",
                "application/xml",
                xml.getBytes(StandardCharsets.UTF_8)
        );

        TabularDataset ds = xmlParser.parse(file, new ImportOptions(null, null));

        // Header + 3 category rows; 1 category column + 2 series columns.
        assertThat(ds.rows()).hasSize(4);
        assertThat(ds.rows().get(0).cells()).hasSize(3);

        String h0 = ds.rows().get(0).cells().get(0).contentHtml();
        String h1 = ds.rows().get(0).cells().get(1).contentHtml();
        String h2 = ds.rows().get(0).cells().get(2).contentHtml();
        assertThat(h0).contains("Category");
        assertThat(h1).contains("Product A");
        assertThat(h2).contains("Product B");

        TabularCell jan = ds.rows().get(1).cells().get(0);
        TabularCell janA = ds.rows().get(1).cells().get(1);
        TabularCell janB = ds.rows().get(1).cells().get(2);
        assertThat(jan.contentHtml()).contains("Jan");
        assertThat(janA.contentHtml()).contains("120");
        assertThat(janB.contentHtml()).contains("80");
    }

    @Test
    void genericXml_withAttributesAndText_isFlattened() throws Exception {
        String xml = """
                <books>
                  <book id="b1">
                    <title>Clean Code</title>
                    <author>Robert C. Martin</author>
                  </book>
                  <book id="b2">
                    <title>Effective Java</title>
                    <author>Joshua Bloch</author>
                  </book>
                </books>
                """;

        ObjectMapper om = new ObjectMapper();
        ImportLimitsConfig limits = new ImportLimitsConfig();
        JsonTabularParser json = new JsonTabularParser(om, limits);
        XmlTabularParser xmlParser = new XmlTabularParser(om, json);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "books.xml",
                "application/xml",
                xml.getBytes(StandardCharsets.UTF_8)
        );

        TabularDataset ds = xmlParser.parse(file, new ImportOptions(null, null));

        assertThat(ds.rows()).hasSize(3);
        String headerRow = ds.rows().get(0).cells().stream().map(TabularCell::contentHtml).reduce("", String::concat);
        assertThat(headerRow).contains("@id");
        assertThat(headerRow).contains("title");
        assertThat(headerRow).contains("author");

        String row1 = ds.rows().get(1).cells().stream().map(TabularCell::contentHtml).reduce("", String::concat);
        assertThat(row1).contains("Clean Code");
        assertThat(row1).contains("b1");
    }

    @Test
    void invalidXml_throwsHelpfulError() {
        String xml = "<root><row></root>";

        ObjectMapper om = new ObjectMapper();
        ImportLimitsConfig limits = new ImportLimitsConfig();
        JsonTabularParser json = new JsonTabularParser(om, limits);
        XmlTabularParser xmlParser = new XmlTabularParser(om, json);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "bad.xml",
                "application/xml",
                xml.getBytes(StandardCharsets.UTF_8)
        );

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                xmlParser.parse(file, new ImportOptions(null, null)));
        assertThat(ex.getMessage()).contains("Invalid XML");
    }
}


