export interface PaginatedResponse<T> {
  data: T[];
  totalItems: number;
  totalPages: number;
  page: number;
  message?: string;
}

export interface ApiError {
  error?: string;
  message?: string;
}
