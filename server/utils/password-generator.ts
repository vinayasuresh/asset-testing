import * as crypto from "crypto";

/**
 * Generate a secure random password with specified length and character set
 */
export function generateSecurePassword(length: number = 12): string {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";
  
  // All characters
  const allChars = uppercase + lowercase + numbers + symbols;
  
  let password = "";
  
  // Ensure password has at least one character from each set
  password += uppercase[crypto.randomInt(0, uppercase.length)];
  password += lowercase[crypto.randomInt(0, lowercase.length)];
  password += numbers[crypto.randomInt(0, numbers.length)];
  password += symbols[crypto.randomInt(0, symbols.length)];
  
  // Fill the rest with random characters
  for (let i = password.length; i < length; i++) {
    password += allChars[crypto.randomInt(0, allChars.length)];
  }
  
  // Shuffle the password to avoid predictable patterns
  return shuffleString(password);
}

/**
 * Generate a secure temporary password for initial user setup
 * More user-friendly than the full secure password but still secure
 */
export function generateTempPassword(): string {
  const words = [
    "Apple", "Beach", "Cloud", "Dance", "Eagle", "Forest", "Green", "Happy",
    "Island", "Jungle", "Knight", "Light", "Magic", "Nature", "Ocean", "Peace",
    "Queen", "River", "Storm", "Tiger", "Unity", "Valley", "Water", "Zebra"
  ];
  
  const numbers = "0123456789";
  const symbols = "!@#$%";
  
  // Pick 2 random words
  const word1 = words[crypto.randomInt(0, words.length)];
  const word2 = words[crypto.randomInt(0, words.length)];
  
  // Add 2-3 numbers
  let numberPart = "";
  for (let i = 0; i < 3; i++) {
    numberPart += numbers[crypto.randomInt(0, numbers.length)];
  }
  
  // Add 1 symbol
  const symbolPart = symbols[crypto.randomInt(0, symbols.length)];
  
  return `${word1}${word2}${numberPart}${symbolPart}`;
}

/**
 * Shuffle a string using Fisher-Yates algorithm
 */
function shuffleString(str: string): string {
  const array = str.split("");
  for (let i = array.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array.join("");
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;
  
  if (password.length >= 8) score += 1;
  else feedback.push("Password should be at least 8 characters long");
  
  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push("Password should contain uppercase letters");
  
  if (/[a-z]/.test(password)) score += 1;
  else feedback.push("Password should contain lowercase letters");
  
  if (/\d/.test(password)) score += 1;
  else feedback.push("Password should contain numbers");
  
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  else feedback.push("Password should contain special characters");
  
  return {
    isValid: score >= 4,
    score,
    feedback
  };
}