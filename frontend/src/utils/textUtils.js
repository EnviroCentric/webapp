/**
 * Text formatting utilities
 */

/**
 * Convert text to title case for display
 * @param {string} text - The text to format
 * @returns {string} - The formatted text in title case
 */
export const toTitleCase = (text) => {
  if (!text) return '';
  
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Format company name for display
 * @param {string} companyName - The company name from the database
 * @returns {string} - The formatted company name for display
 */
export const formatCompanyName = (companyName) => {
  return toTitleCase(companyName);
};

/**
 * Format a person's name (first + last) for display.
 */
export const formatPersonName = (firstName, lastName) => {
  const first = toTitleCase((firstName || '').trim());
  const last = toTitleCase((lastName || '').trim());
  return [first, last].filter(Boolean).join(' ').trim();
};

/**
 * Clean company name for database storage
 * @param {string} companyName - The company name from user input
 * @returns {string} - The cleaned company name for storage
 */
export const cleanCompanyName = (companyName) => {
  if (!companyName) return '';
  return companyName.trim().toLowerCase();
};
