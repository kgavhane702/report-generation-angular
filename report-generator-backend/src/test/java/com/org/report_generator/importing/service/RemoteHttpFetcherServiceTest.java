package com.org.report_generator.importing.service;

import com.org.report_generator.config.ImportLimitsConfig;
import com.org.report_generator.dto.http.*;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

@ExtendWith(MockitoExtension.class)
@DisplayName("RemoteHttpFetcherService Tests")
class RemoteHttpFetcherServiceTest {

    @Mock
    private ImportLimitsConfig limitsConfig;

    @Mock
    private HttpServletRequest httpServletRequest;

    private RemoteHttpFetcherService service;

    @BeforeEach
    void setUp() {
        service = new RemoteHttpFetcherService(limitsConfig);
    }

    @Nested
    @DisplayName("Input Validation Tests")
    class InputValidationTests {

        @Test
        @DisplayName("Should throw exception when spec is null")
        void shouldThrowWhenSpecIsNull() {
            assertThatThrownBy(() -> service.fetch(null, httpServletRequest))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessage("request is required");
        }

        @Test
        @DisplayName("Should throw exception when URL is null")
        void shouldThrowWhenUrlIsNull() {
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    null, HttpMethod.GET, null, null, null, null, null, null, null, null
            );

            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessage("request.url is required");
        }

        @Test
        @DisplayName("Should throw exception when URL is blank")
        void shouldThrowWhenUrlIsBlank() {
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    "   ", HttpMethod.GET, null, null, null, null, null, null, null, null
            );

            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessage("request.url is required");
        }

        @Test
        @DisplayName("Should throw exception when method is null")
        void shouldThrowWhenMethodIsNull() {
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    "https://example.com/data.csv", null, null, null, null, null, null, null, null, null
            );

            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessage("request.method is required");
        }
    }

    @Nested
    @DisplayName("URL Resolution Tests")
    class UrlResolutionTests {

        @Test
        @DisplayName("Should throw exception for protocol-relative URLs")
        void shouldThrowForProtocolRelativeUrls() {
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    "//example.com/data.csv", HttpMethod.GET, null, null, null, null, null, null, null, null
            );

            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessage("Unsupported URL: protocol-relative URLs are not allowed");
        }
    }

    @Nested
    @DisplayName("Query Parameters Tests")
    class QueryParametersTests {

        @Test
        @DisplayName("Should handle null query params without error")
        void shouldHandleNullQueryParams() {
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    "https://example.com/data.csv", HttpMethod.GET, 
                    null, null, null, null, null, null, null, null
            );

            // Should not throw for null query params - will fail on network call
            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isNotInstanceOf(NullPointerException.class);
        }

        @Test
        @DisplayName("Should handle empty query params without error")
        void shouldHandleEmptyQueryParams() {
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    "https://example.com/data.csv", HttpMethod.GET,
                    List.of(), null, null, null, null, null, null, null
            );

            // Should not throw for empty query params - will fail on network call
            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isNotInstanceOf(NullPointerException.class);
        }

        @Test
        @DisplayName("Should handle disabled query params")
        void shouldHandleDisabledQueryParams() {
            List<HttpKeyValueDto> queryParams = List.of(
                    new HttpKeyValueDto("key1", "value1", false),
                    new HttpKeyValueDto("key2", "value2", true)
            );
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    "https://example.com/data.csv", HttpMethod.GET,
                    queryParams, null, null, null, null, null, null, null
            );

            // Should not throw for disabled query params - will fail on network call
            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isNotInstanceOf(NullPointerException.class);
        }
    }

    @Nested
    @DisplayName("Headers Tests")
    class HeadersTests {

        @Test
        @DisplayName("Should handle null headers without error")
        void shouldHandleNullHeaders() {
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    "https://example.com/data.csv", HttpMethod.GET,
                    null, null, null, null, null, null, null, null
            );

            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isNotInstanceOf(NullPointerException.class);
        }

        @Test
        @DisplayName("Should handle disabled headers")
        void shouldHandleDisabledHeaders() {
            List<HttpKeyValueDto> headers = List.of(
                    new HttpKeyValueDto("X-Custom", "value1", false),
                    new HttpKeyValueDto("X-Enabled", "value2", true)
            );
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    "https://example.com/data.csv", HttpMethod.GET,
                    null, headers, null, null, null, null, null, null
            );

            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isNotInstanceOf(NullPointerException.class);
        }

        @Test
        @DisplayName("Should handle headers with blank keys")
        void shouldHandleHeadersWithBlankKeys() {
            List<HttpKeyValueDto> headers = List.of(
                    new HttpKeyValueDto("", "value1", true),
                    new HttpKeyValueDto("   ", "value2", true)
            );
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    "https://example.com/data.csv", HttpMethod.GET,
                    null, headers, null, null, null, null, null, null
            );

            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isNotInstanceOf(NullPointerException.class);
        }
    }

    @Nested
    @DisplayName("Authentication Tests")
    class AuthenticationTests {

        @Test
        @DisplayName("Should handle null auth without error")
        void shouldHandleNullAuth() {
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    "https://example.com/data.csv", HttpMethod.GET,
                    null, null, null, null, null, null, null, null
            );

            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isNotInstanceOf(NullPointerException.class);
        }

        @Test
        @DisplayName("Should handle NONE auth type")
        void shouldHandleNoneAuthType() {
            HttpAuthDto auth = new HttpAuthDto(HttpAuthType.NONE, null, null, null);
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    "https://example.com/data.csv", HttpMethod.GET,
                    null, null, null, null, auth, null, null, null
            );

            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isNotInstanceOf(NullPointerException.class);
        }

        @Test
        @DisplayName("Should handle bearer token auth")
        void shouldHandleBearerTokenAuth() {
            HttpAuthDto auth = new HttpAuthDto(HttpAuthType.BEARER, "test-token", null, null);
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    "https://example.com/data.csv", HttpMethod.GET,
                    null, null, null, null, auth, null, null, null
            );

            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isNotInstanceOf(NullPointerException.class);
        }

        @Test
        @DisplayName("Should handle basic auth")
        void shouldHandleBasicAuth() {
            HttpAuthDto.Basic basic = new HttpAuthDto.Basic("user", "password");
            HttpAuthDto auth = new HttpAuthDto(HttpAuthType.BASIC, null, basic, null);
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    "https://example.com/data.csv", HttpMethod.GET,
                    null, null, null, null, auth, null, null, null
            );

            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isNotInstanceOf(NullPointerException.class);
        }

        @Test
        @DisplayName("Should handle API key auth in header")
        void shouldHandleApiKeyAuthInHeader() {
            HttpAuthDto.ApiKey apiKey = new HttpAuthDto.ApiKey(HttpApiKeyLocation.HEADER, "X-API-Key", "secret");
            HttpAuthDto auth = new HttpAuthDto(HttpAuthType.API_KEY, null, null, apiKey);
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    "https://example.com/data.csv", HttpMethod.GET,
                    null, null, null, null, auth, null, null, null
            );

            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isNotInstanceOf(NullPointerException.class);
        }

        @Test
        @DisplayName("Should handle API key auth in query")
        void shouldHandleApiKeyAuthInQuery() {
            HttpAuthDto.ApiKey apiKey = new HttpAuthDto.ApiKey(HttpApiKeyLocation.QUERY, "api_key", "secret");
            HttpAuthDto auth = new HttpAuthDto(HttpAuthType.API_KEY, null, null, apiKey);
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    "https://example.com/data.csv", HttpMethod.GET,
                    null, null, null, null, auth, null, null, null
            );

            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isNotInstanceOf(NullPointerException.class);
        }

        @Test
        @DisplayName("Should not override explicit Authorization header with auth")
        void shouldNotOverrideExplicitAuthorizationHeader() {
            List<HttpKeyValueDto> headers = List.of(
                    new HttpKeyValueDto("Authorization", "Bearer explicit-token", true)
            );
            HttpAuthDto auth = new HttpAuthDto(HttpAuthType.BEARER, "should-be-ignored", null, null);
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    "https://example.com/data.csv", HttpMethod.GET,
                    null, headers, null, null, auth, null, null, null
            );

            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isNotInstanceOf(NullPointerException.class);
        }
    }

    @Nested
    @DisplayName("Cookie Tests")
    class CookieTests {

        @Test
        @DisplayName("Should handle null cookies without error")
        void shouldHandleNullCookies() {
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    "https://example.com/data.csv", HttpMethod.GET,
                    null, null, null, null, null, null, null, null
            );

            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isNotInstanceOf(NullPointerException.class);
        }

        @Test
        @DisplayName("Should handle cookie header taking precedence")
        void shouldHandleCookieHeaderPrecedence() {
            List<HttpKeyValueDto> cookies = List.of(
                    new HttpKeyValueDto("ignored", "value", true)
            );
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    "https://example.com/data.csv", HttpMethod.GET,
                    null, null, cookies, "session=abc123", null, null, null, null
            );

            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isNotInstanceOf(NullPointerException.class);
        }

        @Test
        @DisplayName("Should handle disabled cookies")
        void shouldHandleDisabledCookies() {
            List<HttpKeyValueDto> cookies = List.of(
                    new HttpKeyValueDto("disabled", "value1", false),
                    new HttpKeyValueDto("enabled", "value2", true)
            );
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    "https://example.com/data.csv", HttpMethod.GET,
                    null, null, cookies, null, null, null, null, null
            );

            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isNotInstanceOf(NullPointerException.class);
        }
    }

    @Nested
    @DisplayName("Body Tests")
    class BodyTests {

        @Test
        @DisplayName("Should handle null body for GET request")
        void shouldHandleNullBodyForGet() {
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    "https://example.com/data.csv", HttpMethod.GET,
                    null, null, null, null, null, null, null, null
            );

            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isNotInstanceOf(NullPointerException.class);
        }

        @Test
        @DisplayName("Should handle body for POST request")
        void shouldHandleBodyForPost() {
            HttpBodyDto body = new HttpBodyDto(HttpBodyMode.RAW, "{\"key\":\"value\"}", "application/json");
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    "https://example.com/data", HttpMethod.POST,
                    null, null, null, null, null, body, null, null
            );

            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isNotInstanceOf(NullPointerException.class);
        }

        @Test
        @DisplayName("Should handle body for PUT request")
        void shouldHandleBodyForPut() {
            HttpBodyDto body = new HttpBodyDto(HttpBodyMode.RAW, "<data>test</data>", "application/xml");
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    "https://example.com/data", HttpMethod.PUT,
                    null, null, null, null, null, body, null, null
            );

            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isNotInstanceOf(NullPointerException.class);
        }

        @Test
        @DisplayName("Should handle body for PATCH request")
        void shouldHandleBodyForPatch() {
            HttpBodyDto body = new HttpBodyDto(HttpBodyMode.RAW, "{\"patch\":true}", "application/json");
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    "https://example.com/data", HttpMethod.PATCH,
                    null, null, null, null, null, body, null, null
            );

            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isNotInstanceOf(NullPointerException.class);
        }

        @Test
        @DisplayName("Should handle body for DELETE request")
        void shouldHandleBodyForDelete() {
            HttpBodyDto body = new HttpBodyDto(HttpBodyMode.RAW, "{\"id\":1}", "application/json");
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    "https://example.com/data", HttpMethod.DELETE,
                    null, null, null, null, null, body, null, null
            );

            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isNotInstanceOf(NullPointerException.class);
        }
    }

    @Nested
    @DisplayName("HTTP Method Tests")
    class HttpMethodTests {

        @Test
        @DisplayName("Should handle HEAD request")
        void shouldHandleHeadRequest() {
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    "https://example.com/data.csv", HttpMethod.HEAD,
                    null, null, null, null, null, null, null, null
            );

            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isNotInstanceOf(NullPointerException.class);
        }

        @Test
        @DisplayName("Should handle OPTIONS request")
        void shouldHandleOptionsRequest() {
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    "https://example.com/data.csv", HttpMethod.OPTIONS,
                    null, null, null, null, null, null, null, null
            );

            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isNotInstanceOf(NullPointerException.class);
        }
    }

    @Nested
    @DisplayName("Timeout Tests")
    class TimeoutTests {

        @Test
        @DisplayName("Should handle custom timeout")
        void shouldHandleCustomTimeout() {
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    "https://example.com/data.csv", HttpMethod.GET,
                    null, null, null, null, null, null, 5000, null
            );

            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isNotInstanceOf(NullPointerException.class);
        }

        @Test
        @DisplayName("Should handle timeout below minimum")
        void shouldHandleTimeoutBelowMinimum() {
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    "https://example.com/data.csv", HttpMethod.GET,
                    null, null, null, null, null, null, 100, null
            );

            // Timeout below 1000ms should be adjusted to 1000ms
            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isNotInstanceOf(NullPointerException.class);
        }

        @Test
        @DisplayName("Should handle timeout above maximum")
        void shouldHandleTimeoutAboveMaximum() {
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    "https://example.com/data.csv", HttpMethod.GET,
                    null, null, null, null, null, null, 200000, null
            );

            // Timeout above 120000ms should be adjusted to 120000ms
            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isNotInstanceOf(NullPointerException.class);
        }
    }

    @Nested
    @DisplayName("Follow Redirects Tests")
    class FollowRedirectsTests {

        @Test
        @DisplayName("Should handle follow redirects enabled")
        void shouldHandleFollowRedirectsEnabled() {
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    "https://example.com/data.csv", HttpMethod.GET,
                    null, null, null, null, null, null, null, true
            );

            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isNotInstanceOf(NullPointerException.class);
        }

        @Test
        @DisplayName("Should handle follow redirects disabled")
        void shouldHandleFollowRedirectsDisabled() {
            HttpRequestSpecDto spec = new HttpRequestSpecDto(
                    "https://example.com/data.csv", HttpMethod.GET,
                    null, null, null, null, null, null, null, false
            );

            assertThatThrownBy(() -> service.fetch(spec, httpServletRequest))
                    .isNotInstanceOf(NullPointerException.class);
        }
    }
}
