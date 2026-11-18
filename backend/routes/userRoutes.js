
import express from "express";

import protectRoute from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

import {
  getMyProfile,
  updateMyProfile,
  searchUsers,
} from "../controllers/userController.js";

const router = express.Router();

// Get My Profile
router.get("/profile", protectRoute, getMyProfile);

// Update My Profile with Profile Picture
router.put(
  "/profile",
  protectRoute,
  upload.single("profilePic"),
  updateMyProfile
);

// Search Users
router.get("/search", protectRoute, searchUsers);

export default router;
