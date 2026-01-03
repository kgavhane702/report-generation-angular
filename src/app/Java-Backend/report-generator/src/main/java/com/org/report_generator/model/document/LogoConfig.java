package com.org.report_generator.model.document;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LogoConfig {
    private String url;
    private String position; // 'top-left', 'top-right', 'bottom-left', 'bottom-right'
    private Integer maxWidthPx;
    private Integer maxHeightPx;
}

