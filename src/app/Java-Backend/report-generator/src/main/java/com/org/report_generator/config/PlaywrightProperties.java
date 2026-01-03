package com.org.report_generator.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@ConfigurationProperties(prefix = "export.playwright")
public class PlaywrightProperties {
    /**
     * Chromium executable path (Edge/Chrome). Keep the current Edge path as default.
     */
    private String executablePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

    /**
     * Launch args. Defaults match previous hardcoded values.
     */
    private List<String> args = List.of(
            "--headless=new",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--disable-gpu"
    );

    public String getExecutablePath() {
        return executablePath;
    }

    public void setExecutablePath(String executablePath) {
        this.executablePath = executablePath;
    }

    public List<String> getArgs() {
        return args;
    }

    public void setArgs(List<String> args) {
        this.args = args;
    }
}


