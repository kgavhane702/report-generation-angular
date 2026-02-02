package com.org.report_generator.render.docx.service;

import org.apache.batik.transcoder.TranscoderInput;
import org.apache.batik.transcoder.TranscoderOutput;
import org.apache.batik.transcoder.image.PNGTranscoder;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;

public final class SvgToPngConverter {

    private SvgToPngConverter() {}

    public static byte[] convert(byte[] svgBytes, Double widthPx, Double heightPx) {
        if (svgBytes == null || svgBytes.length == 0) return null;
        try (ByteArrayInputStream in = new ByteArrayInputStream(svgBytes);
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            PNGTranscoder transcoder = new PNGTranscoder();
            if (widthPx != null && widthPx > 0) {
                transcoder.addTranscodingHint(PNGTranscoder.KEY_WIDTH, widthPx.floatValue());
            }
            if (heightPx != null && heightPx > 0) {
                transcoder.addTranscodingHint(PNGTranscoder.KEY_HEIGHT, heightPx.floatValue());
            }

            TranscoderInput input = new TranscoderInput(in);
            TranscoderOutput output = new TranscoderOutput(out);
            transcoder.transcode(input, output);

            return out.toByteArray();
        } catch (Exception e) {
            return null;
        }
    }
}
