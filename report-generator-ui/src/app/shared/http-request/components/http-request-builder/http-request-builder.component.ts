import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { AppTabComponent } from '../../../components/tabs/app-tab/app-tab.component';
import { AppTabsComponent } from '../../../components/tabs/app-tabs/app-tabs.component';
import type { HttpAuthType, HttpBodyMode, HttpMethod, HttpRequestSpec } from '../../models/http-request.model';

type KvForm = FormGroup<{
  key: any;
  value: any;
  enabled: any;
}>;

@Component({
  selector: 'app-http-request-builder',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AppTabsComponent, AppTabComponent],
  templateUrl: './http-request-builder.component.html',
  styleUrls: ['./http-request-builder.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HttpRequestBuilderComponent implements OnInit, OnChanges {
  private readonly destroyRef = inject(DestroyRef);

  @Input() value: HttpRequestSpec | null = null;
  @Input() disabled = false;
  @Output() valueChange = new EventEmitter<HttpRequestSpec>();

  readonly methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
  readonly authTypes: HttpAuthType[] = ['none', 'bearer', 'basic', 'apiKey'];
  readonly bodyModes: HttpBodyMode[] = ['none', 'raw'];

  form!: FormGroup;

  constructor(private readonly fb: FormBuilder) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      url: [''],
      method: ['GET' as HttpMethod],

      queryParams: this.fb.array([] as KvForm[]),
      headers: this.fb.array([] as KvForm[]),
      cookies: this.fb.array([] as KvForm[]),
      cookieHeader: [''],

      authType: ['none' as HttpAuthType],
      bearerToken: [''],
      basicUsername: [''],
      basicPassword: [''],
      apiKeyLocation: ['header'],
      apiKeyName: [''],
      apiKeyValue: [''],

      bodyMode: ['none' as HttpBodyMode],
      bodyContentType: ['application/json'],
      bodyRaw: [''],

      timeoutMs: [20000],
      followRedirects: [true],
    });

    if (this.value) {
      this.patchFromValue(this.value);
    } else {
      // Seed one empty row for better UX.
      this.addQueryParam();
      this.addHeader();
    }

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.disabled) return;
        this.valueChange.emit(this.toSpec());
      });

    if (this.disabled) {
      this.form.disable({ emitEvent: false });
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.form) return;

    if (changes['disabled']) {
      if (this.disabled) this.form.disable({ emitEvent: false });
      else this.form.enable({ emitEvent: false });
    }

    if (changes['value'] && this.value) {
      this.patchFromValue(this.value);
    }
  }

  get queryParams(): FormArray {
    return this.form.get('queryParams') as FormArray;
  }

  get headers(): FormArray {
    return this.form.get('headers') as FormArray;
  }

  get cookies(): FormArray {
    return this.form.get('cookies') as FormArray;
  }

  addQueryParam(): void {
    this.queryParams.push(this.newKvRow());
  }

  removeQueryParam(index: number): void {
    this.queryParams.removeAt(index);
  }

  addHeader(): void {
    this.headers.push(this.newKvRow());
  }

  removeHeader(index: number): void {
    this.headers.removeAt(index);
  }

  addCookie(): void {
    this.cookies.push(this.newKvRow());
  }

  removeCookie(index: number): void {
    this.cookies.removeAt(index);
  }

  trackByIndex(index: number): number {
    return index;
  }

  private newKvRow(initial?: { key?: string; value?: string; enabled?: boolean }): KvForm {
    return this.fb.group({
      key: [initial?.key ?? ''],
      value: [initial?.value ?? ''],
      enabled: [initial?.enabled ?? true],
    }) as any;
  }

  private patchFromValue(value: HttpRequestSpec): void {
    // Arrays: clear + repopulate so order is preserved
    this.queryParams.clear();
    (value.queryParams || []).forEach((kv) => this.queryParams.push(this.newKvRow(kv)));
    if (this.queryParams.length === 0) this.addQueryParam();

    this.headers.clear();
    (value.headers || []).forEach((kv) => this.headers.push(this.newKvRow(kv)));
    if (this.headers.length === 0) this.addHeader();

    this.cookies.clear();
    (value.cookies || []).forEach((kv) => this.cookies.push(this.newKvRow(kv)));

    const authType: HttpAuthType = (value.auth?.type as HttpAuthType) || 'none';
    this.form.patchValue(
      {
        url: value.url || '',
        method: (value.method as HttpMethod) || 'GET',

        cookieHeader: value.cookieHeader || '',

        authType,
        bearerToken: value.auth?.bearerToken || '',
        basicUsername: value.auth?.basic?.username || '',
        basicPassword: value.auth?.basic?.password || '',
        apiKeyLocation: value.auth?.apiKey?.location || 'header',
        apiKeyName: value.auth?.apiKey?.name || '',
        apiKeyValue: value.auth?.apiKey?.value || '',

        bodyMode: (value.body?.mode as HttpBodyMode) || 'none',
        bodyContentType: value.body?.contentType || 'application/json',
        bodyRaw: value.body?.raw || '',

        timeoutMs: value.timeoutMs ?? 20000,
        followRedirects: value.followRedirects ?? true,
      },
      { emitEvent: false }
    );
  }

  private toSpec(): HttpRequestSpec {
    const raw = this.form.getRawValue() as any;

    const normalizeKv = (arr: any[]) =>
      (arr || [])
        .map((x) => ({ key: x?.key ?? '', value: x?.value ?? '', enabled: x?.enabled !== false }))
        .filter((x) => x.key.trim() !== '' || x.value.trim() !== '');

    const authType: HttpAuthType = raw.authType;
    const auth =
      authType === 'none'
        ? undefined
        : authType === 'bearer'
          ? { type: 'bearer' as const, bearerToken: raw.bearerToken || '' }
          : authType === 'basic'
            ? { type: 'basic' as const, basic: { username: raw.basicUsername || '', password: raw.basicPassword || '' } }
            : {
                type: 'apiKey' as const,
                apiKey: {
                  location: (raw.apiKeyLocation as any) || 'header',
                  name: raw.apiKeyName || '',
                  value: raw.apiKeyValue || '',
                },
              };

    const bodyMode: HttpBodyMode = raw.bodyMode;
    const body =
      bodyMode === 'none'
        ? undefined
        : {
            mode: 'raw' as const,
            raw: raw.bodyRaw || '',
            contentType: raw.bodyContentType || 'application/json',
          };

    return {
      url: raw.url || '',
      method: raw.method || 'GET',
      queryParams: normalizeKv(raw.queryParams),
      headers: normalizeKv(raw.headers),
      cookies: normalizeKv(raw.cookies),
      cookieHeader: raw.cookieHeader || undefined,
      auth,
      body,
      timeoutMs: Number.isFinite(Number(raw.timeoutMs)) ? Number(raw.timeoutMs) : undefined,
      followRedirects: raw.followRedirects !== false,
    };
  }
}



