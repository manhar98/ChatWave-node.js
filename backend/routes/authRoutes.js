import express from "express";

import {
  registerUser,
  loginUser,
  resetPassword,
  sendOTP,
  verifyOTPAndReset,
} from "../controllers/authController.js";

const router = express.Router();

// Register API
router.post("/register", registerUser);

// Login API
router.post("/login", loginUser);

// OTP-based Forgot Password
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTPAndReset);

// Legacy Reset / Forgot Password API
router.post("/reset-password", resetPassword);
router.post("/forgot-password", resetPassword);

export default router;
