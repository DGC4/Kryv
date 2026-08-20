/**
 * Produces a PostgreSQL ILIKE substring pattern that treats user input literally.
 * PostgreSQL recognizes %, _, and the escape character itself as pattern syntax;
 * escaping them avoids accidental broad scans from otherwise valid search text.
 */
export function literalIlikePattern(value: string) {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}
