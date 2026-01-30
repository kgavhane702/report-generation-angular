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

    Playwright createPlaywright() {
        return Playwright.create();
    }

    @Bean
    public Playwright playwright() {
        this.playwright = createPlaywright();
        return this.playwright;
    }

    @Bean
    public Browser browser(Playwright playwright, PlaywrightProperties props) {
        this.playwright = playwright;
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

