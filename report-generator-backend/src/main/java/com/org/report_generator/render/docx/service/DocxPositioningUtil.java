package com.org.report_generator.render.docx.service;

import com.org.report_generator.model.document.Widget;
import com.org.report_generator.model.document.WidgetPosition;
import com.org.report_generator.model.document.WidgetSize;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTFramePr;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTP;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTPPr;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTbl;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTblPPr;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTblPr;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.STHAnchor;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.STVAnchor;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.STWrap;

import java.math.BigInteger;

public final class DocxPositioningUtil {

    private DocxPositioningUtil() {}

    // 96 dpi: 1px = 0.75pt = 15 twips
    private static final double TWIPS_PER_PX = 15d;

    public static void applyParagraphFrame(XWPFParagraph p, Widget widget) {
        if (p == null || widget == null) return;
        WidgetPosition pos = widget.getPosition();
        WidgetSize size = widget.getSize();
        if (pos == null || size == null) return;

        long x = toTwips(pos.getX());
        long y = toTwips(pos.getY());
        long w = toTwips(size.getWidth());
        long h = toTwips(size.getHeight());

        applyParagraphFrame(p, x, y, w, h);
    }

    public static void applyParagraphFrame(XWPFParagraph p, Double xPx, Double yPx, Double wPx, Double hPx) {
        if (p == null) return;
        long x = toTwips(xPx);
        long y = toTwips(yPx);
        long w = toTwips(wPx);
        long h = toTwips(hPx);
        applyParagraphFrame(p, x, y, w, h);
    }

    private static void applyParagraphFrame(XWPFParagraph p, long x, long y, long w, long h) {
        if (p == null) return;

        CTP ctp = p.getCTP();
        CTPPr ppr = ctp.isSetPPr() ? ctp.getPPr() : ctp.addNewPPr();
        CTFramePr frame = ppr.isSetFramePr() ? ppr.getFramePr() : ppr.addNewFramePr();
        frame.setX(BigInteger.valueOf(x));
        frame.setY(BigInteger.valueOf(y));
        frame.setW(BigInteger.valueOf(w));
        frame.setH(BigInteger.valueOf(h));
        frame.setHAnchor(STHAnchor.PAGE);
        frame.setVAnchor(STVAnchor.PAGE);
        frame.setWrap(STWrap.NOT_BESIDE);
    }

    public static void applyTablePosition(XWPFTable table, Widget widget) {
        if (table == null || widget == null) return;
        WidgetPosition pos = widget.getPosition();
        if (pos == null) return;

        long x = toTwips(pos.getX());
        long y = toTwips(pos.getY());

        CTTbl ctTbl = table.getCTTbl();
        CTTblPr pr = ctTbl.getTblPr();
        if (pr == null) {
            pr = ctTbl.addNewTblPr();
        }
        CTTblPPr tblp = pr.getTblpPr();
        if (tblp == null) {
            tblp = pr.addNewTblpPr();
        }
        tblp.setTblpX(BigInteger.valueOf(x));
        tblp.setTblpY(BigInteger.valueOf(y));
    }

    public static long toTwips(Double px) {
        if (px == null) return 0;
        return Math.round(px * TWIPS_PER_PX);
    }
}
