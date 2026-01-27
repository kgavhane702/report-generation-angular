package com.org.report_generator.controller;

import com.org.report_generator.config.ImportLimitsConfig;
import com.org.report_generator.dto.common.ApiResponse;
import com.org.report_generator.dto.common.ApiResponseEntity;
import com.org.report_generator.dto.editastra.EditastraImportResponse;
import com.org.report_generator.dto.http.EditastraImportFromUrlRequest;
import com.org.report_generator.importing.enums.ImportFormat;
import com.org.report_generator.importing.model.ImportOptions;
import com.org.report_generator.importing.model.TabularDataset;
import com.org.report_generator.importing.model.TabularRow;
import com.org.report_generator.importing.model.TabularCell;
import com.org.report_generator.importing.service.FormatDetector;
import com.org.report_generator.importing.service.RemoteHttpFetchResult;
import com.org.report_generator.importing.service.RemoteHttpFetcherService;
import com.org.report_generator.importing.service.TabularImportService;
import com.org.report_generator.importing.util.ByteArrayMultipartFile;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * URL import endpoint for Editastra widgets.
 *
 * We reuse the same remote-fetch + tabular parsing pipeline as tables/charts, but then
 * flatten the dataset into a simple HTML block (one line per row).
 */
@RestController
@CrossOrigin(origins = "*")
@RequestMapping
public class EditastraImportController {

    private static final Logger logger = LoggerFactory.getLogger(EditastraImportController.class);

    private final TabularImportService tabularImportService;
    private final ImportLimitsConfig limitsConfig;
    private final RemoteHttpFetcherService remoteFetcher;
    private final FormatDetector formatDetector;

    public EditastraImportController(
            TabularImportService tabularImportService,
            ImportLimitsConfig limitsConfig,
            RemoteHttpFetcherService remoteFetcher,
            FormatDetector formatDetector
    ) {
        this.tabularImportService = tabularImportService;
        this.limitsConfig = limitsConfig;
        this.remoteFetcher = remoteFetcher;
        this.formatDetector = formatDetector;
    }

    @PostMapping(
            value = "/api/editastra/import/url",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<ApiResponse<EditastraImportResponse>> importFromUrl(
            @Valid @RequestBody EditastraImportFromUrlRequest request,
            HttpServletRequest httpRequest
    ) throws Exception {
        long startTime = System.currentTimeMillis();
        logger.info("Editastra URL import request: method={}, url={}",
                request != null ? request.request().method() : "null",
                request != null ? request.request().url() : "null");

        RemoteHttpFetchResult fetched = remoteFetcher.fetch(request.request(), httpRequest);
        ImportFormat fmt = formatDetector.detect(request.format(), fetched.effectiveUrl(), fetched.contentType(), fetched.bytes());

        if (fetched.bytes() == null || fetched.bytes().length == 0) {
            throw new IllegalArgumentException("Remote resource is empty");
        }
        if (fetched.bytes().length > limitsConfig.getMaxFileSizeBytes()) {
            throw new IllegalArgumentException(
                    String.format("Remote size exceeds maximum limit: %d bytes > %d bytes",
                            fetched.bytes().length, limitsConfig.getMaxFileSizeBytes()));
        }

        MultipartFile file = new ByteArrayMultipartFile(
                "file",
                fetched.fileName(),
                fetched.contentType(),
                fetched.bytes()
        );

        try {
            TabularDataset dataset = tabularImportService.importDataset(file, fmt, new ImportOptions(request.sheetIndex(), request.delimiter()));
            String html = flattenDatasetToHtml(dataset);
            long duration = System.currentTimeMillis() - startTime;
            logger.info("Editastra URL import successful in {}ms", duration);
            return ApiResponseEntity.ok(new EditastraImportResponse(html));
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            logger.error("Editastra URL import failed after {}ms", duration, e);
            throw e;
        }
    }

    private static String flattenDatasetToHtml(TabularDataset dataset) {
        if (dataset == null || dataset.rows() == null || dataset.rows().isEmpty()) return "";
        StringBuilder sb = new StringBuilder();
        for (TabularRow row : dataset.rows()) {
            if (row == null || row.cells() == null) continue;
            sb.append("<div>");
            int n = row.cells().size();
            for (int i = 0; i < n; i++) {
                TabularCell cell = row.cells().get(i);
                String cellHtml = cell != null && cell.contentHtml() != null ? cell.contentHtml() : "";
                sb.append(cellHtml);
                if (i < n - 1) {
                    sb.append("&nbsp;|&nbsp;");
                }
            }
            sb.append("</div>");
        }
        return sb.toString();
    }
}


