
import Chat from "../models/Chat.js";
import User from "../models/User.js";
import Message from "../models/Message.js";

// Create One-to-One Chat
export const createChat = async (req, res) => {
  try {
    const { userId } = req.body;

    // Check user ID
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Check valid MongoDB ID
    if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid User ID",
      });
    }

    // Check if user exists
    const receiver = await User.findById(userId);

    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent chatting with yourself
    if (req.user._id.toString() === userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot chat with yourself",
      });
    }

    // Check existing chat
    let existingChat = await Chat.findOne({
      isGroupChat: false,
      participants: {
        $all: [req.user._id, userId],
        $size: 2,
      },
    }).populate("participants", "fullName email profilePic");

    if (existingChat) {
      return res.status(200).json({
        success: true,
        message: "Chat already exists",
        chat: existingChat,
      });
    }

    // Create new chat
    const newChat = await Chat.create({
      participants: [req.user._id, userId],
      isGroupChat: false,
    });

    const fullChat = await Chat.findById(newChat._id)
      .populate("participants", "fullName email profilePic");

    return res.status(201).json({
      success: true,
      message: "Chat created successfully",
      chat: fullChat,
    });
  } catch (error) {
    console.log("Create Chat Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// Get All My Chats with Unread Message Count
export const getMyChats = async (req, res) => {
  try {
    const userId = req.user._id;

    const chats = await Chat.find({
      participants: userId,
    })
      .populate("participants", "fullName email profilePic")
      .populate({
        path: "latestMessage",
        select: "content sender createdAt",
      })
      .sort({ updatedAt: -1 });

    // Calculate unread count for every chat
    const chatsWithUnreadCount = await Promise.all(
      chats.map(async (chat) => {
        const unreadCount = await Message.countDocuments({
          chat: chat._id,
          sender: { $ne: userId },
          isRead: false,
          deletedFor: { $ne: userId },
        });

        return {
          ...chat.toObject(),
          unreadCount,
        };
      })
    );

    return res.status(200).json({
      success: true,
      totalChats: chatsWithUnreadCount.length,
      chats: chatsWithUnreadCount,
    });
  } catch (error) {
    console.log("Get Chats Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
