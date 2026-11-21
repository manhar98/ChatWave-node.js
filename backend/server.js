
import dns from "node:dns";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import { initSocket } from "./socket/socketHandler.js";
import statusRoutes from "./routes/statusRoutes.js";

// Fix MongoDB DNS Resolution
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import "dotenv/config";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";

import connectDB from "./config/db.js";

// Express App
const app = express();

// HTTP Server
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS Configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);


// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/messages", messageRoutes);
app.use("/uploads", express.static("uploads"));
app.use("/api/status", statusRoutes);


// Test API
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to ChatWave Backend API!",
  });
});

// Health Check API
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "ChatWave Server is Running Successfully!",
    status: "OK",
  });
});

// 404 Route
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API Route Not Found",
  });
});

// Start Server
const PORT = process.env.PORT || 8000;

const startServer = async () => {
  try {
    await connectDB();

    // Initialize Socket.IO
    initSocket(server);

    server.listen(PORT, () => {
      console.log(`ChatWave Server running on port ${PORT}`);
      console.log(`Server URL: http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error("Server Startup Error:", error.message);
    process.exit(1);
  }
};

startServer();
