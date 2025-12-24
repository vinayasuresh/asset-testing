/**
 * Input Validation Utilities
 *
 * Common validation functions to prevent injection attacks and ensure data integrity
 */

import { z } from 'zod';

// UUID v4 regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Numeric ID pattern (for legacy systems using numeric IDs)
const NUMERIC_ID_REGEX = /^\d{1,20}$/;

// Safe string pattern (alphanumeric, hyphen, underscore)
const SAFE_STRING_REGEX = /^[a-zA-Z0-9_-]+$/;

// Email validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate UUID format
 */
export function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

/**
 * Validate numeric ID format
 */
export function isValidNumericId(id: string): boolean {
  return NUMERIC_ID_REGEX.test(id);
}

/**
 * Validate ID (accepts UUID or numeric)
 */
export function isValidId(id: string | undefined): boolean {
  if (!id) return false;
  return isValidUUID(id) || isValidNumericId(id);
}

/**
 * Validate and sanitize an ID parameter
 * Throws if invalid
 */
export function validateId(id: string | undefined, paramName: string = 'id'): string {
  if (!id) {
    throw new ValidationError(`Missing required parameter: ${paramName}`);
  }

  const trimmedId = id.trim();

  if (!isValidId(trimmedId)) {
    throw new ValidationError(`Invalid ${paramName} format`);
  }

  return trimmedId;
}

/**
 * Validate and parse a numeric query parameter with bounds
 */
export function parseNumericParam(
  value: string | undefined,
  options: {
    defaultValue: number;
    min?: number;
    max?: number;
    paramName?: string;
  }
): number {
  const { defaultValue, min, max, paramName = 'value' } = options;

  if (!value) {
    return defaultValue;
  }

  const parsed = parseInt(value, 10);

  if (isNaN(parsed)) {
    throw new ValidationError(`Invalid numeric value for ${paramName}`);
  }

  if (min !== undefined && parsed < min) {
    return min;
  }

  if (max !== undefined && parsed > max) {
    return max;
  }

  return parsed;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email) && email.length <= 254;
}

/**
 * Validate and sanitize email
 */
export function validateEmail(email: string | undefined, required: boolean = true): string | null {
  if (!email) {
    if (required) {
      throw new ValidationError('Email is required');
    }
    return null;
  }

  const trimmed = email.trim().toLowerCase();

  if (!isValidEmail(trimmed)) {
    throw new ValidationError('Invalid email format');
  }

  return trimmed;
}

/**
 * Sanitize string for safe use (remove potential injection characters)
 */
export function sanitizeString(
  input: string | undefined,
  options: {
    maxLength?: number;
    allowNewlines?: boolean;
    allowHtml?: boolean;
  } = {}
): string {
  if (!input) return '';

  const { maxLength = 1000, allowNewlines = false, allowHtml = false } = options;

  let sanitized = input;

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Remove HTML if not allowed
  if (!allowHtml) {
    sanitized = sanitized.replace(/<[^>]*>/g, '');
  }

  // Remove newlines if not allowed
  if (!allowNewlines) {
    sanitized = sanitized.replace(/[\r\n]/g, ' ');
  }

  // Truncate if too long
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized.trim();
}

/**
 * Validate safe string (alphanumeric with hyphens and underscores only)
 */
export function isValidSafeString(input: string): boolean {
  return SAFE_STRING_REGEX.test(input);
}

/**
 * Validate enum value
 */
export function validateEnum<T extends string>(
  value: string | undefined,
  allowedValues: readonly T[],
  paramName: string = 'value'
): T | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim() as T;

  if (!allowedValues.includes(trimmed)) {
    throw new ValidationError(`Invalid ${paramName}. Allowed values: ${allowedValues.join(', ')}`);
  }

  return trimmed;
}

/**
 * Validate date string (ISO 8601 format)
 */
export function validateDate(value: string | undefined, paramName: string = 'date'): Date | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (isNaN(date.getTime())) {
    throw new ValidationError(`Invalid date format for ${paramName}`);
  }

  // Ensure date is reasonable (not before 1970 or after 2100)
  const year = date.getFullYear();
  if (year < 1970 || year > 2100) {
    throw new ValidationError(`Date out of range for ${paramName}`);
  }

  return date;
}

/**
 * Validate pagination parameters
 */
export function validatePagination(
  limit: string | undefined,
  offset: string | undefined,
  options: {
    maxLimit?: number;
    defaultLimit?: number;
  } = {}
): { limit: number; offset: number } {
  const { maxLimit = 1000, defaultLimit = 50 } = options;

  return {
    limit: parseNumericParam(limit, {
      defaultValue: defaultLimit,
      min: 1,
      max: maxLimit,
      paramName: 'limit',
    }),
    offset: parseNumericParam(offset, {
      defaultValue: 0,
      min: 0,
      paramName: 'offset',
    }),
  };
}

/**
 * Validate search query
 */
export function validateSearchQuery(query: string | undefined): string | undefined {
  if (!query) {
    return undefined;
  }

  // Remove potentially dangerous characters for search
  const sanitized = query
    .replace(/[<>'"`;\\]/g, '')  // Remove potential injection chars
    .replace(/\s+/g, ' ')         // Normalize whitespace
    .trim();

  if (sanitized.length > 200) {
    return sanitized.substring(0, 200);
  }

  return sanitized || undefined;
}

/**
 * Custom validation error
 */
export class ValidationError extends Error {
  public readonly statusCode: number = 400;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Express error handler for validation errors
 */
export function handleValidationError(error: unknown, res: any): boolean {
  if (error instanceof ValidationError) {
    res.status(400).json({ message: error.message, code: 'VALIDATION_ERROR' });
    return true;
  }

  if (error instanceof z.ZodError) {
    res.status(400).json({
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: error.errors,
    });
    return true;
  }

  return false;
}

/**
 * Zod schemas for common validations
 */
export const zodSchemas = {
  uuid: z.string().regex(UUID_REGEX, 'Invalid UUID format'),
  numericId: z.string().regex(NUMERIC_ID_REGEX, 'Invalid numeric ID format'),
  id: z.string().refine(isValidId, 'Invalid ID format'),
  email: z.string().email().max(254),
  safeString: z.string().regex(SAFE_STRING_REGEX, 'Only alphanumeric characters, hyphens, and underscores allowed'),
  pagination: z.object({
    limit: z.coerce.number().int().min(1).max(1000).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  }),
  days: z.coerce.number().int().min(1).max(365).default(30),
};
