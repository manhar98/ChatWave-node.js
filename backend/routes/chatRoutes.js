
import express from "express";

import protectRoute from "../middleware/authMiddleware.js";

import {
  createChat,
  getMyChats,
} from "../controllers/chatController.js";

const router = express.Router();

// Create New Chat
router.post("/", protectRoute, createChat);

// Get All My Chats
router.get("/", protectRoute, getMyChats);

export default router;
