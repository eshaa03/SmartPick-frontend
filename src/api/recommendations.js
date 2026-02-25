import axios from "axios";
import api from "./axios";

const RECOMMENDATIONS_PATH =
  import.meta.env.VITE_RECOMMENDATIONS_PATH || "/recommendations";

const normalizeRecommendations = (data) => {
  if (!data) return [];
  if (data && typeof data === "object" && !Array.isArray(data)) {
    if (data.data && data.data !== data) {
      const nested = normalizeRecommendations(data.data);
      if (nested.length > 0) return nested;
    }
  }
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.shopping_results)) return data.shopping_results;
  if (Array.isArray(data?.shoppingResults)) return data.shoppingResults;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.recommendations)) return data.recommendations;
  if (data?.products && typeof data.products === "object") {
    return Object.values(data.products);
  }
  if (data && typeof data === "object") {
    return [data];
  }
  return [];
};

export const getRecommendations = async (query) => {
  const q = String(query || "").trim();
  if (!q) return [];

  const requests = [
    () => api.get(RECOMMENDATIONS_PATH, { params: { query: q } }),
    () => api.get(RECOMMENDATIONS_PATH, { params: { q } }),
    () => api.get(RECOMMENDATIONS_PATH, { params: { search: q } }),
    () => api.post(RECOMMENDATIONS_PATH, { query: q }),
    () => api.post(RECOMMENDATIONS_PATH, { q }),
    () => api.post(RECOMMENDATIONS_PATH, { search: q }),
    // Fallback for backends exposed without /api proxy prefix.
    () => axios.get("/recommendations", { params: { query: q } }),
    () => axios.post("/recommendations", { query: q }),
  ];

  let lastError = null;
  for (const makeRequest of requests) {
    try {
      const { data } = await makeRequest();
      const normalized = normalizeRecommendations(data);
      if (normalized.length > 0) return normalized;
      // Try alternate request contracts when response shape is empty.
      continue;
    } catch (err) {
      lastError = err;
      const status = Number(err?.response?.status || 0);
      // Try next contract variant for common contract mismatch statuses.
      if (status === 0 || status === 404 || status === 405 || status === 422) {
        continue;
      }
      throw err;
    }
  }

  if (lastError) throw lastError;
  return [];
};
