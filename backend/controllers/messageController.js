import Message from "../models/Message.js";
import Chat from "../models/Chat.js";
import { getIO } from "../socket/socketHandler.js";

// Send Message
export const sendMessage = async (req, res) => {
  try {
    const { chatId, content } = req.body;

    if (!chatId || !content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Chat ID and message are required",
      });
    }

    if (!/^[0-9a-fA-F]{24}$/.test(chatId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Chat ID",
      });
    }

    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user._id,
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    let newMessage = await Message.create({
      chat: chatId,
      sender: req.user._id,
      content: content.trim(),
      messageType: "text",
    });

    chat.latestMessage = newMessage._id;
    await chat.save();

    newMessage = await Message.findById(newMessage._id)
      .populate("sender", "fullName email profilePic")
      .populate("chat");

    const socketIO = getIO();

    // Send message to users currently inside this chat
    socketIO.to(`chat:${chatId}`).emit("new_message", newMessage);

    // Notify receiver's personal room about unread count
    const receiverIds = chat.participants.filter(
      (participantId) => participantId.toString() !== req.user._id.toString(),
    );

    for (const receiverId of receiverIds) {
      const unreadCount = await Message.countDocuments({
        chat: chatId,
        sender: { $ne: receiverId },
        isRead: false,
        deletedFor: { $ne: receiverId },
      });

      socketIO.to(`user:${receiverId}`).emit("unread_count_updated", {
        chatId: chatId.toString(),
        unreadCount,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: newMessage,
    });
  } catch (error) {
    console.log("Send Message Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// Get Messages
export const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;

    if (!/^[0-9a-fA-F]{24}$/.test(chatId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Chat ID",
      });
    }

    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user._id,
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    const messages = await Message.find({
      chat: chatId,
      deletedFor: { $ne: req.user._id },
    })
      .populate("sender", "fullName email profilePic")
      .sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      totalMessages: messages.length,
      messages,
    });
  } catch (error) {
    console.log("Get Messages Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// Mark Messages as Read
export const markMessagesAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    if (!/^[0-9a-fA-F]{24}$/.test(chatId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Chat ID",
      });
    }

    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId,
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    // Mark only other user's unread messages as read
    const result = await Message.updateMany(
      {
        chat: chatId,
        sender: { $ne: userId },
        isRead: false,
        deletedFor: { $ne: userId },
      },
      {
        $set: { isRead: true },
      },
    );

    // Notify the other participant through Socket.IO

    if (result.modifiedCount > 0) {
      const socketIO = getIO();

      socketIO.to(`chat:${chatId}`).emit("messages_read", {
        chatId,
        readerId: userId.toString(),
      });

      // Reset unread count for the user who read messages
      socketIO.to(`user:${userId}`).emit("unread_count_updated", {
        chatId: chatId.toString(),
        unreadCount: 0,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Messages marked as read",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.log("Mark Messages As Read Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// Delete Message for Me
export const deleteMessageForMe = async (req, res) => {
  try {
    const { messageId } = req.params;

    if (!/^[0-9a-fA-F]{24}$/.test(messageId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Message ID",
      });
    }

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    const chat = await Chat.findOne({
      _id: message.chat,
      participants: req.user._id,
    });

    if (!chat) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to delete this message",
      });
    }

    await Message.updateOne(
      { _id: messageId },
      { $addToSet: { deletedFor: req.user._id } },
    );

    getIO().to(`user:${req.user._id}`).emit("message_deleted_for_me", {
      messageId,
      chatId: message.chat.toString(),
    });

    return res.status(200).json({
      success: true,
      message: "Message deleted for you",
    });
  } catch (error) {
    console.log("Delete Message For Me Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// Delete Message for Everyone
export const deleteMessageForEveryone = async (req, res) => {
  try {
    const { messageId } = req.params;

    if (!/^[0-9a-fA-F]{24}$/.test(messageId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Message ID",
      });
    }

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    // Only the sender can delete for everyone
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only the sender can delete this message",
      });
    }

    const chat = await Chat.findOne({
      _id: message.chat,
      participants: req.user._id,
    });

    if (!chat) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to delete this message",
      });
    }

    message.isDeletedForEveryone = true;
    message.content = "This message was deleted";
    await message.save();

    getIO().to(`chat:${message.chat}`).emit("message_deleted_for_everyone", {
      messageId,
      chatId: message.chat.toString(),
      content: "This message was deleted",
    });

    return res.status(200).json({
      success: true,
      message: "Message deleted for everyone",
      data: message,
    });
  } catch (error) {
    console.log("Delete Message For Everyone Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// Mark Messages as Delivered
export const markMessagesAsDelivered = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId,
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    const result = await Message.updateMany(
      {
        chat: chatId,
        sender: { $ne: userId },
        isDelivered: false,
        deletedFor: { $ne: userId },
      },
      {
        $set: {
          isDelivered: true,
          deliveredAt: new Date(),
        },
      },
    );

    if (result.modifiedCount > 0) {
      getIO().to(`chat:${chatId}`).emit("messages_delivered", {
        chatId,
        receiverId: userId.toString(),
      });
    }

    return res.status(200).json({
      success: true,
      message: "Messages delivered successfully",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.log("Mark Messages Delivered Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
