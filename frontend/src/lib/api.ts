// Central API base URL helper.
// NEXT_PUBLIC_API_URL is baked at `next build` time (see frontend/Dockerfile).
// Falls back to localhost for `npm run dev`.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${p}`;
}
