package com.org.report_generator.service;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Pool for reusing BrowserContext instances to improve PDF generation performance.
 * Contexts are stateless after page.close(), making them safe to reuse.
 */
@Component
public class BrowserContextPool {

    private static final Logger logger = LoggerFactory.getLogger(BrowserContextPool.class);
    private static final int DEFAULT_POOL_SIZE = 5;
    private static final long CONTEXT_TIMEOUT_SECONDS = 30;

    private final Browser browser;
    private final BlockingQueue<BrowserContext> availableContexts;
    private final AtomicInteger activeContexts = new AtomicInteger(0);
    private final int maxPoolSize;

    /**
     * Constructor for Spring dependency injection.
     * Spring will automatically inject the Browser bean.
     */
    @Autowired
    public BrowserContextPool(Browser browser) {
        this.browser = browser;
        this.maxPoolSize = DEFAULT_POOL_SIZE;
        this.availableContexts = new LinkedBlockingQueue<>(maxPoolSize);
        logger.info("BrowserContextPool initialized with max size: {}", maxPoolSize);
    }

    /**
     * Acquires a browser context from the pool, creating a new one if needed.
     * 
     * @return A browser context ready for use
     */
    public BrowserContext acquire() {
        BrowserContext context = availableContexts.poll();
        
        if (context != null) {
            // Reuse existing context
            activeContexts.incrementAndGet();
            logger.debug("Reusing browser context from pool. Active: {}", activeContexts.get());
            return context;
        }

        // Create new context if pool not at max capacity
        if (activeContexts.get() < maxPoolSize) {
            context = createNewContext();
            activeContexts.incrementAndGet();
            logger.debug("Created new browser context. Active: {}", activeContexts.get());
            return context;
        }

        // Pool is full, wait for available context or create temporary one
        try {
            context = availableContexts.poll(CONTEXT_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (context != null) {
                activeContexts.incrementAndGet();
                logger.debug("Acquired browser context after wait. Active: {}", activeContexts.get());
                return context;
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            logger.warn("Interrupted while waiting for browser context", e);
        }

        // Fallback: create temporary context if pool is exhausted
        logger.warn("Pool exhausted, creating temporary context");
        return createNewContext();
    }

    /**
     * Returns a browser context to the pool for reuse.
     * 
     * @param context The context to return (must have all pages closed)
     */
    public void release(BrowserContext context) {
        if (context == null) {
            return;
        }

        try {
            // Ensure context is clean (all pages closed)
            if (context.pages().isEmpty()) {
                if (availableContexts.offer(context)) {
                    activeContexts.decrementAndGet();
                    logger.debug("Returned browser context to pool. Active: {}", activeContexts.get());
                } else {
                    // Pool is full, close the context
                    context.close();
                    activeContexts.decrementAndGet();
                    logger.debug("Pool full, closed browser context. Active: {}", activeContexts.get());
                }
            } else {
                // Context has open pages, close it instead of returning to pool
                logger.warn("Context has open pages, closing instead of returning to pool");
                context.close();
                activeContexts.decrementAndGet();
            }
        } catch (Exception e) {
            logger.error("Error releasing browser context to pool", e);
            try {
                context.close();
            } catch (Exception closeEx) {
                logger.error("Error closing browser context", closeEx);
            }
            activeContexts.decrementAndGet();
        }
    }

    private BrowserContext createNewContext() {
        return browser.newContext(new Browser.NewContextOptions()
                .setViewportSize(1920, 1080) // Default, will be overridden
                .setDeviceScaleFactor(1.0));
    }

    /**
     * Closes all contexts in the pool. Should be called during shutdown.
     */
    public void closeAll() {
        logger.info("Closing all browser contexts in pool");
        BrowserContext context;
        while ((context = availableContexts.poll()) != null) {
            try {
                context.close();
            } catch (Exception e) {
                logger.error("Error closing browser context during pool shutdown", e);
            }
        }
        activeContexts.set(0);
    }

    /**
     * Returns the number of active contexts (in use or in pool).
     */
    public int getActiveContexts() {
        return activeContexts.get();
    }

    /**
     * Returns the number of available contexts in the pool.
     */
    public int getAvailableContexts() {
        return availableContexts.size();
    }
}

