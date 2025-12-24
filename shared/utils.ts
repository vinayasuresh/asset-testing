// Data normalization utilities for consistent user data handling

/**
 * Normalize email addresses to lowercase for consistent storage and matching
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normalize names to title case for consistent display
 */
export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Normalize User ID to strictly numeric (integers only)
 * Removes any non-numeric characters and converts to integer
 */
export function normalizeUserID(userID: string | number): number {
  if (typeof userID === 'number') {
    return Math.abs(Math.floor(userID)); // Ensure positive integer
  }
  
  // Extract numeric characters only
  const numericString = userID.toString().replace(/\D/g, '');
  const parsed = parseInt(numericString, 10);
  
  if (isNaN(parsed) || parsed <= 0) {
    throw new Error('User ID must be a positive number');
  }
  
  return parsed;
}

/**
 * Generate the next available numeric User ID
 * This should be called when creating new users to assign a unique numeric ID
 */
export function generateNextUserID(existingUserIDs: number[]): number {
  if (existingUserIDs.length === 0) {
    return 1001; // Start from 1001 for human-readable IDs
  }
  
  const maxID = Math.max(...existingUserIDs);
  return maxID + 1;
}

/**
 * Validate user uniqueness based on combination of Name, User ID, and Email
 */
export function validateUserUniqueness(
  firstName: string,
  lastName: string,
  userID: number,
  email: string,
  existingUsers: Array<{
    firstName: string;
    lastName: string;
    userID: number;
    email: string;
    id?: string; // Exclude current user when editing
  }>,
  excludeUserId?: string
): { isValid: boolean; conflicts: string[] } {
  const normalizedEmail = normalizeEmail(email);
  const normalizedFirstName = normalizeName(firstName);
  const normalizedLastName = normalizeName(lastName);
  const fullName = `${normalizedFirstName} ${normalizedLastName}`;
  
  const conflicts: string[] = [];
  
  for (const user of existingUsers) {
    // Skip the current user when editing
    if (excludeUserId && user.id === excludeUserId) {
      continue;
    }
    
    const userFullName = `${normalizeName(user.firstName)} ${normalizeName(user.lastName)}`;
    const userNormalizedEmail = normalizeEmail(user.email);
    
    // Check for conflicts
    if (user.userID === userID) {
      conflicts.push(`User ID ${userID} is already taken`);
    }
    
    if (userNormalizedEmail === normalizedEmail) {
      conflicts.push(`Email ${normalizedEmail} is already registered`);
    }
    
    // Check for exact name match with same user ID (high probability of duplicate)
    if (userFullName === fullName && user.userID === userID) {
      conflicts.push(`User with name "${fullName}" and ID ${userID} already exists`);
    }
  }
  
  return {
    isValid: conflicts.length === 0,
    conflicts
  };
}

/**
 * Format user display name consistently
 */
export function formatUserDisplayName(firstName: string, lastName: string): string {
  const normalizedFirst = normalizeName(firstName);
  const normalizedLast = normalizeName(lastName);
  return `${normalizedFirst} ${normalizedLast}`;
}

/**
 * Create user identifier for URL routing and references
 */
export function createUserSlug(firstName: string, lastName: string, userID: number): string {
  const normalizedFirst = normalizeName(firstName).replace(/\s+/g, '-');
  const normalizedLast = normalizeName(lastName).replace(/\s+/g, '-');
  return `${normalizedFirst.toLowerCase()}-${normalizedLast.toLowerCase()}-${userID}`;
}

/**
 * Parse user slug back to components
 */
export function parseUserSlug(slug: string): { firstName: string; lastName: string; userID: number } | null {
  const parts = slug.split('-');
  if (parts.length < 3) return null;
  
  const userID = parseInt(parts[parts.length - 1], 10);
  if (isNaN(userID)) return null;
  
  const lastNameIndex = parts.length - 2;
  const firstName = parts.slice(0, lastNameIndex).join(' ');
  const lastName = parts[lastNameIndex];
  
  return {
    firstName: normalizeName(firstName),
    lastName: normalizeName(lastName),
    userID
  };
}