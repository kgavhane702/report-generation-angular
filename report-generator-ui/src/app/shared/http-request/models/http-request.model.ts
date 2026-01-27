export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface HttpKeyValue {
  key: string;
  value: string;
  /** When false, the entry is ignored (mirrors Postman enable/disable). Defaults to true. */
  enabled?: boolean;
}

export type HttpAuthType = 'none' | 'bearer' | 'basic' | 'apiKey';
export type HttpApiKeyLocation = 'header' | 'query';

export interface HttpAuthConfig {
  type: HttpAuthType;
  bearerToken?: string;
  basic?: { username: string; password: string };
  apiKey?: { location: HttpApiKeyLocation; name: string; value: string };
}

export type HttpBodyMode = 'none' | 'raw';

export interface HttpBodyConfig {
  mode: HttpBodyMode;
  /** Raw body string (used when mode === 'raw'). */
  raw?: string;
  /** Content-Type for raw body (e.g. application/json). */
  contentType?: string;
}

/**
 * Postman-like HTTP request spec used for URL-based widget data sources.
 * This is persisted into the document for remote widgets (and re-run on import/open).
 */
export interface HttpRequestSpec {
  url: string;
  method: HttpMethod;

  queryParams?: HttpKeyValue[];
  headers?: HttpKeyValue[];
  /** Cookie kv pairs; will be serialized to a Cookie header unless cookieHeader is provided. */
  cookies?: HttpKeyValue[];
  /** Raw Cookie header string; when set, takes precedence over cookies[]. */
  cookieHeader?: string;

  auth?: HttpAuthConfig;
  body?: HttpBodyConfig;

  timeoutMs?: number;
  followRedirects?: boolean;
}



