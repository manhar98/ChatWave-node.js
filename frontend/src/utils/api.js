
import axios from "axios";

// Backend URL - VITE_API_URL already includes /api suffix
const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000/api";

const API = axios.create({
  baseURL: API_URL.replace(/\/$/, ""),
  withCredentials: true,
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
