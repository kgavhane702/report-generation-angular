package com.org.report_generator.config;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.*;

class PlaywrightPropertiesTest {

    @Test
    void defaultValues_areSet() {
        PlaywrightProperties props = new PlaywrightProperties();

        assertThat(props.getExecutablePath()).isEqualTo("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe");
        assertThat(props.getArgs()).contains("--headless=new", "--no-sandbox");
    }

    @Test
    void setExecutablePath_updatesPath() {
        PlaywrightProperties props = new PlaywrightProperties();
        props.setExecutablePath("/usr/bin/chromium");

        assertThat(props.getExecutablePath()).isEqualTo("/usr/bin/chromium");
    }

    @Test
    void setArgs_updatesArgs() {
        PlaywrightProperties props = new PlaywrightProperties();
        props.setArgs(List.of("--headless", "--custom-arg"));

        assertThat(props.getArgs()).containsExactly("--headless", "--custom-arg");
    }

    @Test
    void defaultArgs_containsAllExpectedFlags() {
        PlaywrightProperties props = new PlaywrightProperties();
        List<String> args = props.getArgs();

        assertThat(args).contains(
                "--headless=new",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--disable-gpu"
        );
    }
}
