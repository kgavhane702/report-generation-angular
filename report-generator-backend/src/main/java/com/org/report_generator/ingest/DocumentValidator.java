package com.org.report_generator.ingest;

import com.org.report_generator.model.document.DocumentModel;
import com.org.report_generator.model.document.Page;
import com.org.report_generator.model.document.Section;
import com.org.report_generator.model.document.Subsection;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class DocumentValidator {

    private static final Set<String> ALLOWED_PAGE_ORIENTATIONS = Set.of("portrait", "landscape");

    public void validate(DocumentModel document) {
        if (document == null) {
            throw new DocumentValidationException("Document payload is required");
        }

        if (document.getSections() == null) {
            throw new DocumentValidationException("Document sections must not be null");
        }

        validateThemeMetadata(document);
        validateRenderManifest(document);
        validatePageSize(document);
        validateHierarchy(document.getSections());
    }

    private void validateThemeMetadata(DocumentModel document) {
        Map<String, Object> metadata = document.getMetadata();
        if (metadata == null) return;

        Object themeResolvedRaw = metadata.get("slideThemeResolved");
        if (themeResolvedRaw == null) return;
        if (!(themeResolvedRaw instanceof Map<?, ?> themeResolved)) {
            throw new DocumentValidationException("metadata.slideThemeResolved must be an object when provided");
        }

        Object themeIdRaw = themeResolved.get("themeId");
        if (!(themeIdRaw instanceof String themeId) || themeId.isBlank()) {
            throw new DocumentValidationException("metadata.slideThemeResolved.themeId is required");
        }

        Object variantsRaw = themeResolved.get("variants");
        if (!(variantsRaw instanceof Map<?, ?> variants) || variants.isEmpty()) {
            throw new DocumentValidationException("metadata.slideThemeResolved.variants must be a non-empty object");
        }
    }

    private void validateRenderManifest(DocumentModel document) {
        Map<String, Object> metadata = document.getMetadata();
        if (metadata == null) return;

        Object renderManifestRaw = metadata.get("renderManifest");
        if (renderManifestRaw == null) return;
        if (!(renderManifestRaw instanceof Map<?, ?> renderManifest)) {
            throw new DocumentValidationException("metadata.renderManifest must be an object when provided");
        }

        Object versionRaw = renderManifest.get("version");
        if (!(versionRaw instanceof String version) || version.isBlank()) {
            throw new DocumentValidationException("metadata.renderManifest.version is required");
        }

        Object themeCssRaw = renderManifest.get("themeCss");
        if (themeCssRaw == null) return;
        if (!(themeCssRaw instanceof String themeCss)) {
            throw new DocumentValidationException("metadata.renderManifest.themeCss must be a string");
        }
        if (themeCss.length() > 50_000) {
            throw new DocumentValidationException("metadata.renderManifest.themeCss exceeds maximum allowed length");
        }
        if (themeCss.toLowerCase(Locale.ROOT).contains("<script")) {
            throw new DocumentValidationException("metadata.renderManifest.themeCss cannot contain script content");
        }
    }

    private void validatePageSize(DocumentModel document) {
        if (document.getPageSize() == null) {
            return;
        }

        if (document.getPageSize().getWidthMm() != null && document.getPageSize().getWidthMm() <= 0) {
            throw new DocumentValidationException("Document pageSize.widthMm must be greater than 0");
        }

        if (document.getPageSize().getHeightMm() != null && document.getPageSize().getHeightMm() <= 0) {
            throw new DocumentValidationException("Document pageSize.heightMm must be greater than 0");
        }

        if (document.getPageSize().getDpi() != null && document.getPageSize().getDpi() <= 0) {
            throw new DocumentValidationException("Document pageSize.dpi must be greater than 0");
        }
    }

    private void validateHierarchy(List<Section> sections) {
        for (int s = 0; s < sections.size(); s++) {
            Section section = sections.get(s);
            if (section == null) {
                throw new DocumentValidationException("Section at index " + s + " is null");
            }

            if (section.getSubsections() == null) {
                throw new DocumentValidationException("Section " + safeId(section.getId(), s) + " has null subsections");
            }

            for (int sub = 0; sub < section.getSubsections().size(); sub++) {
                Subsection subsection = section.getSubsections().get(sub);
                if (subsection == null) {
                    throw new DocumentValidationException("Subsection at index " + sub + " in section " + safeId(section.getId(), s) + " is null");
                }

                if (subsection.getPages() == null) {
                    throw new DocumentValidationException("Subsection " + safeId(subsection.getId(), sub) + " has null pages");
                }

                for (int p = 0; p < subsection.getPages().size(); p++) {
                    Page page = subsection.getPages().get(p);
                    if (page == null) {
                        throw new DocumentValidationException("Page at index " + p + " in subsection " + safeId(subsection.getId(), sub) + " is null");
                    }

                    validatePageOrientation(page);
                }
            }
        }
    }

    private void validatePageOrientation(Page page) {
        if (page.getOrientation() == null || page.getOrientation().isBlank()) {
            return;
        }

        String normalized = page.getOrientation().trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED_PAGE_ORIENTATIONS.contains(normalized)) {
            throw new DocumentValidationException("Invalid page orientation: " + page.getOrientation());
        }
    }

    private String safeId(String id, int index) {
        return (id == null || id.isBlank()) ? "#" + index : id;
    }
}
