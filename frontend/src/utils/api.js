
import axios from "axios";

// Backend URL
const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://chatwave-node-js.onrender.com";

const API = axios.create({
  baseURL: `${API_URL.replace(/\/$/, "")}/api`,
  withCredentials: true,
});

export default API;
