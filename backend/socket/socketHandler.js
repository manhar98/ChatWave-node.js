
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

import User from "../models/User.js";
import Chat from "../models/Chat.js";
import Message from "../models/Message.js";

let io;

// Deliver pending messages when a user comes online
const deliverPendingMessages = async (userId, chatId = null) => {
  try {
    const chatQuery = {
      participants: userId,
    };

    if (chatId) {
      chatQuery._id = chatId;
    }

    const chats = await Chat.find(chatQuery);

    for (const chat of chats) {
      const pendingMessages = await Message.find({
        chat: chat._id,
        sender: { $ne: userId },
        isDelivered: false,
        deletedFor: { $ne: userId },
      }).select("sender");

      if (pendingMessages.length === 0) continue;

      const result = await Message.updateMany(
        {
          chat: chat._id,
          sender: { $ne: userId },
          isDelivered: false,
          deletedFor: { $ne: userId },
        },
        {
          $set: {
            isDelivered: true,
            deliveredAt: new Date(),
          },
        }
      );

      if (result.modifiedCount > 0) {
        const senderIds = [
          ...new Set(
            pendingMessages.map((message) =>
              String(message.sender)
            )
          ),
        ];

        const deliveryData = {
          chatId: chat._id.toString(),
          receiverId: userId.toString(),
        };

        // Notify sender directly
        senderIds.forEach((senderId) => {
          io.to(`user:${senderId}`).emit(
            "messages_delivered",
            deliveryData
          );
        });

        // Notify users currently inside this chat
        io.to(`chat:${chat._id}`).emit(
          "messages_delivered",
          deliveryData
        );
      }
    }
  } catch (error) {
    console.log(
      "Pending Messages Delivery Error:",
      error.message
    );
  }
};

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin:
        process.env.FRONTEND_URL || "http://localhost:5173",
      credentials: true,
    },
  });

  // Verify User Token
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(
          new Error("Authentication token required")
        );
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );

      const user = await User.findById(
        decoded.userId
      ).select("_id fullName");

      if (!user) {
        return next(new Error("User not found"));
      }

      socket.user = user;

      next();
    } catch (error) {
      next(new Error("Invalid or expired token"));
    }
  });

  // User Connected
  io.on("connection", (socket) => {
    const userId = socket.user._id.toString();

    console.log("User Connected:", userId);

    // Join personal room
    socket.join(`user:${userId}`);

    // User Online - Deliver Pending Messages
    socket.on("user_online", async () => {
      await deliverPendingMessages(userId);
    });

    // Join Chat Room
    socket.on("join_chat", async (chatId, callback) => {
      try {
        const chat = await Chat.findOne({
          _id: chatId,
          participants: socket.user._id,
        });

        if (!chat) {
          return callback?.({
            success: false,
            message: "Chat not found",
          });
        }

        socket.join(`chat:${chatId}`);

        // Deliver pending messages before confirming join
        await deliverPendingMessages(userId, chatId);

        callback?.({
          success: true,
          message: "Joined chat successfully",
        });

        console.log("User Joined Chat:", chatId);
      } catch (error) {
        console.log("Join Chat Error:", error.message);

        callback?.({
          success: false,
          message: "Unable to join chat",
        });
      }
    });

    // User Disconnected
    socket.on("disconnect", () => {
      console.log("User Disconnected:", userId);
    });
  });

  console.log("Socket.IO Server Initialized!");

  return io;
};

// Get Socket Instance
export const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO is not initialized");
  }

  return io;
};
