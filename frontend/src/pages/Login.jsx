
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, X, KeyRound, CheckCircle, Shield } from "lucide-react";
import API from "../utils/api";

function Login() {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({ email: "", password: "" });

  // Forgot Password Modal States
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1 = enter email, 2 = enter OTP + new password
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [showForgotPass, setShowForgotPass] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");

  // Step 1: Send OTP
  const handleSendOTP = async (e) => {
    e.preventDefault();
    setForgotError("");
    setForgotSuccess("");

    if (!forgotEmail) {
      setForgotError("Email જરૂરી છે.");
      return;
    }

    try {
      setForgotLoading(true);
      const { data } = await API.post("/auth/send-otp", { email: forgotEmail });

      if (data.success) {
        setForgotSuccess("OTP તમારા email પર મોકલ્યો છે! Inbox તપાસો.");
        setTimeout(() => {
          setForgotStep(2);
          setForgotSuccess("");
        }, 1500);
      } else {
        setForgotError(data.message || "OTP મોકલવામાં ભૂલ.");
      }
    } catch (err) {
      setForgotError(err.response?.data?.message || "OTP મોકલવામાં ભૂલ. ફરી પ્રયાસ કરો.");
    } finally {
      setForgotLoading(false);
    }
  };

  // Step 2: Verify OTP & Reset Password
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setForgotError("");
    setForgotSuccess("");

    if (!forgotOtp || !forgotNewPassword || !forgotConfirmPassword) {
      setForgotError("OTP, New Password અને Confirm Password ભરો.");
      return;
    }

    if (forgotNewPassword.length < 6) {
      setForgotError("Password ઓછામાં ઓછો 6 અક્ષરનો હોવો જોઈએ.");
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError("Password અને Confirm Password એકસરખા નથી.");
      return;
    }

    try {
      setForgotLoading(true);
      const { data } = await API.post("/auth/verify-otp", {
        email: forgotEmail,
        otp: forgotOtp,
        newPassword: forgotNewPassword,
      });

      if (data.success) {
        setForgotSuccess("Password સફળતાપૂર્વક બદલ્યો! હવે Login કરો.");
        setFormData((prev) => ({ ...prev, email: forgotEmail }));
        setTimeout(() => {
          closeForgotModal();
        }, 2000);
      } else {
        setForgotError(data.message || "Password reset થઈ શક્યો નથી.");
      }
    } catch (err) {
      setForgotError(err.response?.data?.message || "Password reset કરવામાં ભૂલ. ફરી પ્રયાસ કરો.");
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setForgotStep(1);
    setForgotEmail("");
    setForgotOtp("");
    setForgotNewPassword("");
    setForgotConfirmPassword("");
    setForgotError("");
    setForgotSuccess("");
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      setLoading(true);
      const { data } = await API.post("/auth/login", formData);

      if (data.success) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        window.dispatchEvent(new Event("auth-change"));
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

      <div className="absolute top-0 left-0 w-72 h-72 bg-purple-700/20 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-0 right-0 w-72 h-72 bg-violet-600/20 blur-[120px] rounded-full"></div>

      <div className="relative w-full max-w-md bg-[#12101d]/90 border border-purple-500/20 rounded-2xl p-8 shadow-2xl shadow-purple-950/40">

        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-700 flex items-center justify-center text-2xl font-bold shadow-lg shadow-purple-600/30">
            C
          </div>
          <h1 className="text-3xl font-bold">
            Welcome to <span className="text-purple-400">ChatWave</span>
          </h1>
          <p className="text-gray-400 mt-2 text-sm">Login to continue your conversations</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm text-gray-300 mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 text-purple-400" size={19} />
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

          <div>
            <label className="block text-sm text-gray-300 mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 text-purple-400" size={19} />
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
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>

            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(true);
                  setForgotError("");
                  setForgotSuccess("");
                  setForgotStep(1);
                  if (formData.email) setForgotEmail(formData.email);
                }}
                className="text-xs text-purple-400 hover:text-purple-300 transition"
              >
                Forgot Password?
              </button>
            </div>
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 font-semibold shadow-lg shadow-purple-900/30 transition disabled:opacity-50"
          >
            {loading ? "Logging In..." : "Login"}
          </button>
        </form>

        <p className="text-center text-gray-400 text-sm mt-7">
          Don't have an account?{" "}
          <Link to="/register" className="text-purple-400 hover:text-purple-300 font-semibold">
            Create Account
          </Link>
        </p>
      </div>

      {/* Forgot Password Modal - OTP Flow */}
      {showForgotModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !forgotLoading) closeForgotModal();
          }}
        >
          <div className="relative w-full max-w-md bg-[#12101d] border border-purple-500/30 rounded-2xl p-6 md:p-8 shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Forgot Password</h3>
                  <p className="text-xs text-gray-400">
                    {forgotStep === 1 ? "Step 1: Enter your email" : "Step 2: Enter OTP & new password"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !forgotLoading && closeForgotModal()}
                className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition"
              >
                <X size={19} />
              </button>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center gap-2 mt-4 mb-5">
              <div className={`flex-1 h-1 rounded-full ${forgotStep >= 1 ? "bg-purple-500" : "bg-gray-700"}`}></div>
              <div className={`flex-1 h-1 rounded-full ${forgotStep >= 2 ? "bg-purple-500" : "bg-gray-700"}`}></div>
            </div>

            {/* Messages */}
            {forgotError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-xs mb-4">
                {forgotError}
              </div>
            )}
            {forgotSuccess && (
              <div className="bg-green-500/10 border border-green-500/30 text-green-400 p-3 rounded-xl text-xs flex items-center gap-2 mb-4">
                <CheckCircle size={16} />
                <span>{forgotSuccess}</span>
              </div>
            )}

            {/* Step 1: Send OTP */}
            {forgotStep === 1 && (
              <form onSubmit={handleSendOTP} className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-300 mb-1.5 font-medium">
                    Registered Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-3 text-purple-400" size={17} />
                    <input
                      type="email"
                      placeholder="Enter your registered email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      className="w-full bg-[#1b1928] border border-gray-700 rounded-xl py-2.5 pl-11 pr-4 text-sm outline-none focus:border-purple-500 transition"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5">
                    6-digit OTP email પર આવશે (10 minutes valid)
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 font-semibold transition disabled:opacity-50 text-sm"
                >
                  {forgotLoading ? "OTP મોકલી રહ્યા છીએ..." : "Send OTP"}
                </button>

                <button
                  type="button"
                  onClick={closeForgotModal}
                  className="w-full py-2.5 rounded-xl border border-gray-700 hover:bg-white/5 text-gray-400 hover:text-white transition text-xs"
                >
                  Cancel
                </button>
              </form>
            )}

            {/* Step 2: Verify OTP + New Password */}
            {forgotStep === 2 && (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                {/* OTP */}
                <div>
                  <label className="block text-xs text-gray-300 mb-1.5 font-medium">
                    Email OTP
                  </label>
                  <div className="relative">
                    <Shield className="absolute left-4 top-3 text-purple-400" size={17} />
                    <input
                      type="text"
                      placeholder="6-digit OTP enter કરો"
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      required
                      maxLength={6}
                      className="w-full bg-[#1b1928] border border-gray-700 rounded-xl py-2.5 pl-11 pr-4 text-sm outline-none focus:border-purple-500 transition tracking-widest"
                    />
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-xs text-gray-300 mb-1.5 font-medium">
                    New Password (min 6 characters)
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-3 text-purple-400" size={17} />
                    <input
                      type={showForgotPass ? "text" : "password"}
                      placeholder="New password enter કરો"
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full bg-[#1b1928] border border-gray-700 rounded-xl py-2.5 pl-11 pr-11 text-sm outline-none focus:border-purple-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotPass(!showForgotPass)}
                      className="absolute right-3.5 top-3 text-gray-400"
                    >
                      {showForgotPass ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs text-gray-300 mb-1.5 font-medium">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-3 text-purple-400" size={17} />
                    <input
                      type={showForgotPass ? "text" : "password"}
                      placeholder="Password ફરી enter કરો"
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full bg-[#1b1928] border border-gray-700 rounded-xl py-2.5 pl-11 pr-4 text-sm outline-none focus:border-purple-500 transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-3 mt-1 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 font-semibold transition disabled:opacity-50 text-sm"
                >
                  {forgotLoading ? "Password reset થઈ રહ્યો છે..." : "Reset Password"}
                </button>

                <button
                  type="button"
                  onClick={() => { setForgotStep(1); setForgotError(""); setForgotOtp(""); }}
                  className="w-full py-2.5 rounded-xl border border-gray-700 hover:bg-white/5 text-gray-400 hover:text-white transition text-xs"
                >
                  ← Back (Resend OTP)
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;
