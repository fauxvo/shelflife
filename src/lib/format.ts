/**
 * Format a byte count as a human-readable file size string.
 * Returns empty string for null/zero/negative values.
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}
