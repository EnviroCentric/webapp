/**
 * Utility functions for consistent date formatting across the application
 * All dates should be displayed in MM/DD/YYYY format unless otherwise specified
 */

/**
 * Formats a date to MM/DD/YYYY format
 * @param {string|Date} date - The date to format
 * @returns {string} - Formatted date string in MM/DD/YYYY format
 */
export function formatDate(date) {
  if (!date) return 'N/A';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      return 'N/A';
    }
    
    return dateObj.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit', 
      year: 'numeric'
    });
  } catch (error) {
    console.warn('Error formatting date:', error);
    return 'N/A';
  }
}

/**
 * Formats a date to MM/DD/YYYY HH:MM AM/PM format
 * @param {string|Date} date - The date to format
 * @returns {string} - Formatted date and time string
 */
export function formatDateTime(date) {
  if (!date) return 'N/A';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      return 'N/A';
    }
    
    return dateObj.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.warn('Error formatting date time:', error);
    return 'N/A';
  }
}

/**
 * Formats time in PST 12-hour format (for SampleCollection component)
 * @param {string|Date} date - The date to format
 * @returns {string} - Formatted time string in PST
 */
export function formatPSTTime(date) {
  if (!date) return '--:--';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return '--:--';
    }
    
    return dateObj.toLocaleTimeString('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.warn('Error formatting PST time:', error);
    return '--:--';
  }
}

/**
 * Formats a date for display with day of week (e.g., "Monday, 09/27/2024")
 * @param {string|Date} date - The date to format
 * @returns {string} - Formatted date string with day name
 */
export function formatDateWithDay(date) {
  if (!date) return 'N/A';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return 'N/A';
    }
    
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
  } catch (error) {
    console.warn('Error formatting date with day:', error);
    return 'N/A';
  }
}

/**
 * Gets the current date in MM/DD/YYYY format
 * @returns {string} - Current date in MM/DD/YYYY format
 */
export function getCurrentDate() {
  return formatDate(new Date());
}

/**
 * Checks if a date string is valid
 * @param {string|Date} date - The date to validate
 * @returns {boolean} - True if date is valid, false otherwise
 */
export function isValidDate(date) {
  if (!date) return false;
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return !isNaN(dateObj.getTime());
  } catch (error) {
    return false;
  }
}