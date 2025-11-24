package com.org.report_generator.model.document;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Widget {
    private String id;
    private String type;
    private WidgetPosition position = new WidgetPosition();
    private WidgetSize size = new WidgetSize();
    private JsonNode props;
    private JsonNode style;
}

