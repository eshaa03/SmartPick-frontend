import api from "./axios";

const ensureAuthPayload = (res, action = "Authentication") => {
  const token = res?.data?.token;
  const user = res?.data?.user;
  if (!token || !user || typeof user !== "object") {
    const error = new Error(
      `${action} API is not reachable. Configure VITE_API_BASE_URL to your backend /api URL.`
    );
    error.isConfigError = true;
    throw error;
  }
  return res;
};

export const loginUser = async (data) => {
  const res = await api.post("/auth/login", data);
  return ensureAuthPayload(res, "Login");
};

export const registerUser = async (data) => {
  const res = await api.post("/auth/register", data);
  return ensureAuthPayload(res, "Registration");
};
