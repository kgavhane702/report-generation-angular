package com.org.report_generator.importing.service;

import com.org.report_generator.dto.http.HttpAuthDto;
import com.org.report_generator.dto.http.HttpAuthType;
import com.org.report_generator.dto.http.HttpApiKeyLocation;
import com.org.report_generator.dto.http.HttpBodyDto;
import com.org.report_generator.dto.http.HttpBodyMode;
import com.org.report_generator.dto.http.HttpKeyValueDto;
import com.org.report_generator.dto.http.HttpRequestSpecDto;
import com.org.report_generator.config.ImportLimitsConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.io.InputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Fetch remote HTTP/HTTPS resources for import, enforcing size and timeout limits.
 *
 * NOTE: This currently allows any http/https URL (SSRF hardening can be added later).
 */
@Service
public class RemoteHttpFetcherService {

    private static final Logger logger = LoggerFactory.getLogger(RemoteHttpFetcherService.class);

    private final ImportLimitsConfig limitsConfig;

    public RemoteHttpFetcherService(ImportLimitsConfig limitsConfig) {
        this.limitsConfig = limitsConfig;
    }

    public RemoteHttpFetchResult fetch(HttpRequestSpecDto spec, HttpServletRequest incomingRequest) throws Exception {
        if (spec == null) {
            throw new IllegalArgumentException("request is required");
        }
        String url = safeTrim(spec.url());
        if (url == null || url.isBlank()) {
            throw new IllegalArgumentException("request.url is required");
        }

        URI resolved = resolveUrl(url, incomingRequest);
        URI withQuery = appendQueryParams(resolved, spec.queryParams(), spec.auth());

        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .followRedirects(Boolean.TRUE.equals(spec.followRedirects())
                        ? HttpClient.Redirect.NORMAL
                        : HttpClient.Redirect.NEVER)
                .build();

        Duration timeout = Duration.ofMillis(resolveTimeoutMs(spec.timeoutMs()));
        HttpRequest.Builder req = HttpRequest.newBuilder()
                .uri(withQuery)
                .timeout(timeout);

        // Headers (explicit)
        applyHeaders(req, spec.headers());

        // Auth (only if header not already set by user)
        applyAuth(req, spec.auth(), spec.headers());

        // Cookies
        applyCookies(req, spec.cookieHeader(), spec.cookies());

        // Body
        HttpRequest built = buildWithMethodAndBody(req, spec);

        logger.info("Remote fetch: {} {}", spec.method(), withQuery);
        HttpResponse<InputStream> resp = client.send(built, HttpResponse.BodyHandlers.ofInputStream());

        int status = resp.statusCode();
        if (status < 200 || status >= 300) {
            throw new IllegalArgumentException("Remote request failed with status " + status);
        }

        // Enforce size limit (best-effort pre-check)
        long maxBytes = limitsConfig.getMaxFileSizeBytes();
        Optional<String> contentLen = resp.headers().firstValue("Content-Length");
        if (contentLen.isPresent()) {
            try {
                long len = Long.parseLong(contentLen.get());
                if (len > maxBytes) {
                    throw new IllegalArgumentException("Remote resource exceeds max size: " + len + " bytes > " + maxBytes + " bytes");
                }
            } catch (NumberFormatException ignored) {
            }
        }

        byte[] bytes;
        try (InputStream in = resp.body()) {
            int limit = (int) Math.min(maxBytes + 1, Integer.MAX_VALUE);
            bytes = in.readNBytes(limit);
        }
        if (bytes.length > maxBytes) {
            throw new IllegalArgumentException("Remote resource exceeds max size: > " + maxBytes + " bytes");
        }

        String contentType = resp.headers().firstValue("Content-Type").orElse(null);
        String fileName = resolveFilename(resp.headers().map(), withQuery.toString());

        return new RemoteHttpFetchResult(withQuery.toString(), contentType, fileName, bytes);
    }

    private static String safeTrim(String s) {
        return s == null ? null : s.trim();
    }

    private static int resolveTimeoutMs(Integer timeoutMs) {
        int ms = timeoutMs == null ? 20_000 : timeoutMs;
        if (ms < 1_000) ms = 1_000;
        if (ms > 120_000) ms = 120_000;
        return ms;
    }

    private static URI resolveUrl(String url, HttpServletRequest req) {
        String trimmed = url.trim();
        // Absolute
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            return URI.create(trimmed);
        }
        // Reject protocol-relative //example.com
        if (trimmed.startsWith("//")) {
            throw new IllegalArgumentException("Unsupported URL: protocol-relative URLs are not allowed");
        }

        String base = resolveBaseUrl(req);
        String path = trimmed.startsWith("/") ? trimmed : "/" + trimmed;
        return URI.create(base + path);
    }

    private static String resolveBaseUrl(HttpServletRequest req) {
        if (req == null) {
            // Fallback (dev). Caller should pass request.
            return "http://localhost:8080";
        }
        String proto = firstHeader(req, "X-Forwarded-Proto").orElse(req.getScheme());
        String host = firstHeader(req, "X-Forwarded-Host").orElse(req.getServerName());
        String portHeader = firstHeader(req, "X-Forwarded-Port").orElse(null);
        int port = req.getServerPort();

        // X-Forwarded-Host can include port already (host:port)
        boolean hostHasPort = host != null && host.contains(":");
        if (portHeader != null) {
            try {
                port = Integer.parseInt(portHeader);
            } catch (NumberFormatException ignored) {
            }
        }

        StringBuilder sb = new StringBuilder();
        sb.append(proto).append("://").append(host);
        if (!hostHasPort && port > 0 && port != 80 && port != 443) {
            sb.append(":").append(port);
        }
        return sb.toString();
    }

    private static Optional<String> firstHeader(HttpServletRequest req, String name) {
        String v = req.getHeader(name);
        if (v == null || v.isBlank()) return Optional.empty();
        // Some proxies provide comma-separated list.
        String first = v.split(",")[0].trim();
        return first.isBlank() ? Optional.empty() : Optional.of(first);
    }

    private static URI appendQueryParams(URI base, List<HttpKeyValueDto> queryParams, HttpAuthDto auth) {
        List<HttpKeyValueDto> effective = new ArrayList<>();
        if (queryParams != null) {
            for (HttpKeyValueDto kv : queryParams) {
                if (kv != null && kv.isEnabled() && kv.key() != null && !kv.key().isBlank()) {
                    effective.add(kv);
                }
            }
        }

        // API key in query
        if (auth != null && auth.type() == HttpAuthType.API_KEY && auth.apiKey() != null && auth.apiKey().location() != null) {
            if (auth.apiKey().location() == HttpApiKeyLocation.QUERY) {
                String k = auth.apiKey().name();
                String v = auth.apiKey().value();
                if (k != null && !k.isBlank() && v != null) {
                    effective.add(new HttpKeyValueDto(k, v, true));
                }
            }
        }

        String rawQuery = base.getRawQuery(); // already encoded
        StringBuilder q = new StringBuilder(rawQuery == null ? "" : rawQuery);

        for (HttpKeyValueDto kv : effective) {
            if (q.length() > 0) q.append("&");
            q.append(urlEncode(kv.key()));
            q.append("=");
            q.append(urlEncode(kv.value() == null ? "" : kv.value()));
        }

        String baseNoQuery = base.getScheme() + "://" + base.getRawAuthority() + base.getRawPath();
        String fragment = base.getRawFragment();
        String out = baseNoQuery + (q.length() > 0 ? "?" + q : "") + (fragment != null ? "#" + fragment : "");
        return URI.create(out);
    }

    private static String urlEncode(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    private static void applyHeaders(HttpRequest.Builder req, List<HttpKeyValueDto> headers) {
        if (headers == null) return;
        for (HttpKeyValueDto h : headers) {
            if (h == null || !h.isEnabled()) continue;
            String k = safeTrim(h.key());
            if (k == null || k.isBlank()) continue;
            String v = h.value() == null ? "" : h.value();
            req.header(k, v);
        }
    }

    private static void applyAuth(HttpRequest.Builder req, HttpAuthDto auth, List<HttpKeyValueDto> explicitHeaders) {
        if (auth == null || auth.type() == null || auth.type() == HttpAuthType.NONE) {
            return;
        }

        if (hasHeader(explicitHeaders, "authorization")) {
            return; // explicit wins
        }

        if (auth.type() == HttpAuthType.BEARER) {
            String token = safeTrim(auth.bearerToken());
            if (token != null && !token.isBlank()) {
                req.header("Authorization", "Bearer " + token);
            }
        } else if (auth.type() == HttpAuthType.BASIC && auth.basic() != null) {
            String user = auth.basic().username() == null ? "" : auth.basic().username();
            String pass = auth.basic().password() == null ? "" : auth.basic().password();
            String encoded = Base64.getEncoder().encodeToString((user + ":" + pass).getBytes(StandardCharsets.UTF_8));
            req.header("Authorization", "Basic " + encoded);
        } else if (auth.type() == HttpAuthType.API_KEY && auth.apiKey() != null) {
            // Only header location here; query handled in appendQueryParams
            if (auth.apiKey().location() == HttpApiKeyLocation.HEADER) {
                String name = safeTrim(auth.apiKey().name());
                if (name != null && !name.isBlank()) {
                    req.header(name, auth.apiKey().value() == null ? "" : auth.apiKey().value());
                }
            }
        }
    }

    private static boolean hasHeader(List<HttpKeyValueDto> headers, String lowerName) {
        if (headers == null) return false;
        for (HttpKeyValueDto h : headers) {
            if (h == null || !h.isEnabled()) continue;
            String k = h.key();
            if (k != null && k.toLowerCase(Locale.ROOT).equals(lowerName)) {
                return true;
            }
        }
        return false;
    }

    private static void applyCookies(HttpRequest.Builder req, String cookieHeader, List<HttpKeyValueDto> cookies) {
        String raw = safeTrim(cookieHeader);
        if (raw != null && !raw.isBlank()) {
            req.header("Cookie", raw);
            return;
        }
        if (cookies == null || cookies.isEmpty()) return;

        StringBuilder sb = new StringBuilder();
        for (HttpKeyValueDto c : cookies) {
            if (c == null || !c.isEnabled()) continue;
            String k = safeTrim(c.key());
            if (k == null || k.isBlank()) continue;
            String v = c.value() == null ? "" : c.value();
            if (sb.length() > 0) sb.append("; ");
            sb.append(k).append("=").append(v);
        }
        if (sb.length() > 0) {
            req.header("Cookie", sb.toString());
        }
    }

    private static HttpRequest buildWithMethodAndBody(HttpRequest.Builder req, HttpRequestSpecDto spec) {
        HttpBodyDto body = spec.body();
        if (spec.method() == null) {
            throw new IllegalArgumentException("request.method is required");
        }

        // Body only for non-GET/HEAD.
        boolean allowBody = switch (spec.method()) {
            case POST, PUT, PATCH, DELETE -> true;
            default -> false;
        };

        byte[] bytes = new byte[0];
        if (allowBody && body != null && body.mode() == HttpBodyMode.RAW) {
            String raw = body.raw();
            bytes = raw == null ? new byte[0] : raw.getBytes(StandardCharsets.UTF_8);
            String ct = safeTrim(body.contentType());
            if (ct != null && !ct.isBlank()) {
                req.header("Content-Type", ct);
            }
        }

        return switch (spec.method()) {
            case GET -> req.GET().build();
            case HEAD -> req.method("HEAD", HttpRequest.BodyPublishers.noBody()).build();
            case OPTIONS -> req.method("OPTIONS", HttpRequest.BodyPublishers.noBody()).build();
            case POST -> req.POST(HttpRequest.BodyPublishers.ofByteArray(bytes)).build();
            case PUT -> req.PUT(HttpRequest.BodyPublishers.ofByteArray(bytes)).build();
            case PATCH -> req.method("PATCH", HttpRequest.BodyPublishers.ofByteArray(bytes)).build();
            case DELETE -> req.method("DELETE", allowBody ? HttpRequest.BodyPublishers.ofByteArray(bytes) : HttpRequest.BodyPublishers.noBody()).build();
        };
    }

    private static String resolveFilename(Map<String, List<String>> headers, String effectiveUrl) {
        // Content-Disposition: attachment; filename="file.csv"
        try {
            List<String> cd = headers.getOrDefault("Content-Disposition", headers.getOrDefault("content-disposition", List.of()));
            if (cd != null) {
                for (String v : cd) {
                    if (v == null) continue;
                    String lower = v.toLowerCase(Locale.ROOT);
                    int idx = lower.indexOf("filename=");
                    if (idx >= 0) {
                        String fn = v.substring(idx + "filename=".length()).trim();
                        fn = fn.replace("\"", "");
                        if (!fn.isBlank()) return fn;
                    }
                }
            }
        } catch (Exception ignored) {
        }

        // Fallback: last path segment
        try {
            URI uri = URI.create(effectiveUrl);
            String path = uri.getPath();
            if (path != null && !path.isBlank()) {
                int slash = path.lastIndexOf('/');
                String last = slash >= 0 ? path.substring(slash + 1) : path;
                if (!last.isBlank()) return last;
            }
        } catch (Exception ignored) {
        }

        return "remote";
    }
}


