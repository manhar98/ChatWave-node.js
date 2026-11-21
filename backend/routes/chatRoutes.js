import express from "express";

import protectRoute from "../middleware/authMiddleware.js";

import {
  createChat,
  getMyChats,
  createGroupChat,
  addGroupMembers,
  removeGroupMember,
  leaveGroup,
} from "../controllers/chatController.js";

const router = express.Router();

// Create New Chat
router.post("/", protectRoute, createChat);

// Create Group Chat
router.post("/group", protectRoute, createGroupChat);

// Add Members to Group
router.post("/group/:chatId/members", protectRoute, addGroupMembers);

// Remove Member from Group
router.delete(
  "/group/:chatId/members/:userId",
  protectRoute,
  removeGroupMember,
);

// Leave Group
router.patch("/group/:chatId/leave", protectRoute, leaveGroup);

// Get All My Chats
router.get("/", protectRoute, getMyChats);

export default router;