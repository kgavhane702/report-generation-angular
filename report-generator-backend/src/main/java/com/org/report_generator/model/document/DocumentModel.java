package com.org.report_generator.model.document;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DocumentModel {
    private String id;
    private String title;
    private String version;
    private String schemaVersion;
    private PageSize pageSize = new PageSize();
    private List<Section> sections = new ArrayList<>();
    private Map<String, Object> metadata;
    private HeaderConfig header;
    private FooterConfig footer;
    private LogoConfig logo;
}



