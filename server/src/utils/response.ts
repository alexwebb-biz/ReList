import { Response } from 'express';
import { ApiResponse, PaginatedResponse } from '../types/index.js';

export const sendSuccess = <T>(res: Response, data: T, status = 200): void => {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
  res.status(status).json(response);
};

export const sendError = (
  res: Response,
  code: string,
  message: string,
  status = 400,
  field?: string
): void => {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      ...(field && { field }),
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
  res.status(status).json(response);
};

// Helper functions that return response objects (for use with res.json())
export const success = <T>(data: T): ApiResponse<T> => ({
  success: true,
  data,
  meta: {
    timestamp: new Date().toISOString(),
  },
});

export const error = (code: string, message: string, field?: string): ApiResponse => ({
  success: false,
  error: {
    code,
    message,
    ...(field && { field }),
  },
  meta: {
    timestamp: new Date().toISOString(),
  },
});

export const paginated = <T>(
  data: T[],
  page: number,
  perPage: number,
  total: number
): PaginatedResponse<T> => {
  const total_pages = Math.ceil(total / perPage);
  return {
    success: true,
    data,
    pagination: {
      page,
      per_page: perPage,
      total,
      total_pages,
      has_next: page < total_pages,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
};

export const sendPaginated = <T>(
  res: Response,
  data: T[],
  pagination: {
    page: number;
    per_page: number;
    total: number;
  }
): void => {
  const total_pages = Math.ceil(pagination.total / pagination.per_page);
  const response: PaginatedResponse<T> = {
    success: true,
    data,
    pagination: {
      ...pagination,
      total_pages,
      has_next: pagination.page < total_pages,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
  res.status(200).json(response);
};
