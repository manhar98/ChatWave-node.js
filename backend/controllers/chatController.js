import Chat from "../models/Chat.js";
import User from "../models/User.js";
import { getIO } from "../socket/socketHandler.js";
import { getUnreadCount } from "../utils/unreadCount.js";

// Participants માં જે fields જોઈએ
const PARTICIPANT_FIELDS = "fullName email profilePic isOnline lastSeen";

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
    }).populate("participants", PARTICIPANT_FIELDS);

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

    const fullChat = await Chat.findById(newChat._id).populate(
      "participants",
      PARTICIPANT_FIELDS,
    );

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
      .populate("participants", PARTICIPANT_FIELDS)
      .populate("groupAdmin", "fullName email profilePic")
      .populate({
        path: "latestMessage",
        select: "content sender createdAt",
      })
      .sort({ updatedAt: -1 });

    // Calculate unread count for every chat
    const chatsWithUnreadCount = await Promise.all(
      chats.map(async (chat) => {
        const unreadCount = await getUnreadCount(chat._id, userId);

        return {
          ...chat.toObject(),
          unreadCount,
        };
      }),
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

// Create Group Chat
export const createGroupChat = async (req, res) => {
  try {
    const { groupName, members } = req.body;
    const adminId = req.user._id.toString();

    // Group name ચકાસો
    if (!groupName || !groupName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Group name is required",
      });
    }

    // Members array ચકાસો
    if (!Array.isArray(members)) {
      return res.status(400).json({
        success: false,
        message: "Members must be an array of user IDs",
      });
    }

    // Invalid ID ચકાસો
    if (members.some((id) => !/^[0-9a-fA-F]{24}$/.test(String(id)))) {
      return res.status(400).json({
        success: false,
        message: "Invalid member ID found",
      });
    }

    // Duplicate અને પોતાનો ID કાઢી નાખો
    const memberIds = [...new Set(members.map(String))].filter(
      (id) => id !== adminId,
    );

    if (memberIds.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Select at least 2 other members to create a group",
      });
    }

    // બધા users database માં છે કે નહીં
    const existingUsers = await User.countDocuments({
      _id: { $in: memberIds },
    });

    if (existingUsers !== memberIds.length) {
      return res.status(404).json({
        success: false,
        message: "One or more users not found",
      });
    }

    // Group બનાવો
    const newGroup = await Chat.create({
      participants: [adminId, ...memberIds],
      isGroupChat: true,
      groupName: groupName.trim(),
      groupAdmin: adminId,
    });

    const fullGroup = await Chat.findById(newGroup._id)
      .populate("participants", PARTICIPANT_FIELDS)
      .populate("groupAdmin", "fullName email profilePic");

    // બધા members ને Real-time જાણ કરો (admin સિવાય)
    const socketIO = getIO();

    memberIds.forEach((memberId) => {
      socketIO.to(`user:${memberId}`).emit("new_group_chat", fullGroup);
    });

    return res.status(201).json({
      success: true,
      message: "Group created successfully",
      chat: fullGroup,
    });
  } catch (error) {
    console.log("Create Group Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};


// ---------- Group Members Management ----------

const isValidId = (id) => /^[0-9a-fA-F]{24}$/.test(String(id));

const populateGroup = (query) =>
  query
    .populate("participants", PARTICIPANT_FIELDS)
    .populate("groupAdmin", "fullName email profilePic");

// Add Members to Group (ફક્ત Admin)
export const addGroupMembers = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { members } = req.body;
    const adminId = req.user._id.toString();

    if (!isValidId(chatId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Chat ID",
      });
    }

    if (!Array.isArray(members) || members.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Select at least 1 member to add",
      });
    }

    if (members.some((id) => !isValidId(id))) {
      return res.status(400).json({
        success: false,
        message: "Invalid member ID found",
      });
    }

    const group = await Chat.findOne({
      _id: chatId,
      isGroupChat: true,
      participants: req.user._id,
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    if (String(group.groupAdmin) !== adminId) {
      return res.status(403).json({
        success: false,
        message: "Only the group admin can add members",
      });
    }

    const existingIds = group.participants.map(String);

    // જે પહેલેથી group માં છે તેમને કાઢી નાખો
    const newIds = [...new Set(members.map(String))].filter(
      (id) => !existingIds.includes(id),
    );

    if (newIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Selected users are already in this group",
      });
    }

    const foundUsers = await User.countDocuments({ _id: { $in: newIds } });

    if (foundUsers !== newIds.length) {
      return res.status(404).json({
        success: false,
        message: "One or more users not found",
      });
    }

    group.participants.push(...newIds);
    await group.save();

    const fullGroup = await populateGroup(Chat.findById(chatId));

    const socketIO = getIO();

    // નવા members ને group મળે
    newIds.forEach((id) => {
      socketIO.to(`user:${id}`).emit("new_group_chat", fullGroup);
    });

    // જૂના members ને update મળે
    existingIds.forEach((id) => {
      socketIO.to(`user:${id}`).emit("group_updated", fullGroup);
    });

    return res.status(200).json({
      success: true,
      message: "Members added successfully",
      chat: fullGroup,
    });
  } catch (error) {
    console.log("Add Group Members Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// Remove Member from Group (ફક્ત Admin)
export const removeGroupMember = async (req, res) => {
  try {
    const { chatId, userId } = req.params;
    const adminId = req.user._id.toString();

    if (!isValidId(chatId) || !isValidId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Chat ID or User ID",
      });
    }

    const group = await Chat.findOne({
      _id: chatId,
      isGroupChat: true,
      participants: req.user._id,
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    if (String(group.groupAdmin) !== adminId) {
      return res.status(403).json({
        success: false,
        message: "Only the group admin can remove members",
      });
    }

    if (userId === adminId) {
      return res.status(400).json({
        success: false,
        message: "Admin cannot be removed. Use Leave Group instead",
      });
    }

    const existingIds = group.participants.map(String);

    if (!existingIds.includes(userId)) {
      return res.status(404).json({
        success: false,
        message: "User is not a member of this group",
      });
    }

    if (existingIds.length - 1 < 2) {
      return res.status(400).json({
        success: false,
        message: "A group must have at least 2 members",
      });
    }

    group.participants = group.participants.filter(
      (participantId) => String(participantId) !== userId,
    );
    await group.save();

    const fullGroup = await populateGroup(Chat.findById(chatId));

    const socketIO = getIO();

    // કાઢેલા user ને chat room માંથી બહાર કાઢો અને જાણ કરો
    socketIO.in(`user:${userId}`).socketsLeave(`chat:${chatId}`);
    socketIO.to(`user:${userId}`).emit("removed_from_group", { chatId });

    // બાકીના members ને update મળે
    existingIds
      .filter((id) => id !== userId)
      .forEach((id) => {
        socketIO.to(`user:${id}`).emit("group_updated", fullGroup);
      });

    return res.status(200).json({
      success: true,
      message: "Member removed successfully",
      chat: fullGroup,
    });
  } catch (error) {
    console.log("Remove Group Member Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// Leave Group
export const leaveGroup = async (req, res) => {
  try {
    const { chatId } = req.params;
    const myId = req.user._id.toString();

    if (!isValidId(chatId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Chat ID",
      });
    }

    const group = await Chat.findOne({
      _id: chatId,
      isGroupChat: true,
      participants: req.user._id,
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    const remainingIds = group.participants
      .map(String)
      .filter((id) => id !== myId);

    const socketIO = getIO();

    // હું છોડું તે પછી કોઈ ન રહે તો group કાઢી નાખો
    if (remainingIds.length === 0) {
      await Chat.findByIdAndDelete(chatId);
    } else {
      // Admin છોડે તો પહેલો બાકી member નવો Admin
      if (String(group.groupAdmin) === myId) {
        group.groupAdmin = remainingIds[0];
      }

      group.participants = remainingIds;
      await group.save();

      const fullGroup = await populateGroup(Chat.findById(chatId));

      remainingIds.forEach((id) => {
        socketIO.to(`user:${id}`).emit("group_updated", fullGroup);
      });
    }

    socketIO.in(`user:${myId}`).socketsLeave(`chat:${chatId}`);
    socketIO.to(`user:${myId}`).emit("removed_from_group", { chatId });

    return res.status(200).json({
      success: true,
      message: "You left the group",
    });
  } catch (error) {
    console.log("Leave Group Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};