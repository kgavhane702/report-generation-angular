package com.org.report_generator.render.docx.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.org.report_generator.model.document.Widget;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.xmlbeans.XmlCursor;
import org.apache.xmlbeans.XmlObject;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTPicture;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTR;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

/**
 * Service to generate native Word shapes using VML (Vector Markup Language).
 * VML is the fallback format that Word uses for shapes and is well-supported.
 */
@Service
public class DocxObjectGenerationService {

    /**
     * Maps frontend shape type names to VML shape types.
     */
    private static final Map<String, VmlShapeInfo> SHAPE_TO_VML = Map.ofEntries(
        // Basic shapes
        Map.entry("rectangle", new VmlShapeInfo("rect", null, null)),
        Map.entry("square", new VmlShapeInfo("rect", null, null)),
        Map.entry("rounded-rectangle", new VmlShapeInfo("roundrect", null, null)),
        Map.entry("circle", new VmlShapeInfo("oval", null, null)),
        Map.entry("ellipse", new VmlShapeInfo("oval", null, null)),
        Map.entry("triangle", new VmlShapeInfo("shape", "5", "m10800,l,21600r21600,xe")),
        Map.entry("diamond", new VmlShapeInfo("shape", "4", "m10800,l,10800,10800,21600,21600,10800xe")),
        Map.entry("pentagon", new VmlShapeInfo("shape", "56", "m10800,l,8259,4122,21600r13556,l21600,8259xe")),
        Map.entry("hexagon", new VmlShapeInfo("shape", "9", "m5400,l,10800,5400,21600r10800,l21600,10800,16200,xe")),
        Map.entry("octagon", new VmlShapeInfo("shape", "10", "m6326,l,6326,,15274,6326,21600r9348,l21600,15274,21600,6326,15674,xe")),
        Map.entry("parallelogram", new VmlShapeInfo("shape", "7", "m5400,l21600,r-5400,21600l,21600xe")),
        Map.entry("trapezoid", new VmlShapeInfo("shape", "8", "m4320,l17280,r4320,21600l,21600xe")),
        
        // Arrows
        Map.entry("arrow-right", new VmlShapeInfo("shape", "13", "m,5400l14400,5400,14400,,21600,10800,14400,21600,14400,16200,,16200xe")),
        Map.entry("arrow-left", new VmlShapeInfo("shape", "66", "m21600,5400l7200,5400,7200,,0,10800,7200,21600,7200,16200,21600,16200xe")),
        Map.entry("arrow-up", new VmlShapeInfo("shape", "68", "m5400,21600l5400,7200,,7200,10800,,21600,7200,16200,7200,16200,21600xe")),
        Map.entry("arrow-down", new VmlShapeInfo("shape", "67", "m5400,l5400,14400,,14400,10800,21600,21600,14400,16200,14400,16200,xe")),
        Map.entry("arrow-double", new VmlShapeInfo("shape", "69", "m,10800l5400,5400,5400,8100,16200,8100,16200,5400,21600,10800,16200,16200,16200,13500,5400,13500,5400,16200xe")),
        
        // Flowchart shapes
        Map.entry("flowchart-process", new VmlShapeInfo("rect", "109", null)),
        Map.entry("flowchart-decision", new VmlShapeInfo("shape", "110", "m10800,l,10800,10800,21600,21600,10800xe")),
        Map.entry("flowchart-data", new VmlShapeInfo("shape", "111", "m4321,l21600,r-4321,21600l,21600xe")),
        Map.entry("flowchart-terminator", new VmlShapeInfo("shape", "116", "m3475,qy,10800,3475,21600l18125,21600qx21600,10800,18125,xe")),
        
        // Callouts  
        Map.entry("callout-rectangle", new VmlShapeInfo("shape", "41", "m,l,15429r8256,l10800,21600,13344,15429,21600,15429,21600,,,xe")),
        Map.entry("callout-rounded", new VmlShapeInfo("shape", "42", "m3590,qy,3590l,12209qx3590,15799l8256,15799,10800,21600,13344,15799,18010,15799qx21600,12209l21600,3590qy18010,l3590,xe")),
        Map.entry("callout-cloud", new VmlShapeInfo("shape", "106", null)),
        
        // Stars
        Map.entry("star-4", new VmlShapeInfo("shape", "187", "m10800,l8151,8151,,10800,8151,13449,10800,21600,13449,13449,21600,10800,13449,8151xe")),
        Map.entry("star-5", new VmlShapeInfo("shape", "12", "m10800,l8259,8259,,8259,6171,12948,4122,21600,10800,16200,17478,21600,15429,12948,21600,8259,13341,8259xe")),
        Map.entry("star-6", new VmlShapeInfo("shape", "188", "m10800,l8134,5400,,5400,5400,10800,,16200,8134,16200,10800,21600,13466,16200,21600,16200,16200,10800,21600,5400,13466,5400xe")),
        Map.entry("star-8", new VmlShapeInfo("shape", "58", null)),
        
        // Other shapes
        Map.entry("banner", new VmlShapeInfo("shape", "53", null)),
        Map.entry("cross", new VmlShapeInfo("shape", "11", "m6480,l6480,6480,,6480,,15120,6480,15120,6480,21600,15120,21600,15120,15120,21600,15120,21600,6480,15120,6480,15120,xe")),
        Map.entry("heart", new VmlShapeInfo("shape", "74", null)),
        Map.entry("lightning", new VmlShapeInfo("shape", "73", null)),
        Map.entry("moon", new VmlShapeInfo("shape", "184", null)),
        Map.entry("cloud", new VmlShapeInfo("shape", "75", null)),
        
        // Lines/connectors
        Map.entry("line", new VmlShapeInfo("line", null, null)),
        Map.entry("line-arrow", new VmlShapeInfo("line", null, null)),
        Map.entry("line-arrow-double", new VmlShapeInfo("line", null, null)),
        Map.entry("elbow-connector", new VmlShapeInfo("polyline", "34", null)),
        Map.entry("elbow-arrow", new VmlShapeInfo("polyline", "34", null)),
        Map.entry("curved-connector", new VmlShapeInfo("curve", "37", null)),
        Map.entry("curved-arrow", new VmlShapeInfo("curve", "37", null)),
        Map.entry("s-connector", new VmlShapeInfo("curve", "38", null)),
        Map.entry("s-arrow", new VmlShapeInfo("curve", "38", null))
    );

    private final HtmlToDocxConverter htmlConverter;

    public DocxObjectGenerationService(HtmlToDocxConverter htmlConverter) {
        this.htmlConverter = htmlConverter;
    }

    /**
     * VML shape information holder.
     */
    private record VmlShapeInfo(String type, String spt, String path) {}

    /**
     * Generates a drawing/shape in the document (legacy method).
     */
    public void generateObject(XWPFDocument doc, JsonNode props) {
        if (doc == null || props == null) return;
    }

    /**
     * Generates a native VML shape with text inside.
     */
    public boolean generateShapeWithText(XWPFDocument doc, Widget widget) {
        if (doc == null || widget == null || widget.getProps() == null) return false;

        try {
            JsonNode props = widget.getProps();
            String shapeType = props.path("shapeType").asText("rectangle");
            VmlShapeInfo vmlInfo = SHAPE_TO_VML.getOrDefault(shapeType, 
                new VmlShapeInfo("rect", null, null));

            // Get dimensions in points (1 px ≈ 0.75 pt at 96 DPI)
            double widthPt = widget.getSize().getWidth() * 0.75;
            double heightPt = widget.getSize().getHeight() * 0.75;
            double xPt = widget.getPosition().getX() * 0.75;
            double yPt = widget.getPosition().getY() * 0.75;

            // Get colors (default fill is transparent to match UI)
            String rawFillColor = props.path("fillColor").asText(null);
            String fillColor = normalizeToHex(rawFillColor);

            String strokeColor = "#000000";
            int strokeWidthPx = 0;

            if (props.has("stroke")) {
                JsonNode stroke = props.get("stroke");
                String rawStrokeColor = stroke.path("color").asText("#000000");
                strokeColor = normalizeToHex(rawStrokeColor);
                strokeWidthPx = stroke.path("width").asInt(0);
            }

            // Get text content
            String contentHtml = props.path("contentHtml").asText("");
            String plainText = extractPlainText(contentHtml);
            String textAlign = props.path("textAlign").asText("center");
            String verticalAlign = props.path("verticalAlign").asText("middle");

            // Determine if line shape (no fill)
            boolean isLine = shapeType.contains("line") || shapeType.contains("connector");

            // Create paragraph and run
            XWPFParagraph paragraph = doc.createParagraph();
            XWPFRun run = paragraph.createRun();
            CTR ctr = run.getCTR();

            // Build the complete w:pict XML 
            String pictXml = buildPictXml(
                shapeType, vmlInfo,
                xPt, yPt, widthPt, heightPt,
                fillColor, strokeColor, strokeWidthPx,
                plainText, textAlign, verticalAlign,
                isLine
            );

            // Parse VML shape and add to CTR
            System.out.println("Generated VML XML: " + pictXml);
            
            XmlObject rootObj = XmlObject.Factory.parse(pictXml);
            XmlCursor rootCursor = rootObj.newCursor();
            
            // Navigate: start -> <root> -> v:shape/v:rect/etc
            if (!rootCursor.toFirstChild()) {
                System.err.println("Failed to navigate to root element");
                rootCursor.dispose();
                return false;
            }
            if (!rootCursor.toFirstChild()) {
                System.err.println("Failed to navigate to VML element inside root");
                rootCursor.dispose();
                return false;
            }
            
            // Get the VML shape element
            XmlObject vmlElement = rootCursor.getObject();
            System.out.println("VML element type: " + vmlElement.schemaType());
            rootCursor.dispose();
            
            // Create w:pict and copy VML shape into it
            CTPicture ctPict = ctr.addNewPict();
            XmlCursor destCursor = ctPict.newCursor();
            destCursor.toEndToken();
            
            XmlCursor srcCursor = vmlElement.newCursor();
            srcCursor.copyXml(destCursor);
            
            srcCursor.dispose();
            destCursor.dispose();
            
            System.out.println("Successfully inserted VML shape for: " + shapeType);

            return true;
        } catch (Exception e) {
            System.err.println("VML shape generation failed for: " + 
                widget.getProps().path("shapeType").asText("unknown") + " - " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }

    /**
     * Builds complete w:pict XML with VML shape inside.
     */
    private String buildPictXml(
            String shapeType, VmlShapeInfo vmlInfo,
            double xPt, double yPt, double widthPt, double heightPt,
            String fillColor, String strokeColor, int strokeWidthPx,
            String plainText, String textAlign, String verticalAlign,
            boolean isLine) {

        String shapeId = "_x0000_s" + (1000 + Math.abs(UUID.randomUUID().hashCode() % 9000));
        
        // VML vertical text anchor
        String vTextAnchor = verticalAlign.equals("middle") ? "middle" : 
                            (verticalAlign.equals("bottom") ? "bottom" : "top");
        
        String style = String.format(
            "position:absolute;margin-left:%.1fpt;margin-top:%.1fpt;width:%.1fpt;height:%.1fpt;z-index:251659264;visibility:visible;mso-wrap-style:square;v-text-anchor:%s",
            xPt, yPt, widthPt, heightPt, vTextAnchor
        );

        // Build fill and stroke attributes
        String fillAttr;
        if (isLine || fillColor == null || fillColor.isBlank()) {
            fillAttr = " filled=\"f\"";
        } else {
            fillAttr = String.format(" fillcolor=\"%s\"", fillColor);
        }
        String strokeAttr;
        if (strokeWidthPx > 0 && strokeColor != null) {
            strokeAttr = String.format(" strokecolor=\"%s\" strokeweight=\"%.1fpt\"", strokeColor, (double)strokeWidthPx);
        } else if (isLine) {
            strokeAttr = String.format(" strokecolor=\"%s\" strokeweight=\"1pt\"", strokeColor != null ? strokeColor : "#000000");
        } else {
            strokeAttr = " stroked=\"f\"";
        }

        // Build the textbox content
        String textboxXml = "";
        if (!isLine && plainText != null) {
            textboxXml = String.format(
                "<v:textbox style=\"mso-fit-shape-to-text:false\">" +
                    "<w:txbxContent xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">" +
                        "<w:p><w:pPr><w:jc w:val=\"%s\"/></w:pPr><w:r><w:t>%s</w:t></w:r></w:p>" +
                    "</w:txbxContent>" +
                "</v:textbox>",
                textAlign, escapeXml(plainText)
            );
        }

        // Build the VML shape element based on type
        String vmlShape;
        
        if ("rect".equals(vmlInfo.type())) {
            vmlShape = String.format(
                "<v:rect id=\"%s\" style=\"%s\"%s%s>%s</v:rect>",
                shapeId, style, fillAttr, strokeAttr, textboxXml
            );
        } else if ("oval".equals(vmlInfo.type())) {
            vmlShape = String.format(
                "<v:oval id=\"%s\" style=\"%s\"%s%s>%s</v:oval>",
                shapeId, style, fillAttr, strokeAttr, textboxXml
            );
        } else if ("roundrect".equals(vmlInfo.type())) {
            vmlShape = String.format(
                "<v:roundrect id=\"%s\" style=\"%s\" arcsize=\"10923f\"%s%s>%s</v:roundrect>",
                shapeId, style, fillAttr, strokeAttr, textboxXml
            );
        } else if ("line".equals(vmlInfo.type())) {
            // Line from left-center to right-center
            vmlShape = String.format(
                "<v:line id=\"%s\" style=\"%s\" from=\"0pt,%.1fpt\" to=\"%.1fpt,%.1fpt\" strokecolor=\"%s\" strokeweight=\"%.1fpt\"/>",
                shapeId, style, heightPt/2, widthPt, heightPt/2, strokeColor, Math.max(1.0, (double)strokeWidthPx)
            );
        } else {
            // Generic v:shape with path and/or coordsize
            String pathAttr = "";
            String coordsizeAttr = " coordsize=\"21600,21600\"";
            
            if (vmlInfo.path() != null && !vmlInfo.path().isEmpty()) {
                pathAttr = String.format(" path=\"%s\"", vmlInfo.path());
            }
            
            String sptAttr = "";
            if (vmlInfo.spt() != null) {
                sptAttr = String.format(" o:spt=\"%s\"", vmlInfo.spt());
            }
            
            vmlShape = String.format(
                "<v:shape id=\"%s\"%s%s%s style=\"%s\"%s%s>%s</v:shape>",
                shapeId, sptAttr, coordsizeAttr, pathAttr, style, fillAttr, strokeAttr, textboxXml
            );
        }

        // Wrap in root element with proper namespaces (not w:pict since we use addNewPict)
        return String.format(
            "<root xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\" " +
                  "xmlns:v=\"urn:schemas-microsoft-com:vml\" " +
                  "xmlns:o=\"urn:schemas-microsoft-com:office:office\">" +
                "%s" +
            "</root>", vmlShape);
    }

    /**
     * Extract plain text from HTML content.
     */
    private String extractPlainText(String html) {
        if (html == null || html.isBlank()) return "";
        return html.replaceAll("<[^>]+>", "")
                   .replaceAll("&nbsp;", " ")
                   .replaceAll("&amp;", "&")
                   .replaceAll("&lt;", "<")
                   .replaceAll("&gt;", ">")
                   .replaceAll("&quot;", "\"")
                   .trim();
    }

    /**
     * Normalize color to hex format with # for VML.
     * Handles: #RGB, #RRGGBB, rgb(r,g,b), rgba(r,g,b,a)
     */
    private String normalizeToHex(String color) {
        if (color == null || color.isBlank()) return null;
        
        String c = color.trim().toLowerCase();
        
        // Handle hex format
        if (c.startsWith("#")) {
            String hex = c.substring(1);
            if (hex.length() == 3) {
                // Expand shorthand: #RGB -> #RRGGBB
                return "#" + hex.charAt(0) + hex.charAt(0) 
                     + hex.charAt(1) + hex.charAt(1) 
                     + hex.charAt(2) + hex.charAt(2);
            }
            if (hex.length() == 6 || hex.length() == 8) {
                // Return first 6 chars (ignore alpha if 8 chars)
                return "#" + hex.substring(0, 6).toUpperCase();
            }
            return color; // Return as-is if unrecognized
        }
        
        // Handle rgb() and rgba() format
        if (c.startsWith("rgb")) {
            try {
                int start = c.indexOf('(');
                int end = c.indexOf(')');
                if (start >= 0 && end > start) {
                    String inside = c.substring(start + 1, end);
                    String[] parts = inside.split(",");
                    if (parts.length >= 3) {
                        int r = Integer.parseInt(parts[0].trim());
                        int g = Integer.parseInt(parts[1].trim());
                        int b = Integer.parseInt(parts[2].trim());
                        if (parts.length >= 4) {
                            try {
                                double a = Double.parseDouble(parts[3].trim());
                                if (a <= 0) return null;
                            } catch (NumberFormatException ignored) {
                            }
                        }
                        // Clamp values to 0-255
                        r = Math.max(0, Math.min(255, r));
                        g = Math.max(0, Math.min(255, g));
                        b = Math.max(0, Math.min(255, b));
                        return String.format("#%02X%02X%02X", r, g, b);
                    }
                }
            } catch (Exception e) {
                System.err.println("Failed to parse rgb color: " + color);
            }
        }
        
        // Handle named colors
        return switch (c) {
            case "black" -> "#000000";
            case "white" -> "#FFFFFF";
            case "red" -> "#FF0000";
            case "green" -> "#00FF00";
            case "blue" -> "#0000FF";
            case "yellow" -> "#FFFF00";
            case "cyan" -> "#00FFFF";
            case "magenta" -> "#FF00FF";
            case "gray", "grey" -> "#808080";
            case "transparent" -> null; // VML doesn't support transparency; treat as no fill
            default -> {
                // If no # prefix, try adding one
                if (c.matches("[0-9a-f]{6}")) {
                    yield "#" + c.toUpperCase();
                }
                yield null;
            }
        };
    }

    /**
     * Escape XML special characters.
     */
    private String escapeXml(String text) {
        if (text == null) return "";
        return text.replace("&", "&amp;")
                   .replace("<", "&lt;")
                   .replace(">", "&gt;")
                   .replace("\"", "&quot;")
                   .replace("'", "&apos;");
    }

    /**
     * Check if a shape type has a native VML shape.
     */
    public boolean hasNativePreset(String shapeType) {
        return SHAPE_TO_VML.containsKey(shapeType);
    }

    /**
     * Get the VML type for a shape.
     */
    public String getPresetGeometry(String shapeType) {
        VmlShapeInfo info = SHAPE_TO_VML.get(shapeType);
        return info != null ? info.type() : "rect";
    }
}
