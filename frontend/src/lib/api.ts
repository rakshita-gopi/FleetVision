import axios from "axios";

/**
 * Browser calls:
 * - Local: NEXT_PUBLIC_API_URL (default http://localhost:8000/api/v1)
 * - Vercel: prefer same-origin /api/v1 so Next.js can proxy to BACKEND_API_URL
 *   (avoids dead trycloudflare hostnames baked into the client bundle).
 */
function resolveApiBase(): string {
  const configured = (process.env.NEXT_PUBLIC_API_URL || "").trim();
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1";
    if (!isLocal) {
      // Deployed frontend: always hit same-origin proxy unless explicitly forced
      if (
        !configured ||
        configured.includes("trycloudflare.com") ||
        configured.startsWith("http://localhost")
      ) {
        return "/api/v1";
      }
    }
  }
  return configured || "http://localhost:8000/api/v1";
}

const api = axios.create({
  baseURL: resolveApiBase(),
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  config.baseURL = resolveApiBase();
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export default api;
