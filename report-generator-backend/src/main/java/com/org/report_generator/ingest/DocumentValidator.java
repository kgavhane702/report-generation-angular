package com.org.report_generator.ingest;

import com.org.report_generator.model.document.DocumentModel;
import com.org.report_generator.model.document.Page;
import com.org.report_generator.model.document.Section;
import com.org.report_generator.model.document.Subsection;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class DocumentValidator {

    private static final Set<String> ALLOWED_SLIDE_LAYOUTS = Set.of(
            "title_slide",
            "title_and_content",
            "section_header",
            "two_content",
            "comparison",
            "title_only",
            "hero_title",
            "title_body",
            "section_intro",
            "two_column",
            "compare_columns",
            "title_focus",
            "blank"
    );

    private static final Set<String> ALLOWED_PAGE_ORIENTATIONS = Set.of("portrait", "landscape");

    public void validate(DocumentModel document) {
        if (document == null) {
            throw new DocumentValidationException("Document payload is required");
        }

        if (document.getSections() == null) {
            throw new DocumentValidationException("Document sections must not be null");
        }

        validatePageSize(document);
        validateHierarchy(document.getSections());
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
                    validateSlideLayout(page);
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

    private void validateSlideLayout(Page page) {
        if (page.getSlideLayoutType() == null || page.getSlideLayoutType().isBlank()) {
            return;
        }

        String normalized = page.getSlideLayoutType().trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED_SLIDE_LAYOUTS.contains(normalized)) {
            throw new DocumentValidationException("Invalid slideLayoutType: " + page.getSlideLayoutType());
        }
    }

    private String safeId(String id, int index) {
        return (id == null || id.isBlank()) ? "#" + index : id;
    }
}
