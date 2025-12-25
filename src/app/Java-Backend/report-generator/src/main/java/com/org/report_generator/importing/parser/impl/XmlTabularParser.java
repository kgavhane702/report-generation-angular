package com.org.report_generator.importing.parser.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.org.report_generator.importing.enums.ImportFormat;
import com.org.report_generator.importing.model.ImportOptions;
import com.org.report_generator.importing.model.TabularDataset;
import com.org.report_generator.importing.parser.TabularParser;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.InputStream;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

/**
 * XML implementation of {@link TabularParser}.
 *
 * The goal is to support an XML representation of the same table model as JSON:
 * - rows -> row -> cell, with optional row/col coordinates and cell value/contentHtml
 * - optional mergedCells list: mergedCell(startRow,startCol,rowSpan,colSpan)
 *
 * We convert XML -> JsonNode and then delegate to {@link JsonTabularParser} so all merge/coverage/trim logic
 * stays identical between JSON and XML.
 */
@Component
public class XmlTabularParser implements TabularParser {

    private final ObjectMapper objectMapper;
    private final JsonTabularParser jsonParser;

    public XmlTabularParser(ObjectMapper objectMapper, JsonTabularParser jsonParser) {
        this.objectMapper = objectMapper;
        this.jsonParser = jsonParser;
    }

    @Override
    public ImportFormat format() {
        return ImportFormat.XML;
    }

    @Override
    public TabularDataset parse(MultipartFile file, ImportOptions options) throws Exception {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("XML file is required");
        }

        JsonNode node;
        try (InputStream in = file.getInputStream()) {
            node = xmlToJsonNode(in);
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid XML: " + (e.getMessage() == null ? "parse error" : e.getMessage()), e);
        }

        return jsonParser.parseNode(node);
    }

    private JsonNode xmlToJsonNode(InputStream in) throws Exception {
        Document doc = parseSecure(in);
        Element root = doc.getDocumentElement();
        if (root == null) {
            throw new IllegalArgumentException("Invalid XML: empty payload");
        }

        // Two modes:
        // 1) Table-XML mode: XML contains a <rows> element (or root is <rows>) and optional <mergedCells>.
        //    This supports faithful merges identical to JSON.
        // 2) Generic-XML mode: any XML. We auto-detect the "row" elements by finding the largest repeated
        //    sibling set, flatten fields into columns, and import as a normal table (no merges preserved).
        Element rowsEl = findFirstDescendantElement(root, "rows");
        if (rowsEl == null && "rows".equalsIgnoreCase(localName(root))) {
            rowsEl = root;
        }
        if (rowsEl == null) {
            return genericXmlToJson(root);
        }
        return tableXmlToJson(root, rowsEl);
    }

    private JsonNode tableXmlToJson(Element root, Element rowsEl) {
        ObjectNode table = objectMapper.createObjectNode();
        ArrayNode rowsOut = objectMapper.createArrayNode();
        table.set("rows", rowsOut);

        List<Element> rowEls = childElements(rowsEl, "row", "r");
        int fallbackRowIndex = 1;
        for (Element rowEl : rowEls) {
            int rowIndex = firstInt(
                    attr(rowEl, "row"),
                    attr(rowEl, "r"),
                    attr(rowEl, "index"),
                    textChild(rowEl, "row"),
                    textChild(rowEl, "r"),
                    null,
                    fallbackRowIndex
            );

            ArrayNode rowArr = objectMapper.createArrayNode();
            rowsOut.add(rowArr);

            List<Element> cellEls = childElements(rowEl, "cell", "c");
            int fallbackColIndex = 1;
            for (Element cellEl : cellEls) {
                int colIndex = firstInt(
                        attr(cellEl, "col"),
                        attr(cellEl, "c"),
                        attr(cellEl, "index"),
                        textChild(cellEl, "col"),
                        textChild(cellEl, "c"),
                        null,
                        fallbackColIndex
                );

                int cellRow = firstInt(
                        attr(cellEl, "row"),
                        attr(cellEl, "r"),
                        attr(cellEl, "rowIndex"),
                        textChild(cellEl, "row"),
                        textChild(cellEl, "r"),
                        null,
                        rowIndex
                );

                ObjectNode cell = objectMapper.createObjectNode();
                cell.put("row", cellRow);
                cell.put("col", colIndex);

                String key = firstNonBlank(
                        attr(cellEl, "key"),
                        textChild(cellEl, "key")
                );
                if (key != null) {
                    cell.put("key", key);
                }

                String contentHtml = firstNonBlank(
                        attr(cellEl, "contentHtml"),
                        textChild(cellEl, "contentHtml")
                );
                if (contentHtml != null) {
                    cell.put("contentHtml", contentHtml);
                } else {
                    // value/text fallback
                    String value = firstNonBlank(
                            attr(cellEl, "value"),
                            textChild(cellEl, "value"),
                            textChild(cellEl, "text"),
                            directText(cellEl)
                    );
                    cell.put("value", value == null ? "" : value);
                }

                // Inline merge (optional). We also translate common MergeAcross/MergeDown into merges list later.
                Element mergeEl = firstChildElement(cellEl, "merge");
                if (mergeEl != null) {
                    Integer rs = firstIntOrNull(attr(mergeEl, "rowSpan"), textChild(mergeEl, "rowSpan"), textChild(mergeEl, "rows"), null);
                    Integer cs = firstIntOrNull(attr(mergeEl, "colSpan"), textChild(mergeEl, "colSpan"), textChild(mergeEl, "cols"), null);
                    if (rs != null || cs != null) {
                        ObjectNode merge = objectMapper.createObjectNode();
                        merge.put("rowSpan", rs == null ? 1 : Math.max(1, rs));
                        merge.put("colSpan", cs == null ? 1 : Math.max(1, cs));
                        cell.set("merge", merge);
                    }
                }

                Element cbEl = firstChildElement(cellEl, "coveredBy");
                if (cbEl != null) {
                    Integer rr = firstIntOrNull(attr(cbEl, "row"), attr(cbEl, "r"), textChild(cbEl, "row"), textChild(cbEl, "r"));
                    Integer cc = firstIntOrNull(attr(cbEl, "col"), attr(cbEl, "c"), textChild(cbEl, "col"), textChild(cbEl, "c"));
                    if (rr != null && cc != null) {
                        ObjectNode cb = objectMapper.createObjectNode();
                        cb.put("row", rr);
                        cb.put("col", cc);
                        cell.set("coveredBy", cb);
                    }
                }

                rowArr.add(cell);

                fallbackColIndex++;
            }

            fallbackRowIndex++;
        }

        // Support <cell rowSpan="" colSpan=""> or SpreadsheetML-like MergeAcross/MergeDown attributes by injecting
        // temporary span hints (consumed into mergedCells below).
        injectCellSpanHintsFromXml(rowsEl, rowsOut);

        // mergedCells container (optional)
        ArrayNode mergesOut = objectMapper.createArrayNode();
        Element mergedCellsEl = findFirstDescendantElement(root, "mergedCells");
        if (mergedCellsEl != null) {
            for (Element mEl : childElements(mergedCellsEl, "mergedCell", "merge")) {
                Integer sr = firstIntOrNull(attr(mEl, "startRow"), textChild(mEl, "startRow"));
                Integer sc = firstIntOrNull(attr(mEl, "startCol"), textChild(mEl, "startCol"));
                Integer rs = firstIntOrNull(attr(mEl, "rowSpan"), textChild(mEl, "rowSpan"));
                Integer cs = firstIntOrNull(attr(mEl, "colSpan"), textChild(mEl, "colSpan"));
                if (sr == null || sc == null) continue;
                ObjectNode m = objectMapper.createObjectNode();
                m.put("startRow", sr);
                m.put("startCol", sc);
                m.put("rowSpan", rs == null ? 1 : Math.max(1, rs));
                m.put("colSpan", cs == null ? 1 : Math.max(1, cs));
                mergesOut.add(m);
            }
        }

        // Convert per-cell span hints into mergedCells so JsonTabularParser's safety checks apply.
        for (JsonNode rowNode : rowsOut) {
            if (rowNode == null || !rowNode.isArray()) continue;
            for (JsonNode cellNode : rowNode) {
                if (cellNode == null || !cellNode.isObject()) continue;
                int r = cellNode.path("row").asInt(Integer.MIN_VALUE);
                int c = cellNode.path("col").asInt(Integer.MIN_VALUE);
                if (r == Integer.MIN_VALUE || c == Integer.MIN_VALUE) continue;

                JsonNode rsN = cellNode.get("_xmlRowSpan");
                JsonNode csN = cellNode.get("_xmlColSpan");
                if (rsN != null || csN != null) {
                    int rs = rsN == null ? 1 : Math.max(1, rsN.asInt(1));
                    int cs = csN == null ? 1 : Math.max(1, csN.asInt(1));
                    if (rs > 1 || cs > 1) {
                        ObjectNode m = objectMapper.createObjectNode();
                        m.put("startRow", r);
                        m.put("startCol", c);
                        m.put("rowSpan", rs);
                        m.put("colSpan", cs);
                        mergesOut.add(m);
                    }
                    ((ObjectNode) cellNode).remove("_xmlRowSpan");
                    ((ObjectNode) cellNode).remove("_xmlColSpan");
                }
            }
        }

        if (mergesOut.size() > 0) {
            table.set("mergedCells", mergesOut);
        }

        // Optional fractions
        ArrayNode colFr = readFractionsXml(root, "columnFractions");
        if (colFr != null) table.set("columnFractions", colFr);
        ArrayNode rowFr = readFractionsXml(root, "rowFractions");
        if (rowFr != null) table.set("rowFractions", rowFr);

        return table;
    }

    private JsonNode genericXmlToJson(Element root) {
        // Prefer Spreadsheet-like Row/Cell grids when present. Our generic repeated-sibling heuristic can
        // incorrectly pick the repeated <Cell> siblings within a single <Row> (since there are often more
        // cells than rows). This pre-pass ensures workbook-like XML imports as a coordinate grid.
        List<Element> spreadsheetRows = findDescendantElements(root, "row", "r");
        if (looksLikeRowCellGrid(spreadsheetRows)) {
            return rowCellGridToJson(spreadsheetRows);
        }

        List<Element> rowElements = detectRowElements(root);
        if (rowElements.isEmpty()) {
            rowElements = List.of(root);
        }

        // Special-case: Spreadsheet-like XML often looks like:
        // <Sheet><Row index="1"><Cell col="1">...</Cell>...</Row>...</Sheet>
        // Treat that as a coordinate grid so we can infer header merges just like JSON/CSV.
        if (looksLikeRowCellGrid(rowElements)) {
            return rowCellGridToJson(rowElements);
        }

        boolean includeTag = rowElements.stream()
                .map(XmlTabularParser::localName)
                .filter(s -> s != null && !s.isBlank())
                .distinct()
                .count() > 1;

        ArrayNode out = objectMapper.createArrayNode();
        for (Element rowEl : rowElements) {
            ObjectNode obj = objectMapper.createObjectNode();
            if (includeTag) {
                obj.put("_tag", localName(rowEl));
            }

            // Flatten values into a stable key -> list of strings, then join repeated values with newlines.
            var flat = new java.util.LinkedHashMap<String, List<String>>();
            flattenElement(rowEl, "", flat);

            for (var e : flat.entrySet()) {
                String key = e.getKey();
                if (key == null || key.isBlank()) continue;
                List<String> vals = e.getValue();
                if (vals == null || vals.isEmpty()) continue;
                String joined = String.join("\n", vals.stream().map(v -> v == null ? "" : v).toList()).trim();
                obj.put(key, joined);
            }

            // If we ended up with no fields, at least show the element text.
            if (obj.size() == (includeTag ? 1 : 0)) {
                String t = directText(rowEl);
                if (t != null) obj.put("value", t);
            }

            out.add(obj);
        }

        return out;
    }

    private boolean looksLikeRowCellGrid(List<Element> rowElements) {
        if (rowElements == null || rowElements.isEmpty()) return false;
        int examined = Math.min(rowElements.size(), 6);
        int hits = 0;
        for (int i = 0; i < examined; i++) {
            Element row = rowElements.get(i);
            if (row == null) continue;
            List<Element> cells = childElements(row, "cell", "c");
            if (cells.isEmpty()) continue;
            boolean anyHasCol = false;
            for (Element cell : cells) {
                if (cell == null) continue;
                if (attr(cell, "col") != null || attr(cell, "c") != null || attr(cell, "index") != null) {
                    anyHasCol = true;
                    break;
                }
            }
            if (anyHasCol) hits++;
        }
        return hits >= Math.max(1, examined / 2);
    }

    private static List<Element> findDescendantElements(Element root, String... wantedNames) {
        List<Element> out = new ArrayList<>();
        if (root == null || wantedNames == null || wantedNames.length == 0) return out;

        Deque<Element> stack = new ArrayDeque<>();
        stack.push(root);

        while (!stack.isEmpty()) {
            Element cur = stack.pop();
            if (cur != null) {
                String ln = localName(cur);
                if (ln != null && !ln.isBlank()) {
                    for (String w : wantedNames) {
                        if (w != null && w.equalsIgnoreCase(ln)) {
                            out.add(cur);
                            break;
                        }
                    }
                }

                NodeList children = cur.getChildNodes();
                for (int i = children.getLength() - 1; i >= 0; i--) {
                    Node n = children.item(i);
                    if (n instanceof Element e) {
                        stack.push(e);
                    }
                }
            }
        }

        return out;
    }

    private JsonNode rowCellGridToJson(List<Element> rowElements) {
        ObjectNode table = objectMapper.createObjectNode();
        ArrayNode rowsOut = objectMapper.createArrayNode();
        table.set("rows", rowsOut);

        ArrayNode mergesOut = objectMapper.createArrayNode();

        int fallbackRowIndex = 1;
        for (Element rowEl : rowElements) {
            if (rowEl == null) continue;
            int rowIndex = firstInt(
                    attr(rowEl, "index"),
                    attr(rowEl, "row"),
                    attr(rowEl, "r"),
                    textChild(rowEl, "index"),
                    textChild(rowEl, "row"),
                    textChild(rowEl, "r"),
                    fallbackRowIndex
            );

            ArrayNode rowArr = objectMapper.createArrayNode();
            rowsOut.add(rowArr);

            List<Element> cellEls = childElements(rowEl, "cell", "c");
            int fallbackColIndex = 1;
            for (Element cellEl : cellEls) {
                if (cellEl == null) continue;
                int colIndex = firstInt(
                        attr(cellEl, "col"),
                        attr(cellEl, "c"),
                        attr(cellEl, "index"),
                        textChild(cellEl, "col"),
                        textChild(cellEl, "c"),
                        textChild(cellEl, "index"),
                        fallbackColIndex
                );

                ObjectNode cell = objectMapper.createObjectNode();
                cell.put("row", rowIndex);
                cell.put("col", colIndex);

                String contentHtml = firstNonBlank(
                        attr(cellEl, "contentHtml"),
                        textChild(cellEl, "contentHtml")
                );
                if (contentHtml != null) {
                    cell.put("contentHtml", contentHtml);
                } else {
                    String value = firstNonBlank(
                            attr(cellEl, "value"),
                            textChild(cellEl, "value"),
                            textChild(cellEl, "text"),
                            directText(cellEl)
                    );
                    cell.put("value", value == null ? "" : value);
                }

                // Merge hints on a cell (SpreadsheetML-style MergeAcross / MergeDown) or explicit rowSpan/colSpan.
                Integer down = firstIntOrNull(attr(cellEl, "MergeDown"), attr(cellEl, "mergeDown"));
                Integer across = firstIntOrNull(attr(cellEl, "MergeAcross"), attr(cellEl, "mergeAcross"));
                Integer rs = firstIntOrNull(attr(cellEl, "rowSpan"), attr(cellEl, "rows"));
                Integer cs = firstIntOrNull(attr(cellEl, "colSpan"), attr(cellEl, "cols"));
                if (down != null) rs = Math.max(1, down + 1);
                if (across != null) cs = Math.max(1, across + 1);
                int rowSpan = rs == null ? 1 : Math.max(1, rs);
                int colSpan = cs == null ? 1 : Math.max(1, cs);
                if (rowSpan > 1 || colSpan > 1) {
                    ObjectNode m = objectMapper.createObjectNode();
                    m.put("startRow", rowIndex);
                    m.put("startCol", colIndex);
                    m.put("rowSpan", rowSpan);
                    m.put("colSpan", colSpan);
                    mergesOut.add(m);
                }

                rowArr.add(cell);
                fallbackColIndex++;
            }

            fallbackRowIndex++;
        }

        if (mergesOut.size() > 0) {
            table.set("mergedCells", mergesOut);
        }

        return table;
    }

    private List<Element> detectRowElements(Element root) {
        if (root == null) return List.of();

        Element bestParent = null;
        String bestChildName = null;
        int bestCount = 0;

        Deque<Element> stack = new ArrayDeque<>();
        stack.push(root);
        while (!stack.isEmpty()) {
            Element cur = stack.pop();
            List<Element> children = allChildElements(cur);
            if (children.size() >= 2) {
                java.util.HashMap<String, Integer> counts = new java.util.HashMap<>();
                for (Element ch : children) {
                    String ln = localName(ch);
                    if (ln == null || ln.isBlank()) continue;
                    counts.merge(ln.toLowerCase(), 1, Integer::sum);
                }
                for (var e : counts.entrySet()) {
                    int c = e.getValue() == null ? 0 : e.getValue();
                    if (c >= 2 && c > bestCount) {
                        bestCount = c;
                        bestChildName = e.getKey();
                        bestParent = cur;
                    }
                }
            }
            // DFS
            for (int i = children.size() - 1; i >= 0; i--) {
                stack.push(children.get(i));
            }
        }

        if (bestParent != null && bestChildName != null && bestCount >= 2) {
            // Return only the repeated sibling set (ignore container metadata nodes).
            final String wanted = bestChildName;
            final Element parent = bestParent;
            return allChildElements(parent).stream()
                    .filter(e -> wanted.equalsIgnoreCase(localName(e)))
                    .toList();
        }

        // No repetition found -> treat the whole document as a single "row".
        return List.of(root);
    }

    private void flattenElement(Element el, String prefix, java.util.LinkedHashMap<String, List<String>> out) {
        if (el == null) return;

        // Attributes as columns (prefixed with @)
        var attrs = el.getAttributes();
        if (attrs != null) {
            for (int i = 0; i < attrs.getLength(); i++) {
                Node a = attrs.item(i);
                if (a == null) continue;
                String name = a.getNodeName();
                if (name == null || name.isBlank()) continue;
                int idx = name.indexOf(':');
                String nn = idx >= 0 ? name.substring(idx + 1) : name;
                if (nn.isBlank()) continue;
                String key = prefix == null || prefix.isBlank() ? ("@" + nn) : (prefix + ".@" + nn);
                String v = a.getNodeValue();
                if (v != null && !v.isBlank()) {
                    out.computeIfAbsent(key, k -> new ArrayList<>()).add(v.trim());
                }
            }
        }

        List<Element> children = allChildElements(el);
        if (children.isEmpty()) {
            String t = directText(el);
            if (t != null) {
                String key = (prefix == null || prefix.isBlank()) ? localName(el) : prefix;
                if (key != null && !key.isBlank()) {
                    out.computeIfAbsent(key, k -> new ArrayList<>()).add(t);
                }
            }
            return;
        }

        for (Element ch : children) {
            String name = localName(ch);
            if (name == null || name.isBlank()) continue;
            String nextPrefix = (prefix == null || prefix.isBlank()) ? name : (prefix + "." + name);
            flattenElement(ch, nextPrefix, out);
        }
    }

    private static List<Element> allChildElements(Element parent) {
        List<Element> out = new ArrayList<>();
        if (parent == null) return out;
        NodeList children = parent.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            Node n = children.item(i);
            if (n instanceof Element e) {
                out.add(e);
            }
        }
        return out;
    }

    private void injectCellSpanHintsFromXml(Element rowsEl, ArrayNode rowsOut) {
        List<Element> rowEls = childElements(rowsEl, "row", "r");
        int outRowIdx = 0;
        for (Element rowEl : rowEls) {
            if (outRowIdx >= rowsOut.size()) break;
            JsonNode outRow = rowsOut.get(outRowIdx);
            if (outRow == null || !outRow.isArray()) {
                outRowIdx++;
                continue;
            }
            List<Element> cellEls = childElements(rowEl, "cell", "c");
            int outColIdx = 0;
            for (Element cellEl : cellEls) {
                if (outColIdx >= outRow.size()) break;
                JsonNode outCell = outRow.get(outColIdx);
                if (outCell != null && outCell.isObject()) {
                    Integer rs = firstIntOrNull(attr(cellEl, "rowSpan"), attr(cellEl, "rows"));
                    Integer cs = firstIntOrNull(attr(cellEl, "colSpan"), attr(cellEl, "cols"));
                    // SpreadsheetML-style:
                    Integer across = firstIntOrNull(attr(cellEl, "MergeAcross"), attr(cellEl, "mergeAcross"));
                    Integer down = firstIntOrNull(attr(cellEl, "MergeDown"), attr(cellEl, "mergeDown"));
                    if (across != null) cs = Math.max(1, across + 1);
                    if (down != null) rs = Math.max(1, down + 1);
                    if (rs != null && rs > 1) ((ObjectNode) outCell).put("_xmlRowSpan", rs);
                    if (cs != null && cs > 1) ((ObjectNode) outCell).put("_xmlColSpan", cs);
                }
                outColIdx++;
            }
            outRowIdx++;
        }
    }

    private ArrayNode readFractionsXml(Element root, String name) {
        Element el = findFirstDescendantElement(root, name);
        if (el == null) return null;
        List<Element> items = childElements(el, "fraction", "f", "item");
        if (items.isEmpty()) return null;
        ArrayNode arr = objectMapper.createArrayNode();
        for (Element it : items) {
            String t = directText(it);
            if (t == null) continue;
            try {
                arr.add(Double.parseDouble(t.trim()));
            } catch (Exception ignored) {
                // ignore invalid fractions
            }
        }
        return arr.size() > 0 ? arr : null;
    }

    private static Document parseSecure(InputStream in) throws Exception {
        DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
        dbf.setNamespaceAware(true);
        dbf.setXIncludeAware(false);
        dbf.setExpandEntityReferences(false);
        try {
            dbf.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        } catch (Exception ignored) {
        }
        // Disable DTDs/external entities to avoid XXE.
        setFeatureQuietly(dbf, "http://apache.org/xml/features/disallow-doctype-decl", true);
        setFeatureQuietly(dbf, "http://xml.org/sax/features/external-general-entities", false);
        setFeatureQuietly(dbf, "http://xml.org/sax/features/external-parameter-entities", false);
        setFeatureQuietly(dbf, "http://apache.org/xml/features/nonvalidating/load-external-dtd", false);

        DocumentBuilder builder = dbf.newDocumentBuilder();
        return builder.parse(in);
    }

    private static void setFeatureQuietly(DocumentBuilderFactory dbf, String feature, boolean value) {
        try {
            dbf.setFeature(feature, value);
        } catch (Exception ignored) {
        }
    }

    private static Element findFirstDescendantElement(Element root, String wanted) {
        if (root == null) return null;
        String w = wanted.toLowerCase();
        Deque<Element> stack = new ArrayDeque<>();
        stack.push(root);
        while (!stack.isEmpty()) {
            Element cur = stack.pop();
            if (cur != null && w.equalsIgnoreCase(localName(cur))) {
                return cur;
            }
            NodeList children = cur.getChildNodes();
            for (int i = children.getLength() - 1; i >= 0; i--) {
                Node n = children.item(i);
                if (n instanceof Element e) {
                    stack.push(e);
                }
            }
        }
        return null;
    }

    private static Element firstChildElement(Element parent, String wanted) {
        if (parent == null) return null;
        String w = wanted.toLowerCase();
        NodeList children = parent.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            Node n = children.item(i);
            if (!(n instanceof Element e)) continue;
            if (w.equalsIgnoreCase(localName(e))) return e;
        }
        return null;
    }

    private static List<Element> childElements(Element parent, String... wantedNames) {
        List<Element> out = new ArrayList<>();
        if (parent == null) return out;
        NodeList children = parent.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            Node n = children.item(i);
            if (!(n instanceof Element e)) continue;
            String ln = localName(e);
            for (String w : wantedNames) {
                if (w.equalsIgnoreCase(ln)) {
                    out.add(e);
                    break;
                }
            }
        }
        return out;
    }

    private static String localName(Element el) {
        if (el == null) return "";
        String ln = el.getLocalName();
        if (ln != null && !ln.isBlank()) return ln;
        String tn = el.getTagName();
        if (tn == null) return "";
        int idx = tn.indexOf(':');
        return idx >= 0 ? tn.substring(idx + 1) : tn;
    }

    private static String attr(Element el, String name) {
        if (el == null || name == null) return null;
        String v = el.getAttribute(name);
        if (v != null && !v.isBlank()) return v;
        // Try case-insensitive attribute lookup (common in external XML).
        var attrs = el.getAttributes();
        if (attrs == null) return null;
        for (int i = 0; i < attrs.getLength(); i++) {
            Node a = attrs.item(i);
            if (a == null) continue;
            String n = a.getNodeName();
            if (n == null) continue;
            int idx = n.indexOf(':');
            String nn = idx >= 0 ? n.substring(idx + 1) : n;
            if (name.equalsIgnoreCase(nn)) {
                String vv = a.getNodeValue();
                return (vv != null && !vv.isBlank()) ? vv : null;
            }
        }
        return null;
    }

    private static String textChild(Element parent, String childName) {
        Element el = firstChildElement(parent, childName);
        if (el == null) return null;
        return directText(el);
    }

    private static String directText(Element el) {
        if (el == null) return null;
        StringBuilder sb = new StringBuilder();
        NodeList children = el.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            Node n = children.item(i);
            if (n == null) continue;
            if (n.getNodeType() == Node.TEXT_NODE || n.getNodeType() == Node.CDATA_SECTION_NODE) {
                String t = n.getNodeValue();
                if (t != null) sb.append(t);
            }
        }
        String s = sb.toString();
        s = s == null ? "" : s.trim();
        return s.isEmpty() ? null : s;
    }

    private static String firstNonBlank(String... values) {
        if (values == null) return null;
        for (String v : values) {
            if (v == null) continue;
            String t = v.trim();
            if (!t.isEmpty()) return t;
        }
        return null;
    }

    private static Integer firstIntOrNull(String... values) {
        if (values == null) return null;
        for (String v : values) {
            if (v == null) continue;
            String t = v.trim();
            if (t.isEmpty()) continue;
            try {
                return Integer.parseInt(t);
            } catch (Exception ignored) {
            }
        }
        return null;
    }

    private static int firstInt(String v1, String v2, String v3, String v4, String v5, String v6, int fallback) {
        Integer parsed = firstIntOrNull(v1, v2, v3, v4, v5, v6);
        return parsed == null ? fallback : parsed;
    }
}


