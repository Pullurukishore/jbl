/**
 * Standard Date Formatting Utilities for Indian Region (DD-MM-YYYY)
 */

function parseDateSafely(date: string | number | Date | null | undefined): Date | null {
  if (!date || date === 'N/A' || date === 'No Birth Date' || date === '—' || date === 'IN KARDEX') return null;
  if (date instanceof Date) return isNaN(date.getTime()) ? null : date;
  if (typeof date === 'number') {
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
  }
  const str = String(date).trim();
  if (!str || str === 'N/A') return null;

  // Handle DD/MM/YYYY or DD-MM-YYYY format
  const dmMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(.*)$/);
  if (dmMatch) {
    const day = parseInt(dmMatch[1], 10);
    const month = parseInt(dmMatch[2], 10);
    const year = parseInt(dmMatch[3], 10);
    const timePart = dmMatch[4] ? dmMatch[4].trim().replace(/^,/, '').trim() : '';
    const isoLike = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}${timePart ? ' ' + timePart : ' 00:00:00'}`;
    const d = new Date(isoLike);
    if (!isNaN(d.getTime())) return d;
  }

  // Standard JavaScript Date parse (ISO 8601, etc.)
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formats a Date or date string to Indian standard: DD-MM-YYYY
 * Example: 25-11-2026
 */
export function formatIndianDate(date: string | number | Date | null | undefined): string {
  const d = parseDateSafely(date);
  if (!d) return 'N/A';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Formats a Date or date string to Indian date-time: DD-MM-YYYY HH:mm:ss
 * Example: 25-11-2026 14:30:45
 */
export function formatIndianDateTime(
  date: string | number | Date | null | undefined,
  includeSeconds: boolean = true
): string {
  const d = parseDateSafely(date);
  if (!d) return 'N/A';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  if (!includeSeconds) {
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  }
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
}

/**
 * Formats a Date or date string to Indian readable short format: DD-MMM-YYYY
 * Example: 25-Nov-2026
 */
export function formatIndianDateShortMonth(date: string | number | Date | null | undefined): string {
  const d = parseDateSafely(date);
  if (!d) return 'N/A';
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}
