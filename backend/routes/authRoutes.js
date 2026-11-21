import express from "express";

import {
  registerUser,
  loginUser,
  resetPassword,
} from "../controllers/authController.js";

const router = express.Router();

// Register API
router.post("/register", registerUser);

// Login API
router.post("/login", loginUser);

// Reset / Forgot Password API
router.post("/reset-password", resetPassword);
router.post("/forgot-password", resetPassword);

export default router;