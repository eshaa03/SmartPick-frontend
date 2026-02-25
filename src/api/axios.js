import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "/api";

// increase timeout to 60 seconds
const timeout =
  Math.max(60000, Number(import.meta.env.VITE_API_TIMEOUT_MS) || 60000);

const api = axios.create({
  baseURL,
  timeout,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;
