
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

import User from "../models/User.js";
import Chat from "../models/Chat.js";
import Message from "../models/Message.js";

let io;

// userId -> Number of active socket connections
const onlineConnections = new Map();

// Allowed Frontend Origins
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://chat-wave-node-js-15np.vercel.app",
  process.env.FRONTEND_URL,
].filter(Boolean);

// Deliver Pending Messages
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

        // Notify message senders
        senderIds.forEach((senderId) => {
          io.to(`user:${senderId}`).emit(
            "messages_delivered",
            deliveryData
          );
        });

        // Notify users inside chat
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

// Broadcast Online / Offline Status
const broadcastUserStatus = async (
  userId,
  isOnline,
  lastSeen
) => {
  try {
    const chats = await Chat.find({
      participants: userId,
    }).select("participants");

    const contactIds = new Set();

    chats.forEach((chat) => {
      chat.participants.forEach((participantId) => {
        const id = String(participantId);

        if (id !== String(userId)) {
          contactIds.add(id);
        }
      });
    });

    const statusData = {
      userId: String(userId),
      isOnline,
      lastSeen,
    };

    contactIds.forEach((contactId) => {
      io.to(`user:${contactId}`).emit(
        "user_status",
        statusData
      );
    });
  } catch (error) {
    console.log(
      "Broadcast User Status Error:",
      error.message
    );
  }
};

// Initialize Socket.IO
export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(
            new Error("Socket.IO CORS: Origin not allowed")
          );
        }
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Reset old online statuses after server restart
  User.updateMany(
    { isOnline: true },
    { $set: { isOnline: false } }
  ).catch((error) => {
    console.log(
      "Reset Online Status Error:",
      error.message
    );
  });

  // JWT Authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

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
      console.log("Socket Authentication Error:", error.message);
      next(new Error("Invalid or expired token"));
    }
  });

  // User Connection
  io.on("connection", async (socket) => {
    const userId = socket.user._id.toString();

    console.log("User Connected:", userId);

    // Join personal room
    socket.join(`user:${userId}`);

    // Count active connections
    const previousCount =
      onlineConnections.get(userId) || 0;

    onlineConnections.set(
      userId,
      previousCount + 1
    );

    // First connection means Online
    if (previousCount === 0) {
      try {
        await User.findByIdAndUpdate(userId, {
          isOnline: true,
        });

        await broadcastUserStatus(
          userId,
          true,
          null
        );
      } catch (error) {
        console.log(
          "Set Online Error:",
          error.message
        );
      }
    }

    // Deliver pending messages when user comes online
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

        await deliverPendingMessages(
          userId,
          chatId
        );

        callback?.({
          success: true,
          message: "Joined chat successfully",
        });

        console.log("User Joined Chat:", chatId);
      } catch (error) {
        console.log(
          "Join Chat Error:",
          error.message
        );

        callback?.({
          success: false,
          message: "Unable to join chat",
        });
      }
    });

    // Typing Started
    socket.on("typing", (chatId) => {
      if (
        !chatId ||
        !socket.rooms.has(`chat:${chatId}`)
      ) {
        return;
      }

      socket
        .to(`chat:${chatId}`)
        .emit("user_typing", {
          chatId: String(chatId),
          userId,
        });
    });

    // Typing Stopped
    socket.on("stop_typing", (chatId) => {
      if (
        !chatId ||
        !socket.rooms.has(`chat:${chatId}`)
      ) {
        return;
      }

      socket
        .to(`chat:${chatId}`)
        .emit("user_stop_typing", {
          chatId: String(chatId),
          userId,
        });
    });

    // User Disconnected
    socket.on("disconnect", async () => {
      console.log("User Disconnected:", userId);

      const remaining =
        (onlineConnections.get(userId) || 1) - 1;

      if (remaining > 0) {
        onlineConnections.set(userId, remaining);
        return;
      }

      // Last connection closed
      onlineConnections.delete(userId);

      try {
        const lastSeen = new Date();

        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastSeen,
        });

        await broadcastUserStatus(
          userId,
          false,
          lastSeen
        );
      } catch (error) {
        console.log(
          "Set Offline Error:",
          error.message
        );
      }
    });
  });

  console.log("Socket.IO Server Initialized!");

  return io;
};

// Get Socket Instance
export const getIO = () => {
  if (!io) {
    throw new Error(
      "Socket.IO is not initialized"
    );
  }

  return io;
};
