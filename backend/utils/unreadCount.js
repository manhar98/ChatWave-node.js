import Message from "../models/Message.js";

// કોઈ user માટે એક chat ના unread messages ગણો
export const getUnreadCount = (chatId, userId) => {
  return Message.countDocuments({
    chat: chatId,
    sender: { $ne: userId },
    isRead: false,
    readBy: { $ne: userId },
    deletedFor: { $ne: userId },
  });
};