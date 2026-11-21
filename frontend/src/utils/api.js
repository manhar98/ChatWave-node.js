
import axios from "axios";

// Backend URL - defaults to production Render backend if env var is missing
const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://chatwave-node-js.onrender.com/api";

const API = axios.create({
  baseURL: API_URL.replace(/\/$/, ""),
  withCredentials: true,
  timeout: 45000,
});

// Attach token from localStorage to every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default API;
