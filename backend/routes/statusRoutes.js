
import express from "express";
import protectRoute from "../middleware/authMiddleware.js";


import {
  uploadStatus,
  getAllStatus,
  deleteStatus,
  viewStatus,
} from "../controllers/statusController.js";

import upload from "../middleware/statusUploadMiddleware.js";

const router = express.Router();

// Get All Status
router.get("/", protectRoute, getAllStatus);

// Upload Status
router.post(
  "/",
  protectRoute,
  upload.single("media"),
  uploadStatus
);

// View Status
router.patch("/:statusId/view", protectRoute, viewStatus);

// Delete Status
router.delete("/:statusId", protectRoute, deleteStatus);

export default router;
