package com.org.report_generator.render.docx.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Service;

@Service
public class DocxObjectGenerationService {

    /**
     * Generates a drawing/shape in the document.
     * @param doc The document
     * @param props The widget properties for the shape
     */
    public void generateObject(XWPFDocument doc, JsonNode props) {
        // TODO: Implement shape generation using POI drawings if possible, or skip/fallback
        // Ideally map SVG shapes to VML/DrawingML
        if (doc == null || props == null) return;
    }
}
