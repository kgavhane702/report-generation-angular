package com.org.report_generator.render.widgets.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.org.report_generator.render.widgets.RenderContext;
import com.org.report_generator.render.widgets.WidgetRenderer;
import org.springframework.stereotype.Component;

import java.util.Locale;

/**
 * Renderer for Connector widgets (lines/connectors).
 *
 * Uses endpoint-based model: startPoint, endPoint, and optional controlPoint.
 * Generates SVG paths dynamically based on shape type (line, elbow, curved).
 */
@Component
public class ConnectorWidgetHtmlRenderer implements WidgetRenderer {

    private static final double ARROW_SIZE = 10;

    @Override
    public String widgetType() {
        return "connector";
    }

    @Override
    public String render(JsonNode props, String widgetStyle, RenderContext ctx) {
        String style = widgetStyle == null ? "" : widgetStyle;
        if (props == null) {
            return "<div class=\"widget widget-connector\" style=\"" + escapeHtmlAttribute(style) + "\"></div>";
        }

        String shapeType = props.path("shapeType").asText("line");
        String fillColor = props.path("fillColor").asText("#3b82f6");
        int opacity = props.path("opacity").asInt(100);
        boolean arrowEnd = props.path("arrowEnd").asBoolean(false);
        boolean arrowStart = props.path("arrowStart").asBoolean(false);

        JsonNode strokeNode = props.path("stroke");
        int strokeWidth = 2;
        String strokeStyle = "solid";
        if (strokeNode != null && !strokeNode.isMissingNode()) {
            strokeWidth = Math.max(strokeNode.path("width").asInt(2), 2);
            strokeStyle = strokeNode.path("style").asText("solid");
        }

        // Get endpoint coordinates (in widget-local coordinates, relative to widget position)
        JsonNode startPointNode = props.path("startPoint");
        JsonNode endPointNode = props.path("endPoint");
        JsonNode controlPointNode = props.path("controlPoint");

        double startX = startPointNode.path("x").asDouble(0);
        double startY = startPointNode.path("y").asDouble(0);
        double endX = endPointNode.path("x").asDouble(200);
        double endY = endPointNode.path("y").asDouble(0);

        // Extract widget size from widgetStyle for viewBox calculation
        // The CSS contains "width: Xpx; height: Ypx;" - we need to parse these values
        // to match frontend behavior where viewBox = "0 0 width height"
        double widgetWidth = parseStyleDimension(style, "width", 200);
        double widgetHeight = parseStyleDimension(style, "height", 100);
        
        // ViewBox matches widget size exactly, starting at origin (0,0)
        // This matches frontend: `0 0 ${width} ${height}`
        String viewBox = String.format(Locale.ROOT, "0 0 %s %s", 
            trimNumber(widgetWidth), trimNumber(widgetHeight));

        // Generate SVG path based on shape type
        String svgPath = generatePath(shapeType, startX, startY, endX, endY, controlPointNode, props);

        // Generate arrowheads
        String arrowPaths = "";
        if (arrowEnd) {
            arrowPaths += generateArrowhead(shapeType, startX, startY, endX, endY, controlPointNode, props, true, fillColor);
        }
        if (arrowStart) {
            arrowPaths += generateArrowhead(shapeType, startX, startY, endX, endY, controlPointNode, props, false, fillColor);
        }

        String strokeDasharray = "";
        if ("dashed".equals(strokeStyle)) {
            strokeDasharray = "stroke-dasharray=\"8,4\"";
        } else if ("dotted".equals(strokeStyle)) {
            strokeDasharray = "stroke-dasharray=\"2,2\"";
        }

        boolean isElbow = "elbow-connector".equals(shapeType) || "elbow-arrow".equals(shapeType);
        boolean isCurved = "curved-connector".equals(shapeType) || "curved-arrow".equals(shapeType)
                || "s-connector".equals(shapeType) || "s-arrow".equals(shapeType);
        String linejoin = (isElbow || isCurved) ? "round" : "miter";

        String strokeAttr = "stroke=\"" + escapeHtmlAttribute(fillColor) + "\" stroke-width=\"" + strokeWidth
                + "\" stroke-linecap=\"round\" stroke-linejoin=\"" + linejoin + "\" " + strokeDasharray;
        double opacityValue = opacity / 100.0;

        return String.format(
            "<div class=\"widget widget-connector\" style=\"%s\">" +
                "<svg class=\"widget-connector__shape\" viewBox=\"%s\" preserveAspectRatio=\"none\" style=\"width: 100%%; height: 100%%; display: block; opacity: %s; overflow: visible;\">" +
                    "<path d=\"%s\" fill=\"none\" %s />" +
                    "%s" +
                "</svg>" +
            "</div>",
            escapeHtmlAttribute(style),
            escapeHtmlAttribute(viewBox),
            opacityValue,
            escapeHtmlAttribute(svgPath),
            strokeAttr,
            arrowPaths
        );
    }

    /**
     * Generate SVG path based on connector shape type
     */
    private String generatePath(String shapeType, double startX, double startY, 
                                 double endX, double endY, JsonNode controlPointNode, JsonNode props) {
        boolean isElbow = "elbow-connector".equals(shapeType) || "elbow-arrow".equals(shapeType);
        boolean isCurved = "curved-connector".equals(shapeType) || "curved-arrow".equals(shapeType)
                || "s-connector".equals(shapeType) || "s-arrow".equals(shapeType);

        if (isElbow) {
            return generateElbowPath(startX, startY, endX, endY, controlPointNode, props);
        } else if (isCurved) {
            // Curved connector with control point
            double ctrlX, ctrlY;
            if (controlPointNode != null && !controlPointNode.isMissingNode()) {
                ctrlX = controlPointNode.path("x").asDouble((startX + endX) / 2);
                ctrlY = controlPointNode.path("y").asDouble(Math.min(startY, endY) - 50);
            } else {
                ctrlX = (startX + endX) / 2;
                ctrlY = Math.min(startY, endY) - 50;
            }
            return String.format(Locale.ROOT, "M %s %s Q %s %s %s %s",
                trimNumber(startX), trimNumber(startY),
                trimNumber(ctrlX), trimNumber(ctrlY),
                trimNumber(endX), trimNumber(endY));
        } else {
            // Straight line
            return String.format(Locale.ROOT, "M %s %s L %s %s",
                trimNumber(startX), trimNumber(startY),
                trimNumber(endX), trimNumber(endY));
        }
    }

    /**
     * Generate arrowhead path at connector endpoint
     */
    private String generateArrowhead(String shapeType, double startX, double startY,
                                      double endX, double endY, JsonNode controlPointNode, JsonNode props,
                                      boolean atEnd, String color) {
        double tipX, tipY;
        double angle;

        boolean isElbow = "elbow-connector".equals(shapeType) || "elbow-arrow".equals(shapeType);
        boolean isCurved = "curved-connector".equals(shapeType) || "curved-arrow".equals(shapeType)
                || "s-connector".equals(shapeType) || "s-arrow".equals(shapeType);

        if (atEnd) {
            tipX = endX;
            tipY = endY;
            if (isElbow) {
                // Arrow direction should follow the last non-tiny segment of the elbow polyline.
                double[] prev = findPrevPointForElbowArrow(startX, startY, endX, endY, controlPointNode, props);
                if (prev == null) {
                    return "";
                }
                angle = Math.atan2(tipY - prev[1], tipX - prev[0]);
            } else if (isCurved && controlPointNode != null && !controlPointNode.isMissingNode()) {
                double ctrlX = controlPointNode.path("x").asDouble((startX + endX) / 2);
                double ctrlY = controlPointNode.path("y").asDouble(Math.min(startY, endY) - 50);
                angle = Math.atan2(tipY - ctrlY, tipX - ctrlX);
            } else {
                angle = Math.atan2(endY - startY, endX - startX);
            }
        } else {
            tipX = startX;
            tipY = startY;
            if (isElbow) {
                // For start arrow, follow the first non-tiny segment away from start.
                double[] next = findNextPointForElbowArrow(startX, startY, endX, endY, controlPointNode, props);
                if (next == null) {
                    return "";
                }
                angle = Math.atan2(tipY - next[1], tipX - next[0]);
            } else if (isCurved && controlPointNode != null && !controlPointNode.isMissingNode()) {
                double ctrlX = controlPointNode.path("x").asDouble((startX + endX) / 2);
                double ctrlY = controlPointNode.path("y").asDouble(Math.min(startY, endY) - 50);
                angle = Math.atan2(tipY - ctrlY, tipX - ctrlX);
            } else {
                angle = Math.atan2(startY - endY, startX - endX);
            }
        }

        double leftAngle = angle + Math.PI * 5 / 6;
        double rightAngle = angle - Math.PI * 5 / 6;

        // Clamp arrow length to the available segment length to avoid visual flipping on tiny segments.
        // (Matches frontend behavior.)
        double segLen;
        if (atEnd) {
            // Use the last segment length.
            double[] prev = isElbow ? findPrevPointForElbowArrow(startX, startY, endX, endY, controlPointNode, props) : null;
            if (isElbow && prev == null) return "";
            double fromX = isElbow ? prev[0] : startX;
            double fromY = isElbow ? prev[1] : startY;
            segLen = Math.hypot(tipX - fromX, tipY - fromY);
        } else {
            // Use the first segment length.
            double[] next = isElbow ? findNextPointForElbowArrow(startX, startY, endX, endY, controlPointNode, props) : null;
            if (isElbow && next == null) return "";
            double toX = isElbow ? next[0] : endX;
            double toY = isElbow ? next[1] : endY;
            segLen = Math.hypot(tipX - toX, tipY - toY);
        }

        if (!Double.isFinite(segLen) || segLen < 1e-3) {
            return "";
        }
        double arrowLen = Math.min(ARROW_SIZE, segLen * 0.8);

        double leftX = tipX + arrowLen * Math.cos(leftAngle);
        double leftY = tipY + arrowLen * Math.sin(leftAngle);
        double rightX = tipX + arrowLen * Math.cos(rightAngle);
        double rightY = tipY + arrowLen * Math.sin(rightAngle);

        String pathD = String.format(Locale.ROOT, "M %s %s L %s %s L %s %s Z",
            trimNumber(tipX), trimNumber(tipY),
            trimNumber(leftX), trimNumber(leftY),
            trimNumber(rightX), trimNumber(rightY));

        return String.format("<path d=\"%s\" fill=\"%s\" stroke=\"none\" />", 
            escapeHtmlAttribute(pathD), escapeHtmlAttribute(color));
    }

    private double[] findPrevPointForElbowArrow(double startX, double startY, double endX, double endY, 
                                                 JsonNode controlPointNode, JsonNode props) {
        // Points must match generatePath() for elbows using anchor-aware routing.
        double[][] pts = computeElbowPoints(startX, startY, endX, endY, controlPointNode, props);

        double[] end = pts[pts.length - 1];
        final double minSeg = 0.5;
        for (int i = pts.length - 2; i >= 0; i--) {
            double len = Math.hypot(end[0] - pts[i][0], end[1] - pts[i][1]);
            if (len >= minSeg) return pts[i];
        }
        return null;
    }

    private double[] findNextPointForElbowArrow(double startX, double startY, double endX, double endY, 
                                                 JsonNode controlPointNode, JsonNode props) {
        double[][] pts = computeElbowPoints(startX, startY, endX, endY, controlPointNode, props);

        double[] start = pts[0];
        final double minSeg = 0.5;
        for (int i = 1; i < pts.length; i++) {
            double len = Math.hypot(pts[i][0] - start[0], pts[i][1] - start[1]);
            if (len >= minSeg) return pts[i];
        }
        return null;
    }

    /**
     * Compute elbow polyline points with anchor-aware routing (same logic as frontend).
     */
    private double[][] computeElbowPoints(double startX, double startY, double endX, double endY, 
                                           JsonNode controlPointNode, JsonNode props) {
        final double STUB = 30.0;
        final double EPS = 1e-6;

        String startDir = getAnchorDirection(props, "startAttachment");
        String endDir = getAnchorDirection(props, "endAttachment");

        // Visual handle point:
        // - If controlPoint exists: handle = B(0.5)
        // - If missing (older docs / backend input): use the same anchor-aware default handle as UI
        double[] handle = computeElbowHandleWithDefault(startX, startY, endX, endY, controlPointNode, startDir, endDir);
        double handleX = handle[0];
        double handleY = handle[1];

        double[] startStub = offsetPoint(startX, startY, startDir, STUB);
        double[] endStub = offsetPoint(endX, endY, endDir, STUB);

        boolean startHoriz = "left".equals(startDir) || "right".equals(startDir);
        boolean endHoriz = "left".equals(endDir) || "right".equals(endDir);

        char startPref = startHoriz ? 'h' : 'v';
        char endPref = endHoriz ? 'h' : 'v';

        double[][] best = null;
        double bestScore = Double.POSITIVE_INFINITY;

        char[] startPrefs = axisPrefs(startPref);
        char[] endPrefs = axisPrefs(endPref);

        for (char leg1Pref : startPrefs) {
            for (char leg2Pref : endPrefs) {
                double[][] leg1 = connectOrthogonal(startStub[0], startStub[1], handleX, handleY, leg1Pref);
                double[][] leg2 = connectOrthogonal(handleX, handleY, endStub[0], endStub[1], leg2Pref);

                double[][] raw = concatPath(
                    new double[][]{{startX, startY}},
                    pointIfDistinct(startStub[0], startStub[1], startX, startY, EPS),
                    sliceFrom(leg1, 1),
                    sliceFrom(leg2, 1),
                    pointIfDistinct(endX, endY, endStub[0], endStub[1], EPS)
                );

                double[][] compact = compactOrthogonalPointsKeep(raw, handleX, handleY, EPS);
                if (!isRouteValid(compact, startDir, endDir, EPS)) {
                    continue;
                }

                int intersections = countSelfIntersections(compact, EPS);
                long bends = countBends(compact, EPS);
                double length = manhattanLength(compact);
                double score = intersections * 1_000_000d + bends * 10_000d + length;

                if (score < bestScore) {
                    bestScore = score;
                    best = compact;
                }
            }
        }

        if (best != null) return best;

        // Fallback: stable route through handle with stubs.
        double[][] fallback = new double[][]{
            {startX, startY},
            startStub,
            {handleX, startStub[1]},
            {handleX, handleY},
            {endStub[0], handleY},
            endStub,
            {endX, endY},
        };
        return compactOrthogonalPointsKeep(fallback, handleX, handleY, EPS);
    }

    private double[] computeElbowHandleWithDefault(
        double startX,
        double startY,
        double endX,
        double endY,
        JsonNode controlPointNode,
        String startDir,
        String endDir
    ) {
        if (controlPointNode != null && !controlPointNode.isMissingNode() && controlPointNode.has("x") && controlPointNode.has("y")) {
            double ctrlX = controlPointNode.path("x").asDouble(startX);
            double ctrlY = controlPointNode.path("y").asDouble(endY);
            double handleX = 0.25 * startX + 0.5 * ctrlX + 0.25 * endX;
            double handleY = 0.25 * startY + 0.5 * ctrlY + 0.25 * endY;
            return new double[]{handleX, handleY};
        }

        // Anchor-aware default handle (must match frontend default for missing controlPoint).
        boolean startHoriz = "left".equals(startDir) || "right".equals(startDir);
        boolean endHoriz = "left".equals(endDir) || "right".equals(endDir);
        if (startDir == null && endDir == null) {
            return new double[]{startX, endY};
        }
        if (startHoriz && endHoriz) {
            return new double[]{(startX + endX) / 2.0, (startY + endY) / 2.0};
        }
        if (!startHoriz && !endHoriz) {
            return new double[]{(startX + endX) / 2.0, (startY + endY) / 2.0};
        }
        if (startHoriz && !endHoriz) {
            return new double[]{endX, startY};
        }
        // start vertical, end horizontal
        return new double[]{startX, endY};
    }

    private char[] axisPrefs(char preferred) {
        return preferred == 'h' ? new char[]{'h', 'v'} : new char[]{'v', 'h'};
    }

    private double[] offsetPoint(double x, double y, String dir, double dist) {
        if (dir == null) return new double[]{x, y};
        switch (dir) {
            case "left":
                return new double[]{x - dist, y};
            case "right":
                return new double[]{x + dist, y};
            case "up":
                return new double[]{x, y - dist};
            case "down":
                return new double[]{x, y + dist};
            default:
                return new double[]{x, y};
        }
    }

    private double[][] connectOrthogonal(double ax, double ay, double bx, double by, char pref) {
        final double EPS = 1e-6;
        if (Math.abs(ax - bx) < EPS || Math.abs(ay - by) < EPS) {
            return new double[][]{{ax, ay}, {bx, by}};
        }
        if (pref == 'h') {
            return new double[][]{{ax, ay}, {bx, ay}, {bx, by}};
        }
        return new double[][]{{ax, ay}, {ax, by}, {bx, by}};
    }

    private double[][] pointIfDistinct(double x, double y, double refX, double refY, double eps) {
        if (Math.abs(x - refX) < eps && Math.abs(y - refY) < eps) return new double[0][0];
        return new double[][]{{x, y}};
    }

    private double[][] sliceFrom(double[][] pts, int startIdx) {
        if (pts == null || pts.length <= startIdx) return new double[0][0];
        double[][] out = new double[pts.length - startIdx][2];
        for (int i = startIdx; i < pts.length; i++) {
            out[i - startIdx][0] = pts[i][0];
            out[i - startIdx][1] = pts[i][1];
        }
        return out;
    }

    private double[][] concatPath(double[][]... parts) {
        int total = 0;
        for (double[][] p : parts) {
            if (p != null) total += p.length;
        }
        double[][] out = new double[total][2];
        int k = 0;
        for (double[][] p : parts) {
            if (p == null) continue;
            for (double[] xy : p) {
                out[k][0] = xy[0];
                out[k][1] = xy[1];
                k++;
            }
        }
        return out;
    }

    private double[][] compactOrthogonalPointsKeep(double[][] pts, double keepX, double keepY, double eps) {
        if (pts == null || pts.length == 0) return new double[0][0];

        // 1) remove duplicates
        double[][] tmp = new double[pts.length][2];
        int n = 0;
        for (int i = 0; i < pts.length; i++) {
            if (n == 0 || Math.abs(pts[i][0] - tmp[n - 1][0]) > eps || Math.abs(pts[i][1] - tmp[n - 1][1]) > eps) {
                tmp[n][0] = pts[i][0];
                tmp[n][1] = pts[i][1];
                n++;
            }
        }

        // 2) remove collinear middle points, but never remove the handle point
        double[][] out = new double[n][2];
        int m = 0;
        for (int i = 0; i < n; i++) {
            out[m][0] = tmp[i][0];
            out[m][1] = tmp[i][1];
            m++;

            while (m >= 3) {
                double ax = out[m - 3][0], ay = out[m - 3][1];
                double bx = out[m - 2][0], by = out[m - 2][1];
                double cx = out[m - 1][0], cy = out[m - 1][1];

                boolean bIsKeep = Math.abs(bx - keepX) < eps && Math.abs(by - keepY) < eps;
                if (bIsKeep) break;

                boolean collinear = (Math.abs(ax - bx) < eps && Math.abs(bx - cx) < eps)
                    || (Math.abs(ay - by) < eps && Math.abs(by - cy) < eps);
                if (!collinear) break;

                // remove middle point
                out[m - 2][0] = out[m - 1][0];
                out[m - 2][1] = out[m - 1][1];
                m--;
            }
        }

        double[][] finalOut = new double[m][2];
        for (int i = 0; i < m; i++) {
            finalOut[i][0] = out[i][0];
            finalOut[i][1] = out[i][1];
        }
        return finalOut;
    }

    private boolean isRouteValid(double[][] pts, String startDir, String endDir, double eps) {
        if (pts == null || pts.length < 2) return false;
        if (startDir != null && pts.length >= 3) {
            if (!isTurnAllowed(pts[0], pts[1], pts[2], startDir, true, eps)) return false;
        }
        if (endDir != null && pts.length >= 3) {
            int n = pts.length;
            if (!isTurnAllowed(pts[n - 3], pts[n - 2], pts[n - 1], endDir, false, eps)) return false;
        }
        // We prefer zero intersections; validity requires no intersections.
        return countSelfIntersections(pts, eps) == 0;
    }

    private boolean isTurnAllowed(double[] prev, double[] at, double[] next, String anchorDir, boolean isStart, double eps) {
        double dx2 = next[0] - at[0];
        double dy2 = next[1] - at[1];

        boolean seg2IsHorizontal = Math.abs(dy2) < eps && Math.abs(dx2) >= eps;
        boolean seg2IsVertical = Math.abs(dx2) < eps && Math.abs(dy2) >= eps;
        if (!seg2IsHorizontal && !seg2IsVertical) return true;

        String dir = isStart ? anchorDir : oppositeDir(anchorDir);
        if (("left".equals(dir) || "right".equals(dir)) && seg2IsHorizontal) {
            return "right".equals(dir) ? dx2 >= -eps : dx2 <= eps;
        }
        if (("up".equals(dir) || "down".equals(dir)) && seg2IsVertical) {
            return "down".equals(dir) ? dy2 >= -eps : dy2 <= eps;
        }
        return true;
    }

    private String oppositeDir(String dir) {
        if (dir == null) return null;
        switch (dir) {
            case "left":
                return "right";
            case "right":
                return "left";
            case "up":
                return "down";
            case "down":
                return "up";
            default:
                return null;
        }
    }

    private double manhattanLength(double[][] pts) {
        double sum = 0;
        for (int i = 1; i < pts.length; i++) {
            sum += Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
        }
        return sum;
    }

    private long countBends(double[][] pts, double eps) {
        long bends = 0;
        for (int i = 2; i < pts.length; i++) {
            double ax = pts[i - 2][0], ay = pts[i - 2][1];
            double bx = pts[i - 1][0], by = pts[i - 1][1];
            double cx = pts[i][0], cy = pts[i][1];
            char dir1 = Math.abs(ax - bx) < eps ? 'v' : 'h';
            char dir2 = Math.abs(bx - cx) < eps ? 'v' : 'h';
            if (dir1 != dir2) bends++;
        }
        return bends;
    }

    private int countSelfIntersections(double[][] pts, double eps) {
        // Axis-aligned polyline self-intersections (excluding adjacent segments and shared endpoints)
        int segCount = 0;
        for (int i = 1; i < pts.length; i++) {
            if (Math.abs(pts[i][0] - pts[i - 1][0]) < eps && Math.abs(pts[i][1] - pts[i - 1][1]) < eps) continue;
            segCount++;
        }
        if (segCount < 3) return 0;

        double[][] segA = new double[segCount][2];
        double[][] segB = new double[segCount][2];
        int k = 0;
        for (int i = 1; i < pts.length; i++) {
            double x1 = pts[i - 1][0], y1 = pts[i - 1][1];
            double x2 = pts[i][0], y2 = pts[i][1];
            if (Math.abs(x2 - x1) < eps && Math.abs(y2 - y1) < eps) continue;
            segA[k][0] = x1;
            segA[k][1] = y1;
            segB[k][0] = x2;
            segB[k][1] = y2;
            k++;
        }

        int count = 0;
        for (int i = 0; i < segCount; i++) {
            for (int j = i + 1; j < segCount; j++) {
                if (Math.abs(i - j) <= 1) continue; // adjacent
                if (segmentsIntersect(segA[i], segB[i], segA[j], segB[j], eps)) count++;
            }
        }
        return count;
    }

    private boolean segmentsIntersect(double[] a1, double[] a2, double[] b1, double[] b2, double eps) {
        boolean aHoriz = Math.abs(a1[1] - a2[1]) < eps;
        boolean bHoriz = Math.abs(b1[1] - b2[1]) < eps;

        // Shared endpoints are allowed.
        if (pointsEqual(a1, b1, eps) || pointsEqual(a1, b2, eps) || pointsEqual(a2, b1, eps) || pointsEqual(a2, b2, eps)) {
            return false;
        }

        // Perpendicular intersection
        if (aHoriz != bHoriz) {
            double[] h1 = aHoriz ? a1 : b1;
            double[] h2 = aHoriz ? a2 : b2;
            double[] v1 = aHoriz ? b1 : a1;
            double[] v2 = aHoriz ? b2 : a2;

            double hxMin = Math.min(h1[0], h2[0]);
            double hxMax = Math.max(h1[0], h2[0]);
            double vyMin = Math.min(v1[1], v2[1]);
            double vyMax = Math.max(v1[1], v2[1]);

            double ix = v1[0];
            double iy = h1[1];

            return ix >= hxMin - eps && ix <= hxMax + eps && iy >= vyMin - eps && iy <= vyMax + eps;
        }

        // Collinear overlap counts as touching
        if (aHoriz && bHoriz && Math.abs(a1[1] - b1[1]) < eps) {
            double aMin = Math.min(a1[0], a2[0]);
            double aMax = Math.max(a1[0], a2[0]);
            double bMin = Math.min(b1[0], b2[0]);
            double bMax = Math.max(b1[0], b2[0]);
            return Math.max(aMin, bMin) <= Math.min(aMax, bMax) + eps;
        }
        if (!aHoriz && !bHoriz && Math.abs(a1[0] - b1[0]) < eps) {
            double aMin = Math.min(a1[1], a2[1]);
            double aMax = Math.max(a1[1], a2[1]);
            double bMin = Math.min(b1[1], b2[1]);
            double bMax = Math.max(b1[1], b2[1]);
            return Math.max(aMin, bMin) <= Math.min(aMax, bMax) + eps;
        }
        return false;
    }

    private boolean pointsEqual(double[] p, double[] q, double eps) {
        return Math.abs(p[0] - q[0]) < eps && Math.abs(p[1] - q[1]) < eps;
    }

    /**
     * Generate elbow connector path with anchor-aware routing.
     */
    private String generateElbowPath(double startX, double startY, double endX, double endY, 
                                      JsonNode controlPointNode, JsonNode props) {
        double[][] pts = computeElbowPoints(startX, startY, endX, endY, controlPointNode, props);
        StringBuilder sb = new StringBuilder();
        sb.append(String.format(Locale.ROOT, "M %s %s", trimNumber(pts[0][0]), trimNumber(pts[0][1])));

        double lastX = pts[0][0];
        double lastY = pts[0][1];
        for (int i = 1; i < pts.length; i++) {
            double x = pts[i][0];
            double y = pts[i][1];
            if (Math.abs(x - lastX) <= 0.01 && Math.abs(y - lastY) <= 0.01) continue;
            sb.append(String.format(Locale.ROOT, " L %s %s", trimNumber(x), trimNumber(y)));
            lastX = x;
            lastY = y;
        }

        return sb.toString();
    }

    private String formatElbowPath(double x1, double y1, double x2, double y2, double x3, double y3, 
                                    double x4, double y4, double x5, double y5) {
        // Compact duplicates
        StringBuilder sb = new StringBuilder();
        sb.append(String.format(Locale.ROOT, "M %s %s", trimNumber(x1), trimNumber(y1)));
        
        double[][] pts = {{x2, y2}, {x3, y3}, {x4, y4}, {x5, y5}};
        double lastX = x1, lastY = y1;
        
        for (double[] pt : pts) {
            if (Math.abs(pt[0] - lastX) > 0.01 || Math.abs(pt[1] - lastY) > 0.01) {
                sb.append(String.format(Locale.ROOT, " L %s %s", trimNumber(pt[0]), trimNumber(pt[1])));
                lastX = pt[0];
                lastY = pt[1];
            }
        }
        
        return sb.toString();
    }

    /**
     * Get the effective anchor direction for a connector attachment.
     * First checks for the rotation-aware 'dir' field (set by frontend when widget is rotated),
     * then falls back to computing direction from the 'anchor' position.
     */
    private String getAnchorDirection(JsonNode props, String attachmentKey) {
        if (props == null) return null;
        JsonNode attachment = props.path(attachmentKey);
        if (attachment == null || attachment.isMissingNode()) return null;
        
        // First check for explicit direction (rotation-aware, set by frontend)
        String dir = attachment.path("dir").asText(null);
        if (dir != null && !dir.isEmpty()) {
            // Validate it's a known direction
            if ("up".equals(dir) || "down".equals(dir) || "left".equals(dir) || "right".equals(dir)) {
                return dir;
            }
        }
        
        // Fall back to computing direction from anchor position (for unrotated widgets)
        String anchor = attachment.path("anchor").asText(null);
        if (anchor == null) return null;
        
        switch (anchor) {
            case "top":
            case "top-left":
            case "top-right":
                return "up";
            case "bottom":
            case "bottom-left":
            case "bottom-right":
                return "down";
            case "left":
                return "left";
            case "right":
                return "right";
            default:
                return null;
        }
    }

    private String trimNumber(double v) {
        if (!Double.isFinite(v)) return "0";
        long asLong = (long) v;
        if (Math.abs(v - asLong) < 0.0000001d) {
            return Long.toString(asLong);
        }
        return String.format(Locale.ROOT, "%.2f", v);
    }

    /**
     * Parse a dimension (width or height) from CSS style string.
     * Looks for patterns like "width: 123.45px;" and extracts the numeric value.
     */
    private double parseStyleDimension(String style, String property, double defaultValue) {
        if (style == null || style.isEmpty()) return defaultValue;
        
        // Look for property: valueXXpx; pattern
        String search = property + ":";
        int idx = style.toLowerCase().indexOf(search.toLowerCase());
        if (idx < 0) return defaultValue;
        
        int start = idx + search.length();
        // Skip whitespace
        while (start < style.length() && Character.isWhitespace(style.charAt(start))) {
            start++;
        }
        
        // Extract numeric value (may include decimal point)
        int end = start;
        while (end < style.length()) {
            char c = style.charAt(end);
            if (Character.isDigit(c) || c == '.' || c == '-') {
                end++;
            } else {
                break;
            }
        }
        
        if (end > start) {
            try {
                return Double.parseDouble(style.substring(start, end));
            } catch (NumberFormatException e) {
                return defaultValue;
            }
        }
        return defaultValue;
    }

    private String escapeHtml(String input) {
        if (input == null) {
            return "";
        }
        return input.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private String escapeHtmlAttribute(String input) {
        return escapeHtml(input);
    }
}
