package com.org.report_generator.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Configuration
@EnableConfigurationProperties(ExportPerformanceProperties.class)
public class ExportPerformanceConfig {

    @Bean(destroyMethod = "shutdown")
    public ExecutorService htmlRenderExecutor(ExportPerformanceProperties props) {
        int requested = props.getHtmlRenderThreads();
        int cores = Runtime.getRuntime().availableProcessors();
        int threads = requested > 0 ? requested : Math.min(4, Math.max(1, cores));
        return Executors.newFixedThreadPool(threads, r -> {
            Thread t = new Thread(r);
            t.setName("html-render-" + t.getId());
            t.setDaemon(true);
            return t;
        });
    }
}


