package com.org.report_generator.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.org.report_generator.model.document.DocumentModel;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class PdfGenerationRequest {

    @NotNull(message = "Document payload is required")
    @Valid
    private DocumentModel document;
}

