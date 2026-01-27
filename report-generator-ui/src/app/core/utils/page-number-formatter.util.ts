/**
 * Utility functions for formatting page numbers in different formats
 */

export type PageNumberFormat = 'arabic' | 'roman' | 'alphabetic';

/**
 * Convert a number to Roman numerals
 */
function toRoman(num: number): string {
  if (num <= 0 || num > 3999) return num.toString();
  
  const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const numerals = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  
  let result = '';
  for (let i = 0; i < values.length; i++) {
    const count = Math.floor(num / values[i]);
    result += numerals[i].repeat(count);
    num %= values[i];
  }
  return result.toLowerCase();
}

/**
 * Convert a number to alphabetic format (a, b, c, ..., z, aa, ab, ...)
 */
function toAlphabetic(num: number): string {
  if (num <= 0) return num.toString();
  
  let result = '';
  num--; // Convert to 0-based index
  
  while (num >= 0) {
    result = String.fromCharCode(97 + (num % 26)) + result; // 97 is 'a'
    num = Math.floor(num / 26) - 1;
  }
  
  return result;
}

/**
 * Format a page number according to the specified format
 */
export function formatPageNumber(pageNumber: number, format: PageNumberFormat = 'arabic'): string {
  switch (format) {
    case 'roman':
      return toRoman(pageNumber);
    case 'alphabetic':
      return toAlphabetic(pageNumber);
    case 'arabic':
    default:
      return pageNumber.toString();
  }
}

