package com.org.report_generator.dto.http;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("HTTP DTO Tests")
class HttpDtoTests {

    @Nested
    @DisplayName("HttpRequestSpecDto Tests")
    class HttpRequestSpecDtoTest {

        @Test
        @DisplayName("Record fields are accessible")
        void recordFieldsAreAccessible() {
            HttpRequestSpecDto dto = new HttpRequestSpecDto(
                "https://api.example.com/data",
                HttpMethod.GET,
                null, null, null, null, null, null, 5000, true
            );

            assertThat(dto.url()).isEqualTo("https://api.example.com/data");
            assertThat(dto.method()).isEqualTo(HttpMethod.GET);
            assertThat(dto.timeoutMs()).isEqualTo(5000);
            assertThat(dto.followRedirects()).isTrue();
        }

        @Test
        @DisplayName("Minimal constructor with nulls")
        void minimalConstructorWithNulls() {
            HttpRequestSpecDto dto = new HttpRequestSpecDto(
                "https://example.com",
                HttpMethod.GET,
                null, null, null, null, null, null, null, null
            );

            assertThat(dto.url()).isEqualTo("https://example.com");
            assertThat(dto.method()).isEqualTo(HttpMethod.GET);
            assertThat(dto.queryParams()).isNull();
            assertThat(dto.headers()).isNull();
        }
    }

    @Nested
    @DisplayName("HttpMethod Enum Tests")
    class HttpMethodTest {

        @Test
        @DisplayName("All HTTP methods exist")
        void allHttpMethodsExist() {
            assertThat(HttpMethod.values()).containsExactlyInAnyOrder(
                HttpMethod.GET,
                HttpMethod.POST,
                HttpMethod.PUT,
                HttpMethod.DELETE,
                HttpMethod.PATCH,
                HttpMethod.HEAD,
                HttpMethod.OPTIONS
            );
        }

        @Test
        @DisplayName("valueOf works correctly")
        void valueOfWorksCorrectly() {
            assertThat(HttpMethod.valueOf("GET")).isEqualTo(HttpMethod.GET);
            assertThat(HttpMethod.valueOf("POST")).isEqualTo(HttpMethod.POST);
        }
    }

    @Nested
    @DisplayName("HttpAuthDto Tests")
    class HttpAuthDtoTest {

        @Test
        @DisplayName("Basic auth configuration")
        void basicAuthConfiguration() {
            HttpAuthDto.Basic basic = new HttpAuthDto.Basic("username", "password");
            HttpAuthDto auth = new HttpAuthDto(HttpAuthType.BASIC, null, basic, null);

            assertThat(auth.type()).isEqualTo(HttpAuthType.BASIC);
            assertThat(auth.basic()).isNotNull();
            assertThat(auth.basic().username()).isEqualTo("username");
            assertThat(auth.basic().password()).isEqualTo("password");
        }

        @Test
        @DisplayName("Bearer token configuration")
        void bearerTokenConfiguration() {
            HttpAuthDto auth = new HttpAuthDto(HttpAuthType.BEARER, "jwt-token-here", null, null);

            assertThat(auth.type()).isEqualTo(HttpAuthType.BEARER);
            assertThat(auth.bearerToken()).isEqualTo("jwt-token-here");
        }

        @Test
        @DisplayName("API Key configuration")
        void apiKeyConfiguration() {
            HttpAuthDto.ApiKey apiKey = new HttpAuthDto.ApiKey(
                HttpApiKeyLocation.HEADER, "X-API-Key", "secret"
            );
            HttpAuthDto auth = new HttpAuthDto(HttpAuthType.API_KEY, null, null, apiKey);

            assertThat(auth.type()).isEqualTo(HttpAuthType.API_KEY);
            assertThat(auth.apiKey()).isNotNull();
            assertThat(auth.apiKey().name()).isEqualTo("X-API-Key");
            assertThat(auth.apiKey().value()).isEqualTo("secret");
            assertThat(auth.apiKey().location()).isEqualTo(HttpApiKeyLocation.HEADER);
        }
    }

    @Nested
    @DisplayName("HttpAuthType Enum Tests")
    class HttpAuthTypeTest {

        @Test
        @DisplayName("All auth types exist")
        void allAuthTypesExist() {
            assertThat(HttpAuthType.values()).containsExactlyInAnyOrder(
                HttpAuthType.NONE,
                HttpAuthType.BASIC,
                HttpAuthType.BEARER,
                HttpAuthType.API_KEY
            );
        }
    }

    @Nested
    @DisplayName("HttpBodyDto Tests")
    class HttpBodyDtoTest {

        @Test
        @DisplayName("Raw body mode")
        void rawBodyMode() {
            HttpBodyDto body = new HttpBodyDto(HttpBodyMode.RAW, "{\"key\": \"value\"}", "application/json");

            assertThat(body.mode()).isEqualTo(HttpBodyMode.RAW);
            assertThat(body.raw()).isEqualTo("{\"key\": \"value\"}");
            assertThat(body.contentType()).isEqualTo("application/json");
        }

        @Test
        @DisplayName("None body mode")
        void noneBodyMode() {
            HttpBodyDto body = new HttpBodyDto(HttpBodyMode.NONE, null, null);

            assertThat(body.mode()).isEqualTo(HttpBodyMode.NONE);
        }
    }

    @Nested
    @DisplayName("HttpBodyMode Enum Tests")
    class HttpBodyModeTest {

        @Test
        @DisplayName("All body modes exist")
        void allBodyModesExist() {
            assertThat(HttpBodyMode.values()).containsExactlyInAnyOrder(
                HttpBodyMode.NONE,
                HttpBodyMode.RAW
            );
        }

        @ParameterizedTest
        @ValueSource(strings = {"none", "NONE", "None"})
        @DisplayName("fromWire handles none case-insensitively")
        void fromWireHandlesNoneCaseInsensitively(String value) {
            assertThat(HttpBodyMode.fromWire(value)).isEqualTo(HttpBodyMode.NONE);
        }

        @ParameterizedTest
        @ValueSource(strings = {"raw", "RAW", "Raw"})
        @DisplayName("fromWire handles raw case-insensitively")
        void fromWireHandlesRawCaseInsensitively(String value) {
            assertThat(HttpBodyMode.fromWire(value)).isEqualTo(HttpBodyMode.RAW);
        }

        @ParameterizedTest
        @NullAndEmptySource
        @DisplayName("fromWire returns null for null or empty")
        void fromWireReturnsNullForNullOrEmpty(String value) {
            assertThat(HttpBodyMode.fromWire(value)).isNull();
        }

        @Test
        @DisplayName("fromWire handles whitespace-only string")
        void fromWireHandlesWhitespaceOnlyString() {
            assertThat(HttpBodyMode.fromWire("   ")).isNull();
        }
    }

    @Nested
    @DisplayName("HttpKeyValueDto Tests")
    class HttpKeyValueDtoTest {

        @Test
        @DisplayName("Key value pair with enabled flag")
        void keyValuePairWithEnabledFlag() {
            HttpKeyValueDto dto = new HttpKeyValueDto("Content-Type", "application/json", true);

            assertThat(dto.key()).isEqualTo("Content-Type");
            assertThat(dto.value()).isEqualTo("application/json");
            assertThat(dto.enabled()).isTrue();
            assertThat(dto.isEnabled()).isTrue();
        }

        @Test
        @DisplayName("Disabled key value pair")
        void disabledKeyValuePair() {
            HttpKeyValueDto dto = new HttpKeyValueDto("X-Debug", "true", false);

            assertThat(dto.enabled()).isFalse();
            assertThat(dto.isEnabled()).isFalse();
        }

        @Test
        @DisplayName("Null enabled defaults to true via isEnabled")
        void nullEnabledDefaultsToTrue() {
            HttpKeyValueDto dto = new HttpKeyValueDto("Key", "Value", null);

            assertThat(dto.enabled()).isNull();
            assertThat(dto.isEnabled()).isTrue();
        }
    }

    @Nested
    @DisplayName("HttpApiKeyLocation Enum Tests")
    class HttpApiKeyLocationTest {

        @Test
        @DisplayName("All API key locations exist")
        void allApiKeyLocationsExist() {
            assertThat(HttpApiKeyLocation.values()).containsExactlyInAnyOrder(
                HttpApiKeyLocation.HEADER,
                HttpApiKeyLocation.QUERY
            );
        }
    }
}
