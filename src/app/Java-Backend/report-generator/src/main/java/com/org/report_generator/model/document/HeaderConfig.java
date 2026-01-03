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
public class HeaderConfig {
    private String leftText;
    private String centerText;
    private String rightText;

    private String leftImage;
    private String centerImage;
    private String rightImage;

    private String textColor;
    private Boolean showPageNumber;
    private String pageNumberFormat; // 'arabic' | 'roman' | 'alphabetic'
}


