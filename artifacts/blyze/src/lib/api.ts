const BASE_URL = import.meta.env.VITE_API_URL || "";

export function getApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_URL.replace(/\/$/, "")}${normalizedPath}`;
}
