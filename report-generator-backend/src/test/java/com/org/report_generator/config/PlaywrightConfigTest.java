package com.org.report_generator.config;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Playwright;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.mockito.MockedStatic;
import org.mockito.Mockito;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@DisplayName("PlaywrightConfig Tests")
class PlaywrightConfigTest {

    @Test
    @DisplayName("destroy handles null browser and playwright gracefully")
    void destroy_handlesNullGracefully() {
        PlaywrightConfig config = new PlaywrightConfig();

        // Should not throw when browser and playwright are null
        assertThatCode(() -> config.destroy()).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("createPlaywright delegates to Playwright.create")
    void createPlaywright_delegatesToPlaywrightCreate() {
        Playwright mockPlaywright = mock(Playwright.class);

        try (MockedStatic<Playwright> mocked = Mockito.mockStatic(Playwright.class)) {
            mocked.when(Playwright::create).thenReturn(mockPlaywright);

            PlaywrightConfig config = new PlaywrightConfig();
            Playwright created = config.createPlaywright();

            assertThat(created).isSameAs(mockPlaywright);
            mocked.verify(Playwright::create);
        }
    }

    @Test
    @DisplayName("playwright() uses factory method and stores instance")
    void playwright_usesFactoryMethod_andStoresInstance() {
        Playwright mockPlaywright = Mockito.mock(Playwright.class);

        PlaywrightConfig config = new PlaywrightConfig() {
            @Override
            Playwright createPlaywright() {
                return mockPlaywright;
            }
        };

        Playwright returned = config.playwright();

        assertThat(returned).isSameAs(mockPlaywright);
    }

    @Test
    @DisplayName("browser() launches chromium using provided props")
    void browser_launchesChromium_withProps() {
        Playwright mockPlaywright = mock(Playwright.class);
        BrowserType mockBrowserType = mock(BrowserType.class);
        Browser mockBrowser = mock(Browser.class);

        when(mockPlaywright.chromium()).thenReturn(mockBrowserType);
        when(mockBrowserType.launch(any(BrowserType.LaunchOptions.class))).thenReturn(mockBrowser);

        PlaywrightProperties props = new PlaywrightProperties();
        props.setExecutablePath("C:\\path\\to\\browser.exe");
        props.setArgs(java.util.List.of("--headless"));

        PlaywrightConfig config = new PlaywrightConfig() {
            @Override
            Playwright createPlaywright() {
                throw new AssertionError("createPlaywright should not be called in this test");
            }
        };

        Browser returned = config.browser(mockPlaywright, props);

        assertThat(returned).isSameAs(mockBrowser);
        verify(mockPlaywright).chromium();
        verify(mockBrowserType).launch(any(BrowserType.LaunchOptions.class));
    }

    @Test
    @DisplayName("destroy closes browser then playwright")
    void destroy_closesBrowserThenPlaywright() {
        Playwright mockPlaywright = mock(Playwright.class);
        BrowserType mockBrowserType = mock(BrowserType.class);
        Browser mockBrowser = mock(Browser.class);

        when(mockPlaywright.chromium()).thenReturn(mockBrowserType);
        when(mockBrowserType.launch(any(BrowserType.LaunchOptions.class))).thenReturn(mockBrowser);

        PlaywrightProperties props = new PlaywrightProperties();
        props.setExecutablePath("C:\\path\\to\\browser.exe");
        props.setArgs(java.util.List.of("--headless"));

        PlaywrightConfig config = new PlaywrightConfig() {
            @Override
            Playwright createPlaywright() {
                return mockPlaywright;
            }
        };

        config.playwright();
        config.browser(mockPlaywright, props);
        config.destroy();

        InOrder inOrder = inOrder(mockBrowser, mockPlaywright);
        inOrder.verify(mockBrowser).close();
        inOrder.verify(mockPlaywright).close();
    }

    @Test
    @DisplayName("PlaywrightConfig implements DisposableBean")
    void implementsDisposableBean() {
        PlaywrightConfig config = new PlaywrightConfig();

        assertThat(config).isInstanceOf(org.springframework.beans.factory.DisposableBean.class);
    }
}
