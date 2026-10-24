import { ValidationError } from "./errors.ts";

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export function paginate<T>(all: T[], page = 1, pageSize = DEFAULT_PAGE_SIZE): Page<T> {
  if (!Number.isInteger(page) || page < 1) {
    throw new ValidationError("page must be 1 or more");
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new ValidationError(`pageSize must be between 1 and ${MAX_PAGE_SIZE}`);
  }
  const start = (page - 1) * pageSize;
  return { items: all.slice(start, start + pageSize), total: all.length, page, pageSize };
}
