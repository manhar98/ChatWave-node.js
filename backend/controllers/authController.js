import User from "../models/User.js";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import crypto from "crypto";

// ─── Email Transporter ───────────────────────────────────────────────────────
const getTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// ─── Register New User ────────────────────────────────────────────────────────
export const registerUser = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const existingUser = await User.findOne({
      email: email.toLowerCase().trim(),
    });
    if (existingUser) {
      return res
        .status(409)
        .json({ success: false, message: "Email already registered" });
    }

    const newUser = await User.create({ fullName, email, password });

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: {
        _id: newUser._id,
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        profilePic: newUser.profilePic,
      },
    });
  } catch (error) {
    console.log("Register Error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// ─── Login User ───────────────────────────────────────────────────────────────
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || "7d",
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        _id: user._id,
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        profilePic: user.profilePic,
        bio: user.bio,
      },
    });
  } catch (error) {
    console.log("Login Error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// ─── Send OTP (Forgot Password) ───────────────────────────────────────────────
export const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "No account found with this email" });
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save OTP to user (plain, since it's short-lived and low-risk)
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    console.log(`\n========================================`);
    console.log(`🔐 [ChatWave OTP] For: ${user.email}`);
    console.log(`👉 OTP CODE: ${otp}`);
    console.log(`========================================\n`);

    // Check if email credentials are configured in .env
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        const transporter = getTransporter();
        await transporter.sendMail({
          from: `"ChatWave" <${process.env.EMAIL_USER}>`,
          to: user.email,
          subject: "ChatWave - Password Reset OTP",
          html: `
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;background:#1a1a2e;color:#fff;border-radius:12px;padding:32px;">
              <h2 style="color:#a855f7;text-align:center;">🔐 ChatWave</h2>
              <h3 style="text-align:center;">Password Reset OTP</h3>
              <p style="color:#ccc;">Your one-time password (OTP) to reset your ChatWave password:</p>
              <div style="background:#2d2d4e;border-radius:8px;padding:20px;text-align:center;margin:24px 0;">
                <span style="font-size:36px;font-weight:bold;letter-spacing:12px;color:#a855f7;">${otp}</span>
              </div>
              <p style="color:#ccc;">This OTP will expire in <strong>10 minutes</strong>.</p>
              <p style="color:#888;font-size:12px;">If you did not request this, please ignore this email.</p>
            </div>
          `,
        });

        return res.status(200).json({
          success: true,
          message: "OTP has been sent to your email! Please check your inbox.",
        });
      } catch (mailError) {
        console.log("Mail Sending Error:", mailError.message);
        // Fallback in development so user is not blocked
        return res.status(200).json({
          success: true,
          message: `OTP generated! (Email failed: ${mailError.message})`,
          devOtp: otp,
        });
      }
    }

    // When EMAIL_USER / EMAIL_PASS are not configured yet
    return res.status(200).json({
      success: true,
      message: `OTP generated successfully! (Testing OTP: ${otp})`,
      devOtp: otp,
    });
  } catch (error) {
    console.log("Send OTP Error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to send OTP. Try again." });
  }
};

// ─── Verify OTP & Reset Password ──────────────────────────────────────────────
export const verifyOTPAndReset = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, OTP, and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "No account found with this email" });
    }

    if (!user.otp || !user.otpExpiry) {
      return res.status(400).json({
        success: false,
        message: "No OTP found. Please request a new one.",
      });
    }

    if (new Date() > user.otpExpiry) {
      user.otp = null;
      user.otpExpiry = null;
      await user.save();
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    if (user.otp !== otp.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid OTP. Please try again." });
    }

    // Reset password
    user.password = newPassword;
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message:
        "Password reset successfully! You can now login with your new password.",
    });
  } catch (error) {
    console.log("Verify OTP Error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// ─── Legacy Reset Password (kept for backward compat) ────────────────────────
export const resetPassword = async (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email and new password are required",
      });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Passwords do not match" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email address",
      });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message:
        "Password reset successfully! You can now login with your new password.",
    });
  } catch (error) {
    console.log("Reset Password Error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};
