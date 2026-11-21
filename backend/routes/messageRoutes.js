import express from "express";

import protectRoute from "../middleware/authMiddleware.js";
import upload from "../middleware/messageUploadMiddleware.js";

import {
  sendMessage,
  sendMediaMessage,
  getMessages,
  markMessagesAsRead,
  markMessagesAsDelivered,
  deleteMessageForMe,
  deleteMessageForEveryone,
  toggleMessageReaction,
  editMessage,
  forwardMessage,
  pinMessage,
  unpinMessage,
  starMessage,
  unstarMessage,
  getStarredMessages,
} from "../controllers/messageController.js";

const router = express.Router();

// Send Message
router.post("/", protectRoute, sendMessage);

// Send Photo / Video
router.post("/media", protectRoute, upload.single("media"), sendMediaMessage);

// Starred Messages
// IMPORTANT: Keep this route before /:chatId
router.get("/starred", protectRoute, getStarredMessages);

// Star Message
router.patch("/:messageId/star", protectRoute, starMessage);

// Unstar Message
router.patch("/:messageId/unstar", protectRoute, unstarMessage);

// Get Messages
router.get("/:chatId", protectRoute, getMessages);

// Mark Messages as Read
router.patch("/:chatId/read", protectRoute, markMessagesAsRead);

// Mark Messages as Delivered
router.patch("/:chatId/delivered", protectRoute, markMessagesAsDelivered);

// Add / Remove Message Reaction
router.patch("/:messageId/reaction", protectRoute, toggleMessageReaction);

// Forward Message
router.post("/:messageId/forward", protectRoute, forwardMessage);

// Delete Message for Me
router.delete("/:messageId/me", protectRoute, deleteMessageForMe);

// Delete Message for Everyone
router.delete("/:messageId/everyone", protectRoute, deleteMessageForEveryone);

// Edit Message
router.patch("/:messageId/edit", protectRoute, editMessage);

// Pin Message
router.patch("/:messageId/pin", protectRoute, pinMessage);

// Unpin Message
router.patch("/:messageId/unpin", protectRoute, unpinMessage);

export default router;