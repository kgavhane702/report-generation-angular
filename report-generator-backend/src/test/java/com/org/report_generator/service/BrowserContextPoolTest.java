package com.org.report_generator.service;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BrowserContextPoolTest {

    @Mock
    private Browser browser;

    @Mock
    private BrowserContext browserContext;

    @Test
    void acquire_createsNewContext_whenPoolEmpty() {
        when(browser.newContext(any(Browser.NewContextOptions.class))).thenReturn(browserContext);
        BrowserContextPool pool = new BrowserContextPool(browser);

        BrowserContext result = pool.acquire();

        assertNotNull(result);
        assertEquals(browserContext, result);
    }

    @Test
    void acquire_reusesContext_whenReturnedToPool() {
        when(browser.newContext(any(Browser.NewContextOptions.class))).thenReturn(browserContext);
        when(browserContext.pages()).thenReturn(Collections.emptyList());
        BrowserContextPool pool = new BrowserContextPool(browser);

        BrowserContext first = pool.acquire();
        pool.release(first);
        BrowserContext second = pool.acquire();

        assertNotNull(second);
        assertEquals(browserContext, second);
    }

    @Test
    void release_nullContext_doesNothing() {
        when(browser.newContext(any(Browser.NewContextOptions.class))).thenReturn(browserContext);
        BrowserContextPool pool = new BrowserContextPool(browser);

        pool.release(null);
        assertEquals(0, pool.getActiveContexts());
    }

    @Test
    void release_contextWithOpenPages_closesContext() {
        when(browser.newContext(any(Browser.NewContextOptions.class))).thenReturn(browserContext);
        when(browserContext.pages()).thenReturn(Collections.singletonList(mock(com.microsoft.playwright.Page.class)));
        BrowserContextPool pool = new BrowserContextPool(browser);

        pool.acquire();
        pool.release(browserContext);

        verify(browserContext).close();
    }

    @Test
    void release_cleanContext_returnsToPool() {
        when(browser.newContext(any(Browser.NewContextOptions.class))).thenReturn(browserContext);
        when(browserContext.pages()).thenReturn(Collections.emptyList());
        BrowserContextPool pool = new BrowserContextPool(browser);

        pool.acquire();
        pool.release(browserContext);

        assertEquals(1, pool.getAvailableContexts());
    }

    @Test
    void getActiveContexts_returnsCorrectCount() {
        when(browser.newContext(any(Browser.NewContextOptions.class))).thenReturn(browserContext);
        BrowserContextPool pool = new BrowserContextPool(browser);

        assertEquals(0, pool.getActiveContexts());
        pool.acquire();
        assertEquals(1, pool.getActiveContexts());
    }

    @Test
    void getAvailableContexts_returnsCorrectCount() {
        when(browser.newContext(any(Browser.NewContextOptions.class))).thenReturn(browserContext);
        when(browserContext.pages()).thenReturn(Collections.emptyList());
        BrowserContextPool pool = new BrowserContextPool(browser);

        assertEquals(0, pool.getAvailableContexts());
        pool.acquire();
        pool.release(browserContext);
        assertEquals(1, pool.getAvailableContexts());
    }

    @Test
    void closeAll_closesAllContextsInPool() {
        when(browser.newContext(any(Browser.NewContextOptions.class))).thenReturn(browserContext);
        when(browserContext.pages()).thenReturn(Collections.emptyList());
        BrowserContextPool pool = new BrowserContextPool(browser);

        pool.acquire();
        pool.release(browserContext);
        pool.closeAll();

        verify(browserContext).close();
        assertEquals(0, pool.getActiveContexts());
        assertEquals(0, pool.getAvailableContexts());
    }

    @Test
    void acquire_poolExhausted_createsTemporaryContext() {
        BrowserContext context1 = mock(BrowserContext.class);
        BrowserContext context2 = mock(BrowserContext.class);
        BrowserContext context3 = mock(BrowserContext.class);
        BrowserContext context4 = mock(BrowserContext.class);
        BrowserContext context5 = mock(BrowserContext.class);
        BrowserContext context6 = mock(BrowserContext.class);
        
        when(browser.newContext(any(Browser.NewContextOptions.class)))
            .thenReturn(context1, context2, context3, context4, context5, context6);
        
        BrowserContextPool pool = new BrowserContextPool(browser);

        // Acquire all 5 contexts (default pool size)
        pool.acquire();
        pool.acquire();
        pool.acquire();
        pool.acquire();
        pool.acquire();
        
        assertEquals(5, pool.getActiveContexts());
        
        // Acquire one more - should create temporary context after timeout
        BrowserContext result = pool.acquire();
        
        assertNotNull(result);
        assertEquals(6, pool.getActiveContexts());
    }

    @Test
    void acquire_interrupted_createsTemporaryContext() throws Exception {
        BrowserContext context1 = mock(BrowserContext.class);
        BrowserContext context2 = mock(BrowserContext.class);
        BrowserContext context3 = mock(BrowserContext.class);
        BrowserContext context4 = mock(BrowserContext.class);
        BrowserContext context5 = mock(BrowserContext.class);
        BrowserContext tempContext = mock(BrowserContext.class);
        
        when(browser.newContext(any(Browser.NewContextOptions.class)))
            .thenReturn(context1, context2, context3, context4, context5, tempContext);
        
        BrowserContextPool pool = new BrowserContextPool(browser);

        // Fill up the pool
        pool.acquire();
        pool.acquire();
        pool.acquire();
        pool.acquire();
        pool.acquire();
        
        // Interrupt the current thread before acquiring
        Thread.currentThread().interrupt();
        
        // This should handle interruption and create temporary context
        BrowserContext result = pool.acquire();
        
        assertNotNull(result);
        // Clear interrupt flag
        assertTrue(Thread.interrupted());
    }

    @Test
    void acquire_waitForContext_acquiresAfterRelease() throws Exception {
        BrowserContext context1 = mock(BrowserContext.class);
        BrowserContext context2 = mock(BrowserContext.class);
        BrowserContext context3 = mock(BrowserContext.class);
        BrowserContext context4 = mock(BrowserContext.class);
        BrowserContext context5 = mock(BrowserContext.class);
        
        when(browser.newContext(any(Browser.NewContextOptions.class)))
            .thenReturn(context1, context2, context3, context4, context5);
        when(context1.pages()).thenReturn(Collections.emptyList());
        
        BrowserContextPool pool = new BrowserContextPool(browser);

        // Fill up the pool
        BrowserContext first = pool.acquire();
        pool.acquire();
        pool.acquire();
        pool.acquire();
        pool.acquire();
        
        assertEquals(5, pool.getActiveContexts());
        
        // Release one context in a separate thread
        Thread releaseThread = new Thread(() -> {
            try {
                Thread.sleep(100);
                pool.release(first);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        });
        releaseThread.start();
        
        // Acquire should wait and get the released context
        BrowserContext result = pool.acquire();
        
        releaseThread.join();
        assertNotNull(result);
        assertEquals(context1, result);
    }
}
