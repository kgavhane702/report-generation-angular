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
public class FooterConfig {
    private String leftText;
    private String centerText;
    private String centerSubText;

    private String leftImage;
    private String centerImage;
    private String rightImage;

    // Per-position text colors (takes precedence over global textColor)
    private String leftTextColor;
    private String centerTextColor;
    private String rightTextColor;

    private String textColor; // Legacy global text color - fallback if per-position not set
    private Boolean showPageNumber;
    private String pageNumberFormat; // 'arabic' | 'roman' | 'alphabetic'

    /**
     * Get the effective text color for left position.
     * Falls back to global textColor, then to default black.
     */
    public String getEffectiveLeftTextColor() {
        if (leftTextColor != null && !leftTextColor.isBlank()) {
            return leftTextColor;
        }
        if (textColor != null && !textColor.isBlank()) {
            return textColor;
        }
        return "#000000";
    }

    /**
     * Get the effective text color for center position.
     * Falls back to global textColor, then to default black.
     */
    public String getEffectiveCenterTextColor() {
        if (centerTextColor != null && !centerTextColor.isBlank()) {
            return centerTextColor;
        }
        if (textColor != null && !textColor.isBlank()) {
            return textColor;
        }
        return "#000000";
    }

    /**
     * Get the effective text color for right position.
     * Falls back to global textColor, then to default black.
     */
    public String getEffectiveRightTextColor() {
        if (rightTextColor != null && !rightTextColor.isBlank()) {
            return rightTextColor;
        }
        if (textColor != null && !textColor.isBlank()) {
            return textColor;
        }
        return "#000000";
    }
}

