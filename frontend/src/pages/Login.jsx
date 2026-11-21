
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import API from "../utils/api";

function Login() {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  // Input Change
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // Login Function
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      setLoading(true);

      const { data } = await API.post("/auth/login", formData);

      if (data.success) {
        // Save Token and User
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        // Notify SocketContext and App
        window.dispatchEvent(new Event("auth-change"));

        // Navigate to Dashboard
        navigate("/");
      } else {
        setError(data.message || "Login failed.");
      }
    } catch (err) {
      console.error("Login error:", err);
      const serverMessage = err.response?.data?.message;
      if (serverMessage) {
        setError(serverMessage);
      } else if (err.code === "ECONNABORTED" || err.message?.includes("Network")) {
        setError("સર્વર સાથે કનેક્ટ થઈ રહ્યું છે... કૃપા કરીને થોડી સેકન્ડ પછી ફરી પ્રયાસ કરો.");
      } else {
        setError(err.message || "Login failed. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080711] flex items-center justify-center px-4 py-10 text-white">

      {/* Background Effects */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-purple-700/20 blur-[120px] rounded-full"></div>

      <div className="absolute bottom-0 right-0 w-72 h-72 bg-violet-600/20 blur-[120px] rounded-full"></div>

      {/* Login Card */}
      <div className="relative w-full max-w-md bg-[#12101d]/90 border border-purple-500/20 rounded-2xl p-8 shadow-2xl shadow-purple-950/40">

        {/* Logo */}
        <div className="text-center mb-8">

          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-700 flex items-center justify-center text-2xl font-bold shadow-lg shadow-purple-600/30">
            C
          </div>

          <h1 className="text-3xl font-bold">
            Welcome to{" "}
            <span className="text-purple-400">ChatWave</span>
          </h1>

          <p className="text-gray-400 mt-2 text-sm">
            Login to continue your conversations
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Email */}
          <div>
            <label className="block text-sm text-gray-300 mb-2">
              Email Address
            </label>

            <div className="relative">
              <Mail
                className="absolute left-4 top-3.5 text-purple-400"
                size={19}
              />

              <input
                type="email"
                name="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full bg-[#1b1928] border border-gray-700 rounded-xl py-3 pl-12 pr-4 outline-none focus:border-purple-500 transition"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm text-gray-300 mb-2">
              Password
            </label>

            <div className="relative">
              <Lock
                className="absolute left-4 top-3.5 text-purple-400"
                size={19}
              />

              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full bg-[#1b1928] border border-gray-700 rounded-xl py-3 pl-12 pr-12 outline-none focus:border-purple-500 transition"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-3.5 text-gray-400"
              >
                {showPassword ? (
                  <EyeOff size={19} />
                ) : (
                  <Eye size={19} />
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-400 text-sm text-center">
              {error}
            </p>
          )}

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 font-semibold shadow-lg shadow-purple-900/30 transition disabled:opacity-50"
          >
            {loading ? "Logging In..." : "Login"}
          </button>
        </form>

        {/* Register Link */}
        <p className="text-center text-gray-400 text-sm mt-7">
          Don't have an account?{" "}

          <Link
            to="/register"
            className="text-purple-400 hover:text-purple-300 font-semibold"
          >
            Create Account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
