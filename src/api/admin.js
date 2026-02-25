import api from "./axios";

// Dashboard Stats
export const getDashboardStats = () => api.get("/admin/stats");

// Products
export const getProducts = (params = {}) => api.get("/admin/products", { params });
export const addProduct = (data) => api.post("/admin/products", data);
export const updateProduct = (id, data) => api.put(`/admin/products/${id}`, data);
export const deleteProduct = (id) => api.delete(`/admin/products/${id}`);

// Users
export const getUsers = (params = {}) => api.get("/admin/users", { params });
export const deleteUser = async (id) => {
  const endpoints = [
    `/admin/users/${id}`,
    `/admin/user/${id}`,
    `/admin/users/delete/${id}`,
    `/admin/delete-user/${id}`,
  ];

  let lastError = null;
  for (const endpoint of endpoints) {
    try {
      return await api.delete(endpoint);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("Delete user failed");
};

// Analytics
export const getAnalyticsData = () => api.get("/admin/analytics");
