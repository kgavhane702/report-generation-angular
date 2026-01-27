package com.org.report_generator.config;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Playwright;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.nio.file.Paths;

@Configuration
public class PlaywrightConfig implements DisposableBean {

    private Playwright playwright;
    private Browser browser;

    @Bean
    public Playwright playwright() {
        this.playwright = Playwright.create();
        return this.playwright;
    }

    @Bean
    public Browser browser(Playwright playwright, PlaywrightProperties props) {
        BrowserType.LaunchOptions options = new BrowserType.LaunchOptions()
                .setExecutablePath(Paths.get(props.getExecutablePath()))
                .setArgs(props.getArgs());
        this.browser = playwright.chromium().launch(options);
        return this.browser;
    }

    @Override
    public void destroy() {
        if (browser != null) {
            browser.close();
        }
        if (playwright != null) {
            playwright.close();
        }
    }
}

