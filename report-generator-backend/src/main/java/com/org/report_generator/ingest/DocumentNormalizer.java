package com.org.report_generator.ingest;

import com.org.report_generator.model.document.DocumentModel;
import com.org.report_generator.model.document.Page;
import com.org.report_generator.model.document.PageSize;
import com.org.report_generator.model.document.Section;
import com.org.report_generator.model.document.Subsection;
import com.org.report_generator.model.document.Widget;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class DocumentNormalizer {

    private static final double DEFAULT_WIDTH_MM = 254d;
    private static final double DEFAULT_HEIGHT_MM = 190.5d;
    private static final int DEFAULT_DPI = 96;
    private static final String DEFAULT_VERSION = "1.0.0";
    private static final String DEFAULT_SCHEMA_VERSION = "2.0";
    private static final String DEFAULT_TITLE = "Untitled Document";

    public DocumentModel normalize(DocumentModel input) {
        DocumentModel out = new DocumentModel();

        out.setId(isBlank(input.getId()) ? UUID.randomUUID().toString() : input.getId().trim());
        out.setTitle(isBlank(input.getTitle()) ? DEFAULT_TITLE : input.getTitle());
        out.setVersion(isBlank(input.getVersion()) ? DEFAULT_VERSION : input.getVersion());
        out.setSchemaVersion(isBlank(input.getSchemaVersion()) ? DEFAULT_SCHEMA_VERSION : input.getSchemaVersion());

        out.setPageSize(normalizePageSize(input.getPageSize()));
        out.setMetadata(normalizeMetadata(input.getMetadata()));

        out.setHeader(input.getHeader());
        out.setFooter(input.getFooter());
        out.setLogo(input.getLogo());

        out.setSections(normalizeSections(input.getSections(), out.getMetadata()));

        return out;
    }

    private PageSize normalizePageSize(PageSize pageSize) {
        PageSize src = pageSize == null ? new PageSize() : pageSize;
        PageSize normalized = new PageSize();
        normalized.setWidthMm(src.getWidthMm() == null || src.getWidthMm() <= 0 ? DEFAULT_WIDTH_MM : src.getWidthMm());
        normalized.setHeightMm(src.getHeightMm() == null || src.getHeightMm() <= 0 ? DEFAULT_HEIGHT_MM : src.getHeightMm());
        normalized.setDpi(src.getDpi() == null || src.getDpi() <= 0 ? DEFAULT_DPI : src.getDpi());
        return normalized;
    }

    private Map<String, Object> normalizeMetadata(Map<String, Object> metadata) {
        Map<String, Object> next = new LinkedHashMap<>();
        if (metadata != null) {
            next.putAll(metadata);
        }

        return next;
    }

    private List<Section> normalizeSections(List<Section> sections, Map<String, Object> metadata) {
        List<Section> source = sections == null ? List.of() : sections;
        List<Section> normalizedSections = new ArrayList<>(source.size());

        int globalPageIndex = 0;
        for (Section section : source) {
            if (section == null) continue;

            Section nextSection = new Section();
            nextSection.setId(isBlank(section.getId()) ? UUID.randomUUID().toString() : section.getId());
            nextSection.setTitle(section.getTitle());
            nextSection.setSubsections(new ArrayList<>());

            List<Subsection> subsections = section.getSubsections() == null ? List.of() : section.getSubsections();
            for (Subsection subsection : subsections) {
                if (subsection == null) continue;

                Subsection nextSubsection = new Subsection();
                nextSubsection.setId(isBlank(subsection.getId()) ? UUID.randomUUID().toString() : subsection.getId());
                nextSubsection.setTitle(subsection.getTitle());
                nextSubsection.setPages(new ArrayList<>());

                List<Page> pages = subsection.getPages() == null ? List.of() : subsection.getPages();
                for (Page page : pages) {
                    if (page == null) continue;

                    globalPageIndex += 1;
                    nextSubsection.getPages().add(normalizePage(page, globalPageIndex));
                }

                nextSection.getSubsections().add(nextSubsection);
            }

            normalizedSections.add(nextSection);
        }

        return normalizedSections;
    }

    private Page normalizePage(Page page, int globalPageIndex) {
        Page next = new Page();
        next.setId(isBlank(page.getId()) ? UUID.randomUUID().toString() : page.getId());
        next.setNumber(page.getNumber() == null || page.getNumber() <= 0 ? globalPageIndex : page.getNumber());
        next.setTitle(page.getTitle());
        next.setOrientation(normalizeOrientation(page.getOrientation()));
        next.setBackground(page.getBackground());

        String normalizedLayout = normalizeLayout(page.getSlideLayoutType());
        next.setSlideLayoutType(normalizedLayout);

        String variantId = page.getSlideVariantId();
        next.setSlideVariantId(isBlank(variantId) ? null : variantId.trim());

        List<Widget> widgets = page.getWidgets() == null ? List.of() : page.getWidgets();
        next.setWidgets(new ArrayList<>(widgets));

        return next;
    }

    private String normalizeOrientation(String orientation) {
        if (isBlank(orientation)) return "landscape";
        String v = orientation.trim().toLowerCase(Locale.ROOT);
        return "portrait".equals(v) ? "portrait" : "landscape";
    }

    private String normalizeLayout(String layout) {
        if (isBlank(layout)) return null;
        return layout.trim().toLowerCase(Locale.ROOT);
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
