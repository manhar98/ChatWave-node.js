
import express from "express";

import protectRoute from "../middleware/authMiddleware.js";

import {
  sendMessage,
  getMessages,
  markMessagesAsRead,
  markMessagesAsDelivered,
  deleteMessageForMe,
  deleteMessageForEveryone,
} from "../controllers/messageController.js";

const router = express.Router();


// Send Message
router.post("/", protectRoute, sendMessage);

// Get Messages
router.get("/:chatId", protectRoute, getMessages);

// Mark Messages as Read
router.patch("/:chatId/read", protectRoute, markMessagesAsRead);

router.patch("/:chatId/delivered", protectRoute, markMessagesAsDelivered);

// Delete Message for Me
router.delete("/:messageId/me", protectRoute, deleteMessageForMe);

// Delete Message for Everyone
router.delete("/:messageId/everyone", protectRoute, deleteMessageForEveryone);

export default router;
