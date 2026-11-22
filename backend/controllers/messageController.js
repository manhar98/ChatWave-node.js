import Message from "../models/Message.js";
import Chat from "../models/Chat.js";
import { getIO } from "../socket/socketHandler.js";
import { getUnreadCount } from "../utils/unreadCount.js";

const isValidId = (id) => /^[0-9a-fA-F]{24}$/.test(String(id));

// Send Message
export const sendMessage = async (req, res) => {
  try {
    const { chatId, content, replyTo } = req.body;

    if (!chatId || !content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Chat ID and message are required",
      });
    }

    if (!isValidId(chatId)) {
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

    // Validate reply message
    if (replyTo) {
      if (!isValidId(replyTo)) {
        return res.status(400).json({
          success: false,
          message: "Invalid Reply Message ID",
        });
      }

      const originalMessage = await Message.findOne({
        _id: replyTo,
        chat: chatId,
      });

      if (!originalMessage) {
        return res.status(404).json({
          success: false,
          message: "Original message not found",
        });
      }
    }

    let newMessage = await Message.create({
      chat: chatId,
      sender: req.user._id,
      content: content.trim(),
      messageType: "text",
      replyTo: replyTo || null,
    });

    chat.latestMessage = newMessage._id;
    await chat.save();

    newMessage = await Message.findById(newMessage._id)
      .populate("sender", "fullName email profilePic")
      .populate("chat")
      .populate({
        path: "replyTo",
        populate: {
          path: "sender",
          select: "fullName email profilePic",
        },
      });

    const socketIO = getIO();

    // Send message to users currently inside this chat
    socketIO.to(`chat:${chatId}`).emit("new_message", newMessage);

    // Notify receivers' personal rooms about unread count
    const receiverIds = chat.participants.filter(
      (participantId) => participantId.toString() !== req.user._id.toString(),
    );

    for (const receiverId of receiverIds) {
      const unreadCount = await getUnreadCount(chatId, receiverId);

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

    if (!isValidId(chatId)) {
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
      .populate("reactions.user", "fullName profilePic")
      .populate({
        path: "replyTo",
        populate: {
          path: "sender",
          select: "fullName email profilePic",
        },
      })
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

    if (!isValidId(chatId)) {
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

    // મેં હજી ન વાંચેલા બીજાના messages
    const unreadMessages = await Message.find({
      chat: chatId,
      sender: { $ne: userId },
      readBy: { $ne: userId },
      deletedFor: { $ne: userId },
    }).select("_id");

    if (unreadMessages.length > 0) {
      const messageIds = unreadMessages.map((message) => message._id);

      // મારો ID readBy માં ઉમેરો
      await Message.updateMany(
        { _id: { $in: messageIds } },
        { $addToSet: { readBy: userId } },
      );

      // મોકલનાર સિવાય બધા વાંચી લે ત્યારે જ isRead = true
      const othersCount = chat.participants.length - 1;

      await Message.updateMany(
        {
          _id: { $in: messageIds },
          isRead: false,
          $expr: { $gte: [{ $size: "$readBy" }, othersCount] },
        },
        { $set: { isRead: true } },
      );

      const fullyRead = await Message.find({
        _id: { $in: messageIds },
        isRead: true,
      }).select("_id");

      const socketIO = getIO();

      socketIO.to(`chat:${chatId}`).emit("messages_read", {
        chatId,
        readerId: userId.toString(),
        messageIds: fullyRead.map((message) => message._id.toString()),
      });

      // મારા માટે unread count 0
      socketIO.to(`user:${userId}`).emit("unread_count_updated", {
        chatId: chatId.toString(),
        unreadCount: 0,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Messages marked as read",
      modifiedCount: unreadMessages.length,
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

    if (!isValidId(messageId)) {
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

    if (!isValidId(messageId)) {
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
    message.isPinned = false;
    message.pinnedAt = null;
    message.pinnedBy = null;
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

    if (!isValidId(chatId)) {
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

// Add or remove message reaction
export const toggleMessageReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    const allowedEmojis = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

    if (!isValidId(messageId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Message ID",
      });
    }

    if (!allowedEmojis.includes(emoji)) {
      return res.status(400).json({
        success: false,
        message: "Invalid reaction emoji",
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
      participants: userId,
    });

    if (!chat) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to react to this message",
      });
    }

    if (message.isDeletedForEveryone) {
      return res.status(400).json({
        success: false,
        message: "Cannot react to a deleted message",
      });
    }

    // Find the current user's existing reaction
    const existingIndex = message.reactions.findIndex(
      (reaction) => reaction.user.toString() === userId.toString(),
    );

    let action;

    if (existingIndex !== -1) {
      const existingReaction = message.reactions[existingIndex];

      if (existingReaction.emoji === emoji) {
        // Same emoji clicked again: remove reaction
        message.reactions.splice(existingIndex, 1);
        action = "removed";
      } else {
        // Change existing reaction
        existingReaction.emoji = emoji;
        action = "updated";
      }
    } else {
      // Add new reaction
      message.reactions.push({
        user: userId,
        emoji,
      });
      action = "added";
    }

    await message.save();

    const updatedMessage = await Message.findById(messageId).populate(
      "reactions.user",
      "fullName profilePic",
    );

    const reactionData = {
      messageId: message._id.toString(),
      chatId: message.chat.toString(),
      reactions: updatedMessage.reactions,
    };

    // Send updated reaction to everyone in this chat
    getIO()
      .to(`chat:${message.chat}`)
      .emit("message_reaction_updated", reactionData);

    return res.status(200).json({
      success: true,
      message: `Reaction ${action} successfully`,
      data: reactionData,
    });
  } catch (error) {
    console.log("Toggle Message Reaction Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// Edit Message
export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user._id;

    // Validate Message ID
    if (!isValidId(messageId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Message ID",
      });
    }

    // Validate content
    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message content is required",
      });
    }

    // Find message
    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    // Only sender can edit
    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own messages",
      });
    }

    // Check chat membership
    const chat = await Chat.findOne({
      _id: message.chat,
      participants: userId,
    });

    if (!chat) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to edit this message",
      });
    }

    // Do not edit deleted messages
    if (message.isDeletedForEveryone) {
      return res.status(400).json({
        success: false,
        message: "Deleted messages cannot be edited",
      });
    }

    // Only text messages can be edited
    if (message.messageType !== "text") {
      return res.status(400).json({
        success: false,
        message: "Only text messages can be edited",
      });
    }

    // Update message
    message.content = content.trim();
    message.isEdited = true;
    message.editedAt = new Date();

    await message.save();

    // Populate sender
    const updatedMessage = await Message.findById(messageId)
      .populate("sender", "fullName email profilePic")
      .populate("reactions.user", "fullName profilePic");

    const editData = {
      messageId: message._id.toString(),
      chatId: message.chat.toString(),
      content: updatedMessage.content,
      isEdited: updatedMessage.isEdited,
      editedAt: updatedMessage.editedAt,
    };

    // Send update to everyone in the chat
    getIO().to(`chat:${message.chat}`).emit("message_edited", editData);

    return res.status(200).json({
      success: true,
      message: "Message edited successfully",
      data: updatedMessage,
    });
  } catch (error) {
    console.log("Edit Message Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// Forward Message
export const forwardMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { chatId } = req.body;
    const userId = req.user._id;

    // Validate IDs
    if (!isValidId(messageId) || !chatId || !isValidId(chatId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Message ID or Chat ID",
      });
    }

    // Find original message
    const originalMessage = await Message.findOne({
      _id: messageId,
      deletedFor: { $ne: userId },
      isDeletedForEveryone: false,
    });

    if (!originalMessage) {
      return res.status(404).json({
        success: false,
        message: "Original message not found",
      });
    }

    // Check access to original message's chat
    const originalChat = await Chat.findOne({
      _id: originalMessage.chat,
      participants: userId,
    });

    if (!originalChat) {
      return res.status(403).json({
        success: false,
        message: "You cannot forward this message",
      });
    }

    // Check destination chat
    const destinationChat = await Chat.findOne({
      _id: chatId,
      participants: userId,
    });

    if (!destinationChat) {
      return res.status(404).json({
        success: false,
        message: "Destination chat not found",
      });
    }

    // Create forwarded message
    let forwardedMessage = await Message.create({
      chat: chatId,
      sender: userId,
      content: originalMessage.content,
      messageType: originalMessage.messageType,
      isForwarded: true,
      forwardedFrom: originalMessage._id,
      replyTo: null,
    });

    // Update latest message
    destinationChat.latestMessage = forwardedMessage._id;
    await destinationChat.save();

    // Populate forwarded message
    forwardedMessage = await Message.findById(forwardedMessage._id)
      .populate("sender", "fullName email profilePic")
      .populate("chat")
      .populate({
        path: "forwardedFrom",
        populate: {
          path: "sender",
          select: "fullName email profilePic",
        },
      });

    const socketIO = getIO();

    // Send forwarded message in destination chat
    socketIO.to(`chat:${chatId}`).emit("new_message", forwardedMessage);

    // Update unread count for other participants
    const receiverIds = destinationChat.participants.filter(
      (participantId) => participantId.toString() !== userId.toString(),
    );

    for (const receiverId of receiverIds) {
      const unreadCount = await getUnreadCount(chatId, receiverId);

      socketIO.to(`user:${receiverId}`).emit("unread_count_updated", {
        chatId: chatId.toString(),
        unreadCount,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Message forwarded successfully",
      data: forwardedMessage,
    });
  } catch (error) {
    console.log("Forward Message Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// Pin Message
export const pinMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    // Validate Message ID
    if (!isValidId(messageId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Message ID",
      });
    }

    // Find message
    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    // Check chat membership
    const chat = await Chat.findOne({
      _id: message.chat,
      participants: userId,
    });

    if (!chat) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to pin this message",
      });
    }

    // Do not pin deleted messages
    if (message.isDeletedForEveryone) {
      return res.status(400).json({
        success: false,
        message: "Deleted messages cannot be pinned",
      });
    }

    // Check if already pinned
    if (message.isPinned) {
      return res.status(400).json({
        success: false,
        message: "Message is already pinned",
      });
    }

    // Pin message
    message.isPinned = true;
    message.pinnedAt = new Date();
    message.pinnedBy = userId;

    await message.save();

    // Populate pinned message
    const updatedMessage = await Message.findById(messageId)
      .populate("sender", "fullName email profilePic")
      .populate("pinnedBy", "fullName email profilePic");

    const pinData = {
      messageId: message._id.toString(),
      chatId: message.chat.toString(),
      message: updatedMessage,
    };

    // Notify everyone in chat
    getIO().to(`chat:${message.chat}`).emit("message_pinned", pinData);

    return res.status(200).json({
      success: true,
      message: "Message pinned successfully",
      data: updatedMessage,
    });
  } catch (error) {
    console.log("Pin Message Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// Unpin Message
export const unpinMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    // Validate Message ID
    if (!isValidId(messageId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Message ID",
      });
    }

    // Find message
    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    // Check chat membership
    const chat = await Chat.findOne({
      _id: message.chat,
      participants: userId,
    });

    if (!chat) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to unpin this message",
      });
    }

    // Check if message is pinned
    if (!message.isPinned) {
      return res.status(400).json({
        success: false,
        message: "Message is not pinned",
      });
    }

    // Unpin message
    message.isPinned = false;
    message.pinnedAt = null;
    message.pinnedBy = null;

    await message.save();

    const updatedMessage = await Message.findById(messageId).populate(
      "sender",
      "fullName email profilePic",
    );

    const unpinData = {
      messageId: message._id.toString(),
      chatId: message.chat.toString(),
      message: updatedMessage,
    };

    // Notify everyone in chat
    getIO().to(`chat:${message.chat}`).emit("message_unpinned", unpinData);

    return res.status(200).json({
      success: true,
      message: "Message unpinned successfully",
      data: updatedMessage,
    });
  } catch (error) {
    console.log("Unpin Message Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// Star Message
export const starMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    // Validate Message ID
    if (!isValidId(messageId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Message ID",
      });
    }

    // Find message
    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    // Check chat membership
    const chat = await Chat.findOne({
      _id: message.chat,
      participants: userId,
    });

    if (!chat) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to star this message",
      });
    }

    // Check deleted message
    if (message.isDeletedForEveryone) {
      return res.status(400).json({
        success: false,
        message: "Deleted messages cannot be starred",
      });
    }

    // Add user to starredBy
    await Message.updateOne(
      { _id: messageId },
      { $addToSet: { starredBy: userId } },
    );

    return res.status(200).json({
      success: true,
      message: "Message starred successfully",
    });
  } catch (error) {
    console.log("Star Message Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// Unstar Message
export const unstarMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    // Validate Message ID
    if (!isValidId(messageId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Message ID",
      });
    }

    // Find message
    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    // Check chat membership
    const chat = await Chat.findOne({
      _id: message.chat,
      participants: userId,
    });

    if (!chat) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to unstar this message",
      });
    }

    // Remove user from starredBy
    await Message.updateOne(
      { _id: messageId },
      { $pull: { starredBy: userId } },
    );

    return res.status(200).json({
      success: true,
      message: "Message unstarred successfully",
    });
  } catch (error) {
    console.log("Unstar Message Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// Get My Starred Messages
export const getStarredMessages = async (req, res) => {
  try {
    const userId = req.user._id;

    const messages = await Message.find({
      starredBy: userId,
      isDeletedForEveryone: false,
      deletedFor: { $ne: userId },
    })
      .populate("sender", "fullName email profilePic")
      .populate({
        path: "chat",
        populate: {
          path: "participants",
          select: "fullName email profilePic",
        },
      })
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      totalMessages: messages.length,
      messages,
    });
  } catch (error) {
    console.log("Get Starred Messages Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// Send Photo / Video
export const sendMediaMessage = async (req, res) => {
  try {
    const { chatId } = req.body;

    if (!chatId || !isValidId(chatId)) {
      return res.status(400).json({
        success: false,
        message: "Valid Chat ID is required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select a photo or video",
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

    const mime = req.file.mimetype;
    let messageType = "document";
    if (mime.startsWith("image/")) messageType = "image";
    else if (mime.startsWith("video/")) messageType = "video";
    else if (mime === "application/pdf") messageType = "pdf";
    else if (mime.startsWith("audio/")) messageType = "audio";

    const mediaUrl = `/uploads/${req.file.filename}`;

    let newMessage = await Message.create({
      chat: chatId,
      sender: req.user._id,
      content: req.body.caption || "",
      messageType,
      mediaUrl,
      mediaName: req.file.originalname,
      mediaSize: req.file.size,
    });

    chat.latestMessage = newMessage._id;
    await chat.save();

    newMessage = await Message.findById(newMessage._id)
      .populate("sender", "fullName email profilePic")
      .populate("chat");

    const socketIO = getIO();

    socketIO.to(`chat:${chatId}`).emit("new_message", newMessage);

    const receiverIds = chat.participants.filter(
      (participantId) => participantId.toString() !== req.user._id.toString(),
    );

    for (const receiverId of receiverIds) {
      const unreadCount = await getUnreadCount(chatId, receiverId);

      socketIO.to(`user:${receiverId}`).emit("unread_count_updated", {
        chatId: chatId.toString(),
        unreadCount,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Media sent successfully",
      data: newMessage,
    });
  } catch (error) {
    console.log("Send Media Message Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Media upload failed",
    });
  }
};