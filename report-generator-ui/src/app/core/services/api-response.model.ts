export interface ApiErrorDto {
  code?: string;
  message: string;
  details?: Record<string, any> | null;
}

export interface ApiResponseDto<T> {
  success: boolean;
  data: T | null;
  error?: ApiErrorDto | null;
}


