package com.org.report_generator.render.docx;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.org.report_generator.model.document.Widget;
import com.org.report_generator.model.document.WidgetPosition;
import com.org.report_generator.model.document.WidgetSize;
import com.org.report_generator.render.docx.service.DocxDrawingUtil;
import org.apache.poi.openxml4j.opc.OPCPackage;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

class DocxDrawingUtilShapeSmokeTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Test
    void createsValidDocxWithAnchoredShape() {
        assertDoesNotThrow(() -> {
            try (XWPFDocument doc = new XWPFDocument()) {
                Widget widget = new Widget();
                widget.setId("w1");
                widget.setType("object");
                widget.setPosition(new WidgetPosition(48d, 72d));
                widget.setSize(new WidgetSize(240d, 120d));

                ObjectNode props = MAPPER.createObjectNode();
                props.put("shapeType", "rounded-rectangle");
                props.put("contentHtml", "Hello & <b>World</b>");
                props.put("fillColor", "#FFEEAA");
                props.put("textAlign", "center");
                props.put("verticalAlign", "middle");
                props.put("padding", 8);
                ObjectNode stroke = props.putObject("stroke");
                stroke.put("color", "#333333");
                stroke.put("width", 2);
                widget.setProps(props);

                DocxDrawingUtil.createShapeWithText(
                        doc,
                        widget,
                        props.path("shapeType").asText(),
                        props.path("contentHtml").asText(),
                        props.path("fillColor").asText(),
                        stroke.path("color").asText(),
                        stroke.path("width").asInt(),
                        props.path("textAlign").asText(),
                        props.path("verticalAlign").asText(),
                        props.path("padding").asInt()
                );

                byte[] bytes;
                try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                    doc.write(out);
                    bytes = out.toByteArray();
                }

                // Re-open via OPC/POI to ensure the package is well-formed.
                try (OPCPackage pkg = OPCPackage.open(new ByteArrayInputStream(bytes));
                     XWPFDocument reopened = new XWPFDocument(pkg)) {
                    // no-op: construction should succeed
                }
            }
        });
    }
}
