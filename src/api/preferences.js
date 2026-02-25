import api from "./axios";

export const getPreferences = () => {
  return api.get("/preferences");
};

export const updatePreferences = (data) => {
  return api.put("/preferences", data);
};
