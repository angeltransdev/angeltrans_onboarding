import axios from "axios";

const PROD_API = "https://angeltransonboarding-production.up.railway.app/api";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:5000/api" : PROD_API),
  timeout: 10000,
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("at_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;
