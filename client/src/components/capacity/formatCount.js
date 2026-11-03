/**
 * Formats a count with a regular English noun, e.g. "1 seat" or "4 seats".
 *
 * @param {number} count
 * @param {string} noun - Singular form.
 */
export function formatCount(count, noun) {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}
