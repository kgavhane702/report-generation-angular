package com.org.report_generator.render.docx;

import com.org.report_generator.model.document.Widget;
import com.org.report_generator.model.document.WidgetPosition;
import com.org.report_generator.model.document.WidgetSize;
import com.org.report_generator.render.docx.service.DocxDrawingUtil;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import static org.junit.jupiter.api.Assertions.assertTrue;

public class DocxDrawingUtilAlignmentTest {

    @Test
    void shapeWithText_writesJcCenterWhenRequested() throws Exception {
        XWPFDocument doc = new XWPFDocument();

        Widget widget = new Widget();
        widget.setPosition(new WidgetPosition(10.0, 10.0));
        widget.setSize(new WidgetSize(200.0, 60.0));

        DocxDrawingUtil.createShapeWithText(
                doc,
                widget,
                "rectangle",
                "Hello",
                "#FFFFFF",
                "#000000",
                1,
                "center",
                "middle",
                0,
                "#FF0000",
                12.0
        );

        byte[] bytes;
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            doc.write(out);
            bytes = out.toByteArray();
        }

        String documentXml = readZipEntry(bytes, "word/document.xml");
        assertTrue(documentXml.contains("<w:jc") && documentXml.contains("w:val=\"center\""),
                "Expected document.xml to contain centered paragraph alignment");
    }

    @Test
    void textBox_writesJcRightWhenRequested() throws Exception {
        XWPFDocument doc = new XWPFDocument();

        Widget widget = new Widget();
        widget.setPosition(new WidgetPosition(10.0, 10.0));
        widget.setSize(new WidgetSize(200.0, 60.0));

        DocxDrawingUtil.createTextBox(doc, widget, "Hello", null, "right", "top", 0, "#000000", 12.0);

        byte[] bytes;
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            doc.write(out);
            bytes = out.toByteArray();
        }

        String documentXml = readZipEntry(bytes, "word/document.xml");
        assertTrue(documentXml.contains("<w:jc") && documentXml.contains("w:val=\"right\""),
                "Expected document.xml to contain right paragraph alignment");
    }

    private static String readZipEntry(byte[] zipBytes, String entryName) throws Exception {
        try (ZipInputStream zin = new ZipInputStream(new ByteArrayInputStream(zipBytes))) {
            ZipEntry e;
            while ((e = zin.getNextEntry()) != null) {
                if (entryName.equals(e.getName())) {
                    byte[] buf = zin.readAllBytes();
                    return new String(buf, StandardCharsets.UTF_8);
                }
            }
        }
        throw new IllegalStateException("Entry not found: " + entryName);
    }
}
