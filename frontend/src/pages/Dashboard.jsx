import { useEffect, useState, useRef } from "react";

import {
  MessageCircle,
  ArrowLeft,
  Search,
  Settings,
  LogOut,
  User,
  Plus,
  Send,
  MoreVertical,
  Trash2,
  X,
  Pencil,
  Forward,
  Pin,
  PinOff,
  Star,
  StarOff,
  Camera,
  Play,
  ChevronLeft,
  ChevronRight,
  Eye,
  Users,
} from "lucide-react";

import API from "../utils/api";
import { useSocket } from "../context/SocketContext";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000/api";

const SERVER_URL = API_BASE_URL.replace(/\/api\/?$/, "");

const getProfileImage = (profilePic) => {
  if (!profilePic) return "";

  if (/^https?:\/\//i.test(profilePic)) return profilePic;

  const imagePath = profilePic.startsWith("/") ? profilePic : `/${profilePic}`;

  return `${SERVER_URL}${imagePath}`;
};

function UserAvatar({ profilePic, fullName, size = "w-11 h-11" }) {
  const [imageError, setImageError] = useState(false);

  const imageUrl = getProfileImage(profilePic);

  useEffect(() => {
    setImageError(false);
  }, [profilePic]);

  return (
    <div
      className={`${size} rounded-full bg-purple-600 overflow-hidden flex items-center justify-center font-bold text-white shrink-0`}
    >
      {imageUrl && !imageError ? (
        <img
          src={imageUrl}
          alt={fullName || "User"}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        fullName?.charAt(0)?.toUpperCase() || "U"
      )}
    </div>
  );
}

// Group chat માટે Avatar
function GroupAvatar({ size = "w-11 h-11" }) {
  return (
    <div
      className={`${size} rounded-full bg-gradient-to-br from-purple-500 to-violet-700 flex items-center justify-center text-white shrink-0`}
    >
      <Users size={20} />
    </div>
  );
}

function Dashboard() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const currentUserId = user?._id || user?.id || user?.userId;

  const { socket, isConnected } = useSocket();

  // User search states
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Chat states
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");

  // Message states
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [messageLoading, setMessageLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [messageError, setMessageError] = useState("");
  const [otherUserTyping, setOtherUserTyping] = useState(false);

  // Message search states
  const [messageSearch, setMessageSearch] = useState("");

  // Menu, reply, edit and reaction states
  const [activeMenuMessage, setActiveMenuMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [reactionMenuMessage, setReactionMenuMessage] = useState(null);

  // Forward states
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [forwarding, setForwarding] = useState(false);
  const [forwardSearch, setForwardSearch] = useState("");

  // Pin states
  const [pinningMessage, setPinningMessage] = useState(false);

  // Status states
  const [statuses, setStatuses] = useState([]);

  const [statusFile, setStatusFile] = useState(null);
  const [statusCaption, setStatusCaption] = useState("");

  const [showStatusUpload, setShowStatusUpload] = useState(false);
  const [uploadingStatus, setUploadingStatus] = useState(false);

  const [statusError, setStatusError] = useState("");

  const [viewingStatus, setViewingStatus] = useState(false);
  const [activeStatusIndex, setActiveStatusIndex] = useState(null);

  // Starred messages states
  const [starredMessages, setStarredMessages] = useState([]);
  const [showStarredMessages, setShowStarredMessages] = useState(false);
  const [starringMessage, setStarringMessage] = useState(false);

  // Group states
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState([]);
  const [groupSearch, setGroupSearch] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupError, setGroupError] = useState("");

  // Group info states
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [addMembersSelected, setAddMembersSelected] = useState([]);
  const [groupActionLoading, setGroupActionLoading] = useState(false);
  const [groupInfoError, setGroupInfoError] = useState("");

  const reactionEmojis = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

  const typingTimeoutRef = useRef(null);

  // Filter messages for search
  const filteredMessages = messages.filter((msg) => {
    if (!messageSearch.trim()) return true;
    if (msg.isDeletedForEveryone) return false;

    return (msg.content || "")
      .toLowerCase()
      .includes(messageSearch.trim().toLowerCase());
  });

  // Highlight searched text
  const highlightMessage = (content) => {
    if (!messageSearch.trim() || !content) return content;

    const escapedSearch = messageSearch
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const parts = content.split(new RegExp(`(${escapedSearch})`, "gi"));

    return parts.map((part, index) =>
      part.toLowerCase() === messageSearch.trim().toLowerCase() ? (
        <mark key={index} className="bg-yellow-300 text-black rounded px-1">
          {part}
        </mark>
      ) : (
        part
      ),
    );
  };

  // Pinned messages
  const pinnedMessages = messages.filter(
    (msg) => msg.isPinned && !msg.isDeletedForEveryone,
  );

  // Fetch all active statuses
  const fetchStatuses = async () => {
    try {
      setStatusError("");

      const { data } = await API.get("/status");

      console.log("STATUS API RESPONSE:", data);

      const statusList = Array.isArray(data)
        ? data
        : data.statuses || data.data?.statuses || [];

      setStatuses(statusList);
    } catch (error) {
      console.log("Fetch Status Error:", error.response?.data || error);

      setStatusError(
        error.response?.data?.message || "Statuses load થઈ શક્યા નથી.",
      );
    }
  };

  // Upload Status
  const handleUploadStatus = async (e) => {
    e.preventDefault();

    if (!statusFile || uploadingStatus) return;

    try {
      setUploadingStatus(true);
      setStatusError("");

      const formData = new FormData();

      formData.append("media", statusFile);
      formData.append(
        "mediaType",
        statusFile.type.startsWith("video/") ? "video" : "image",
      );
      formData.append("caption", statusCaption);

      const { data } = await API.post("/status", formData);

      if (data.success) {
        setStatusFile(null);
        setStatusCaption("");
        setShowStatusUpload(false);

        await fetchStatuses();
      }
    } catch (error) {
      console.log("Upload Status Error:", error);

      setStatusError(
        error.response?.data?.message || "Status upload થઈ શક્યો નથી.",
      );
    } finally {
      setUploadingStatus(false);
    }
  };

  // Open Status
  const handleOpenStatus = async (index) => {
    if (index < 0 || index >= statuses.length) return;

    setActiveStatusIndex(index);
    setViewingStatus(true);
    setStatusError("");

    const selectedStatus = statuses[index];

    if (!selectedStatus?._id) return;

    try {
      await API.patch(`/status/${selectedStatus._id}/view`);
    } catch (error) {
      console.log("View Status Error:", error.response?.data || error);
    }
  };

  // Open My Status
  const handleOpenMyStatus = () => {
    const myStatusIndex = statuses.findIndex((status) => {
      const statusUserId = status.user?._id || status.user;

      return String(statusUserId) === String(currentUserId);
    });

    if (myStatusIndex !== -1) {
      handleOpenStatus(myStatusIndex);
    } else {
      setStatusError("");
      setShowStatusUpload(true);
    }
  };

  // Close Status Viewer
  const closeStatusViewer = () => {
    setViewingStatus(false);
    setActiveStatusIndex(null);
  };

  // Next Status
  const nextStatus = () => {
    if (activeStatusIndex < statuses.length - 1) {
      setActiveStatusIndex((previous) => previous + 1);
    } else {
      closeStatusViewer();
    }
  };

  // Previous Status
  const previousStatus = () => {
    if (activeStatusIndex > 0) {
      setActiveStatusIndex((previous) => previous - 1);
    }
  };

  // Delete My Status
  const handleDeleteStatus = async (statusId) => {
    const confirmed = window.confirm(
      "શું તમે તમારો Status Delete કરવા માંગો છો?",
    );

    if (!confirmed) return;

    try {
      await API.delete(`/status/${statusId}`);

      await fetchStatuses();
      closeStatusViewer();
    } catch (error) {
      console.log("Delete Status Error:", error);

      setStatusError(
        error.response?.data?.message || "Status delete થઈ શક્યો નથી.",
      );
    }
  };

  // Fetch all chats
  const fetchChats = async () => {
    try {
      setChatLoading(true);
      setChatError("");

      const { data } = await API.get("/chats");

      const chatList = data.chats || [];
      setChats(chatList);

      if (selectedChat?._id) {
        const updatedChat = chatList.find(
          (chat) => String(chat._id) === String(selectedChat._id),
        );

        if (updatedChat) setSelectedChat(updatedChat);
      }
    } catch (err) {
      console.log("Fetch Chats Error:", err);

      setChatError(
        err.response?.data?.message || "Chats load કરવામાં સમસ્યા આવી.",
      );
    } finally {
      setChatLoading(false);
    }
  };

  // Fetch messages
  const fetchMessages = async (chatId) => {
    try {
      setMessageLoading(true);
      setMessageError("");

      const { data } = await API.get(`/messages/${chatId}`);

      setMessages(data.messages || []);
    } catch (err) {
      console.log("Fetch Messages Error:", err);

      setMessages([]);

      setMessageError(
        err.response?.data?.message || "Messages load થઈ શક્યા નથી.",
      );
    } finally {
      setMessageLoading(false);
    }
  };

  // Fetch my starred messages
  const fetchStarredMessages = async () => {
    try {
      const { data } = await API.get("/messages/starred");
      setStarredMessages(data.messages || []);
    } catch (error) {
      console.log("Fetch Starred Messages Error:", error);
    }
  };

  // Update one message in state
  const updateMessageInState = (updatedMessage) => {
    if (!updatedMessage?._id) return;

    setMessages((previousMessages) =>
      previousMessages.map((msg) =>
        String(msg._id) === String(updatedMessage._id)
          ? { ...msg, ...updatedMessage }
          : msg,
      ),
    );
  };

  // Check whether current user starred a message
  const isMessageStarred = (message) => {
    return (message?.starredBy || []).some((item) => {
      const starredUserId = item?._id || item;
      return String(starredUserId) === String(currentUserId);
    });
  };

  // Star message
  const handleStarMessage = async (messageId) => {
    if (starringMessage) return;

    try {
      setStarringMessage(true);
      setMessageError("");

      const { data } = await API.patch(`/messages/${messageId}/star`);

      if (data.success) {
        setMessages((previousMessages) =>
          previousMessages.map((msg) =>
            String(msg._id) === String(messageId)
              ? {
                  ...msg,
                  starredBy: [
                    ...(msg.starredBy || []).filter((item) => {
                      const id = item?._id || item;
                      return String(id) !== String(currentUserId);
                    }),
                    currentUserId,
                  ],
                }
              : msg,
          ),
        );

        setActiveMenuMessage(null);
        await fetchStarredMessages();
      }
    } catch (error) {
      console.log("Star Message Error:", error.response?.data || error);

      setMessageError(
        error.response?.data?.message || "Message star થઈ શક્યો નથી.",
      );
    } finally {
      setStarringMessage(false);
    }
  };

  // Unstar message
  const handleUnstarMessage = async (messageId) => {
    if (starringMessage) return;

    try {
      setStarringMessage(true);
      setMessageError("");

      const { data } = await API.patch(`/messages/${messageId}/unstar`);

      if (data.success) {
        setMessages((previousMessages) =>
          previousMessages.map((msg) =>
            String(msg._id) === String(messageId)
              ? {
                  ...msg,
                  starredBy: (msg.starredBy || []).filter((item) => {
                    const id = item?._id || item;
                    return String(id) !== String(currentUserId);
                  }),
                }
              : msg,
          ),
        );

        setActiveMenuMessage(null);

        setStarredMessages((previousMessages) =>
          previousMessages.filter(
            (msg) => String(msg._id) !== String(messageId),
          ),
        );
      }
    } catch (error) {
      console.log("Unstar Message Error:", error.response?.data || error);

      setMessageError(
        error.response?.data?.message || "Message unstar થઈ શક્યો નથી.",
      );
    } finally {
      setStarringMessage(false);
    }
  };

  // Open chat containing a starred message
  const handleOpenStarredMessage = (message) => {
    const starredChatId = message.chat?._id || message.chat;

    const targetChat = chats.find(
      (chat) => String(chat._id) === String(starredChatId),
    );

    if (targetChat) {
      setSelectedChat(targetChat);
      setShowStarredMessages(false);
    }
  };

  // Pin message
  const handlePinMessage = async (messageId) => {
    if (pinningMessage) return;

    try {
      setPinningMessage(true);
      setMessageError("");

      const { data } = await API.patch(`/messages/${messageId}/pin`);

      if (data.success) {
        updateMessageInState(data.data);
        setActiveMenuMessage(null);
      }
    } catch (error) {
      console.log("Pin Message Error:", error.response?.data || error);

      setMessageError(
        error.response?.data?.message || "Message pin થઈ શક્યો નથી.",
      );
    } finally {
      setPinningMessage(false);
    }
  };

  // Unpin message
  const handleUnpinMessage = async (messageId) => {
    if (pinningMessage) return;

    try {
      setPinningMessage(true);
      setMessageError("");

      const { data } = await API.patch(`/messages/${messageId}/unpin`);

      if (data.success) {
        updateMessageInState(data.data);
        setActiveMenuMessage(null);
      }
    } catch (error) {
      console.log("Unpin Message Error:", error.response?.data || error);

      setMessageError(
        error.response?.data?.message || "Message unpin થઈ શક્યો નથી.",
      );
    } finally {
      setPinningMessage(false);
    }
  };

  // Mark messages as delivered
  const markChatMessagesAsDelivered = async (chatId) => {
    try {
      const { data } = await API.patch(`/messages/${chatId}/delivered`);

      if (data.success) {
        setMessages((previousMessages) =>
          previousMessages.map((msg) => {
            const senderId = msg.sender?._id || msg.sender;

            if (String(senderId) !== String(currentUserId)) {
              return {
                ...msg,
                isDelivered: true,
                deliveredAt: msg.deliveredAt || new Date(),
              };
            }

            return msg;
          }),
        );
      }
    } catch (error) {
      console.log("Mark Messages Delivered Error:", error);
    }
  };

  // Mark messages as read
  const markChatMessagesAsRead = async (chatId) => {
    try {
      const { data } = await API.patch(`/messages/${chatId}/read`);

      if (data.success) {
        setMessages((previousMessages) =>
          previousMessages.map((msg) => {
            const senderId = msg.sender?._id || msg.sender;

            if (String(senderId) !== String(currentUserId)) {
              return { ...msg, isRead: true };
            }

            return msg;
          }),
        );
      }
    } catch (err) {
      console.log("Mark Messages Read Error:", err);
    }
  };

  // Add or remove reaction
  const handleReaction = async (messageId, emoji) => {
    try {
      const { data } = await API.patch(`/messages/${messageId}/reaction`, {
        emoji,
      });

      const updatedReactions = data.data?.reactions || [];

      setMessages((previousMessages) =>
        previousMessages.map((message) =>
          String(message._id) === String(messageId)
            ? { ...message, reactions: updatedReactions }
            : message,
        ),
      );

      setReactionMenuMessage(null);
    } catch (error) {
      console.log("Message Reaction Error:", error.response?.data || error);

      setMessageError(
        error.response?.data?.message || "Reaction update થઈ શક્યું નથી.",
      );
    }
  };

  // Forward message
  const handleForwardMessage = async (destinationChatId) => {
    if (!forwardingMessage || forwarding) return;

    try {
      setForwarding(true);
      setMessageError("");

      const { data } = await API.post(
        `/messages/${forwardingMessage._id}/forward`,
        {
          chatId: destinationChatId,
        },
      );

      if (data.success) {
        const forwardedMessage = data.data;

        if (String(selectedChat?._id) === String(destinationChatId)) {
          setMessages((previousMessages) => {
            const alreadyExists = previousMessages.some(
              (msg) => String(msg._id) === String(forwardedMessage._id),
            );

            if (alreadyExists) return previousMessages;

            return [...previousMessages, forwardedMessage];
          });
        }

        setForwardingMessage(null);
        setForwardSearch("");
        setActiveMenuMessage(null);

        await fetchChats();
      }
    } catch (error) {
      console.log("Forward Message Error:", error.response?.data || error);

      setMessageError(
        error.response?.data?.message || "Message forward થઈ શક્યો નથી.",
      );
    } finally {
      setForwarding(false);
    }
  };

  // Edit message
  const handleEditMessage = async (e) => {
    e.preventDefault();

    if (!editingMessage || !newMessage.trim() || sending) return;

    try {
      setSending(true);
      setMessageError("");

      const { data } = await API.patch(`/messages/${editingMessage._id}/edit`, {
        content: newMessage.trim(),
      });

      if (data.success) {
        const updatedMessage = data.data;

        setMessages((previousMessages) =>
          previousMessages.map((msg) =>
            String(msg._id) === String(editingMessage._id)
              ? {
                  ...msg,
                  content: updatedMessage.content,
                  isEdited: true,
                  editedAt: updatedMessage.editedAt,
                }
              : msg,
          ),
        );

        setNewMessage("");
        setEditingMessage(null);
      }
    } catch (error) {
      console.log("Edit Message Error:", error.response?.data || error);

      setMessageError(
        error.response?.data?.message || "Message edit થઈ શક્યો નથી.",
      );
    } finally {
      setSending(false);
    }
  };

  // Load chats when Dashboard opens
  useEffect(() => {
    fetchChats();
    fetchStarredMessages();
    fetchStatuses();
  }, []);

  // Load messages when selected chat changes
  useEffect(() => {
    if (selectedChat?._id) {
      setActiveMenuMessage(null);
      setEditingMessage(null);
      setReplyingTo(null);
      setReactionMenuMessage(null);
      setNewMessage("");
      setMessageSearch("");

      const loadMessages = async () => {
        await fetchMessages(selectedChat._id);
        await markChatMessagesAsDelivered(selectedChat._id);
        await markChatMessagesAsRead(selectedChat._id);
      };

      loadMessages();
    } else {
      setMessages([]);
      setMessageSearch("");
    }
  }, [selectedChat?._id]);

  // Online / Offline status
  useEffect(() => {
    if (!socket) return;

    const handleUserStatus = (data) => {
      setUsers((previousUsers) =>
        previousUsers.map((item) =>
          String(item._id) === String(data.userId)
            ? {
                ...item,
                isOnline: data.isOnline,
                lastSeen: data.lastSeen,
              }
            : item,
        ),
      );

      const updateParticipants = (participants = []) =>
        participants.map((participant) => {
          const participantId = participant?._id || participant;

          if (String(participantId) === String(data.userId)) {
            if (typeof participant === "object" && participant !== null) {
              return {
                ...participant,
                isOnline: data.isOnline,
                lastSeen: data.lastSeen,
              };
            }
          }

          return participant;
        });

      setChats((previousChats) =>
        previousChats.map((chat) => ({
          ...chat,
          participants: updateParticipants(chat.participants),
        })),
      );

      setSelectedChat((previousChat) => {
        if (!previousChat) return previousChat;

        return {
          ...previousChat,
          participants: updateParticipants(previousChat.participants),
        };
      });
    };

    socket.on("user_status", handleUserStatus);

    return () => {
      socket.off("user_status", handleUserStatus);
    };
  }, [socket]);

  // Real-time chat events
  useEffect(() => {
    if (!socket || !selectedChat?._id) {
      setOtherUserTyping(false);
      return;
    }

    const chatId = selectedChat._id;

    // Join chat room
    const joinChat = () => {
      socket.emit("join_chat", chatId, (response) => {
        if (!response?.success) {
          console.log("Unable to join chat:", response?.message);
        }
      });
    };

    joinChat();

    // New message
    const handleNewMessage = (message) => {
      const messageChatId = message.chat?._id || message.chat;

      if (String(messageChatId) !== String(chatId)) return;

      setMessages((previousMessages) => {
        const alreadyExists = previousMessages.some(
          (item) => String(item._id) === String(message._id),
        );

        if (alreadyExists) return previousMessages;

        return [...previousMessages, message];
      });

      const senderId = message.sender?._id || message.sender;

      if (String(senderId) !== String(currentUserId)) {
        if (document.visibilityState === "visible") {
          markChatMessagesAsDelivered(chatId);
          markChatMessagesAsRead(chatId);
        } else {
          fetchChats();
        }
      }
    };

    // Messages read
    const handleMessagesRead = (data) => {
      if (String(data.chatId) !== String(chatId)) return;
      if (String(data.readerId) === String(currentUserId)) return;

      const readIds = (data.messageIds || []).map(String);

      if (readIds.length === 0) return;

      setMessages((previousMessages) =>
        previousMessages.map((msg) =>
          readIds.includes(String(msg._id)) ? { ...msg, isRead: true } : msg,
        ),
      );
    };

    // Messages delivered
    const handleMessagesDelivered = (data) => {
      if (String(data.chatId) !== String(chatId)) return;
      if (String(data.receiverId) === String(currentUserId)) return;

      setMessages((previousMessages) =>
        previousMessages.map((msg) => {
          const senderId = msg.sender?._id || msg.sender;

          if (String(senderId) === String(currentUserId)) {
            return {
              ...msg,
              isDelivered: true,
              deliveredAt: msg.deliveredAt || new Date(),
            };
          }

          return msg;
        }),
      );
    };

    // Message deleted for everyone
    const handleMessageDeleted = (data) => {
      if (String(data.chatId) !== String(chatId)) return;

      setMessages((previousMessages) =>
        previousMessages.map((msg) =>
          String(msg._id) === String(data.messageId)
            ? {
                ...msg,
                content: "This message was deleted",
                isDeletedForEveryone: true,
                isPinned: false,
                pinnedAt: null,
                pinnedBy: null,
              }
            : msg,
        ),
      );

      setActiveMenuMessage(null);
    };

    // Message edited
    const handleMessageEdited = (data) => {
      if (String(data.chatId) !== String(chatId)) return;

      setMessages((previousMessages) =>
        previousMessages.map((msg) =>
          String(msg._id) === String(data.messageId)
            ? {
                ...msg,
                content: data.content,
                isEdited: data.isEdited,
                editedAt: data.editedAt,
              }
            : msg,
        ),
      );
    };

    // Reaction updated
    const handleReactionUpdated = (data) => {
      if (String(data.chatId) !== String(chatId)) return;

      setMessages((previousMessages) =>
        previousMessages.map((message) =>
          String(message._id) === String(data.messageId)
            ? { ...message, reactions: data.reactions || [] }
            : message,
        ),
      );
    };

    // Message pinned
    const handleMessagePinned = (data) => {
      if (String(data.chatId) !== String(chatId)) return;

      if (data.message) {
        updateMessageInState(data.message);
      }
    };

    // Message unpinned
    const handleMessageUnpinned = (data) => {
      if (String(data.chatId) !== String(chatId)) return;

      if (data.message) {
        updateMessageInState(data.message);
      }
    };

    // Typing
    const handleUserTyping = (data) => {
      if (
        String(data.chatId) === String(chatId) &&
        String(data.userId) !== String(currentUserId)
      ) {
        setOtherUserTyping(true);
      }
    };

    // Stop typing
    const handleUserStopTyping = (data) => {
      if (
        String(data.chatId) === String(chatId) &&
        String(data.userId) !== String(currentUserId)
      ) {
        setOtherUserTyping(false);
      }
    };

    socket.on("new_message", handleNewMessage);
    socket.on("messages_read", handleMessagesRead);
    socket.on("messages_delivered", handleMessagesDelivered);
    socket.on("message_deleted_for_everyone", handleMessageDeleted);
    socket.on("message_edited", handleMessageEdited);
    socket.on("message_reaction_updated", handleReactionUpdated);
    socket.on("message_pinned", handleMessagePinned);
    socket.on("message_unpinned", handleMessageUnpinned);
    socket.on("user_typing", handleUserTyping);
    socket.on("user_stop_typing", handleUserStopTyping);

    return () => {
      clearTimeout(typingTimeoutRef.current);

      socket.emit("stop_typing", chatId);

      socket.off("new_message", handleNewMessage);
      socket.off("messages_read", handleMessagesRead);
      socket.off("messages_delivered", handleMessagesDelivered);
      socket.off("message_deleted_for_everyone", handleMessageDeleted);
      socket.off("message_edited", handleMessageEdited);
      socket.off("message_reaction_updated", handleReactionUpdated);
      socket.off("message_pinned", handleMessagePinned);
      socket.off("message_unpinned", handleMessageUnpinned);
      socket.off("user_typing", handleUserTyping);
      socket.off("user_stop_typing", handleUserStopTyping);

      setOtherUserTyping(false);
    };
  }, [socket, selectedChat?._id]);

  // Socket reconnect
  useEffect(() => {
    if (!socket || !selectedChat?._id) return;

    const chatId = selectedChat._id;

    const refreshMessages = () => {
      console.log("Socket Reconnected - Refreshing Messages");

      socket.emit("join_chat", chatId, async (response) => {
        if (!response?.success) {
          console.log("Unable to rejoin chat:", response?.message);
          return;
        }

        await fetchMessages(chatId);
        await markChatMessagesAsDelivered(chatId);
        await markChatMessagesAsRead(chatId);
      });
    };

    socket.on("connect", refreshMessages);

    return () => {
      socket.off("connect", refreshMessages);
    };
  }, [socket, selectedChat?._id]);

  // Unread count
  useEffect(() => {
    if (!socket) return;

    const handleUnreadCountUpdated = ({ chatId, unreadCount }) => {
      setChats((previousChats) =>
        previousChats.map((chat) =>
          String(chat._id) === String(chatId) ? { ...chat, unreadCount } : chat,
        ),
      );
    };

    socket.on("unread_count_updated", handleUnreadCountUpdated);

    return () => {
      socket.off("unread_count_updated", handleUnreadCountUpdated);
    };
  }, [socket]);

  // New group (બીજાએ મને group માં ઉમેર્યો)
  useEffect(() => {
    if (!socket) return;

    const handleNewGroupChat = (group) => {
      setChats((previousChats) => {
        const exists = previousChats.some(
          (chat) => String(chat._id) === String(group._id),
        );

        if (exists) return previousChats;

        return [{ ...group, unreadCount: 0 }, ...previousChats];
      });
    };

    socket.on("new_group_chat", handleNewGroupChat);

    return () => {
      socket.off("new_group_chat", handleNewGroupChat);
    };
  }, [socket]);

  // Group update / મને group માંથી કાઢ્યો
  useEffect(() => {
    if (!socket) return;

    const handleGroupUpdated = (group) => {
      if (!group?._id) return;

      setChats((previousChats) =>
        previousChats.map((chat) =>
          String(chat._id) === String(group._id)
            ? { ...chat, ...group, unreadCount: chat.unreadCount }
            : chat,
        ),
      );

      setSelectedChat((previousChat) =>
        previousChat && String(previousChat._id) === String(group._id)
          ? { ...previousChat, ...group }
          : previousChat,
      );
    };

    const handleRemovedFromGroup = ({ chatId }) => {
      setChats((previousChats) =>
        previousChats.filter((chat) => String(chat._id) !== String(chatId)),
      );

      setSelectedChat((previousChat) => {
        if (previousChat && String(previousChat._id) === String(chatId)) {
          setShowGroupInfo(false);
          setShowAddMembers(false);
          return null;
        }

        return previousChat;
      });
    };

    socket.on("group_updated", handleGroupUpdated);
    socket.on("removed_from_group", handleRemovedFromGroup);

    return () => {
      socket.off("group_updated", handleGroupUpdated);
      socket.off("removed_from_group", handleRemovedFromGroup);
    };
  }, [socket]);

  // Search users
  const handleSearch = async (e) => {
    const keyword = e.target.value;

    setSearch(keyword);
    setError("");

    if (!keyword.trim()) {
      setUsers([]);
      return;
    }

    try {
      setLoading(true);

      const { data } = await API.get(
        `/users/search?keyword=${encodeURIComponent(keyword)}`,
      );

      setUsers(data.users || []);
    } catch (err) {
      console.log("Search Error:", err);

      setError(err.response?.data?.message || "Unable to search users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  // Start or open chat
  const handleStartChat = async (selectedUser) => {
    try {
      setChatError("");

      const { data } = await API.post("/chats", {
        userId: selectedUser._id,
      });

      if (data.chat) setSelectedChat(data.chat);

      await fetchChats();

      setSearch("");
      setUsers([]);
    } catch (err) {
      console.log("Create Chat Error:", err);

      setChatError(err.response?.data?.message || "Chat શરૂ થઈ શક્યો નથી.");
    }
  };

  // Format last seen
  const formatLastSeen = (date) => {
    if (!date) return "Offline";

    return new Date(date).toLocaleString([], {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get other participant
  const getOtherUser = (chat) => {
    return chat.participants?.find((participant) => {
      const participantId = participant?._id || participant;

      return String(participantId) !== String(currentUserId);
    });
  };

  // Chat નું નામ (group હોય તો group નું નામ)
  const getChatTitle = (chat) => {
    if (!chat) return "Chat";

    if (chat.isGroupChat) return chat.groupName || "Group";

    return getOtherUser(chat)?.fullName || "Unknown User";
  };

  // Typing handler
  const handleMessageChange = (e) => {
    const value = e.target.value;

    setNewMessage(value);

    if (editingMessage) return;

    if (!socket || !selectedChat?._id || !isConnected) return;

    if (!value.trim()) {
      clearTimeout(typingTimeoutRef.current);
      socket.emit("stop_typing", selectedChat._id);
      return;
    }

    socket.emit("typing", selectedChat._id);

    clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop_typing", selectedChat._id);
    }, 1000);
  };

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!newMessage.trim() || !selectedChat?._id || sending) return;

    try {
      setSending(true);
      setMessageError("");

      const { data } = await API.post("/messages", {
        chatId: selectedChat._id,
        content: newMessage.trim(),
        replyTo: replyingTo?._id || null,
      });

      clearTimeout(typingTimeoutRef.current);

      if (socket && selectedChat?._id) {
        socket.emit("stop_typing", selectedChat._id);
      }

      setNewMessage("");
      setReplyingTo(null);

      const sentMessage = data.data || data.newMessage || data.messageData;

      if (sentMessage) {
        setMessages((previousMessages) => {
          const alreadyExists = previousMessages.some(
            (item) => String(item._id) === String(sentMessage._id),
          );

          if (alreadyExists) return previousMessages;

          return [...previousMessages, sentMessage];
        });
      }

      await fetchChats();
    } catch (err) {
      console.log("Send Message Error:", err.response?.data || err);

      setMessageError(
        err.response?.data?.message || "Message મોકલી શકાયો નથી.",
      );
    } finally {
      setSending(false);
    }
  };

  // Delete for me
  const handleDeleteForMe = async (messageId) => {
    try {
      setMessageError("");

      const { data } = await API.delete(`/messages/${messageId}/me`);

      if (data.success) {
        setMessages((previousMessages) =>
          previousMessages.filter(
            (msg) => String(msg._id) !== String(messageId),
          ),
        );

        setActiveMenuMessage(null);
      }
    } catch (err) {
      console.log("Delete For Me Error:", err);

      setMessageError(
        err.response?.data?.message || "Message delete થઈ શક્યો નથી.",
      );
    }
  };

  // Delete for everyone
  const handleDeleteForEveryone = async (messageId) => {
    const confirmed = window.confirm(
      "શું તમે આ Message બધા માટે Delete કરવા માંગો છો?",
    );

    if (!confirmed) return;

    try {
      setMessageError("");

      const { data } = await API.delete(`/messages/${messageId}/everyone`);

      if (data.success) {
        setMessages((previousMessages) =>
          previousMessages.map((msg) =>
            String(msg._id) === String(messageId)
              ? {
                  ...msg,
                  content: "This message was deleted",
                  isDeletedForEveryone: true,
                  isPinned: false,
                  pinnedAt: null,
                  pinnedBy: null,
                }
              : msg,
          ),
        );

        setActiveMenuMessage(null);
      }
    } catch (err) {
      console.log("Delete For Everyone Error:", err);

      setMessageError(
        err.response?.data?.message || "Message delete થઈ શક્યો નથી.",
      );
    }
  };

  // Close group popup
  const closeGroupModal = () => {
    if (creatingGroup) return;

    setShowGroupModal(false);
    setGroupName("");
    setGroupMembers([]);
    setGroupSearch("");
    setGroupError("");
  };

  // Select / unselect member
  const toggleGroupMember = (userId) => {
    setGroupMembers((previous) =>
      previous.includes(userId)
        ? previous.filter((id) => id !== userId)
        : [...previous, userId],
    );
  };

  // Create group
  const handleCreateGroup = async (e) => {
    e.preventDefault();

    if (creatingGroup) return;

    if (!groupName.trim()) {
      setGroupError("Group નું નામ લખો.");
      return;
    }

    if (groupMembers.length < 2) {
      setGroupError("ઓછામાં ઓછા 2 members પસંદ કરો.");
      return;
    }

    try {
      setCreatingGroup(true);
      setGroupError("");

      const { data } = await API.post("/chats/group", {
        groupName: groupName.trim(),
        members: groupMembers,
      });

      if (data.success) {
        const newGroup = data.chat;

        setChats((previous) => [
          { ...newGroup, unreadCount: 0 },
          ...previous.filter((c) => String(c._id) !== String(newGroup._id)),
        ]);

        setSelectedChat(newGroup);

        setShowGroupModal(false);
        setGroupName("");
        setGroupMembers([]);
        setGroupSearch("");
      }
    } catch (error) {
      console.log("Create Group Error:", error.response?.data || error);

      setGroupError(error.response?.data?.message || "Group બની શક્યો નથી.");
    } finally {
      setCreatingGroup(false);
    }
  };

  // Group info popup બંધ કરો
  const closeGroupInfo = () => {
    if (groupActionLoading) return;

    setShowGroupInfo(false);
    setShowAddMembers(false);
    setAddMembersSelected([]);
    setGroupInfoError("");
  };

  // Chat ને state માં update કરો (unreadCount સાચવીને)
  const applyUpdatedGroup = (updatedGroup) => {
    if (!updatedGroup?._id) return;

    setChats((previousChats) =>
      previousChats.map((chat) =>
        String(chat._id) === String(updatedGroup._id)
          ? { ...chat, ...updatedGroup, unreadCount: chat.unreadCount }
          : chat,
      ),
    );

    setSelectedChat((previousChat) =>
      previousChat && String(previousChat._id) === String(updatedGroup._id)
        ? { ...previousChat, ...updatedGroup }
        : previousChat,
    );
  };

  // Members ઉમેરો
  const handleAddMembers = async () => {
    if (!selectedChat?._id || groupActionLoading) return;

    if (addMembersSelected.length === 0) {
      setGroupInfoError("ઓછામાં ઓછો 1 member પસંદ કરો.");
      return;
    }

    try {
      setGroupActionLoading(true);
      setGroupInfoError("");

      const { data } = await API.post(
        `/chats/group/${selectedChat._id}/members`,
        { members: addMembersSelected },
      );

      if (data.success) {
        applyUpdatedGroup(data.chat);
        setAddMembersSelected([]);
        setShowAddMembers(false);
      }
    } catch (error) {
      console.log("Add Members Error:", error.response?.data || error);

      setGroupInfoError(
        error.response?.data?.message || "Members ઉમેરી શકાયા નથી.",
      );
    } finally {
      setGroupActionLoading(false);
    }
  };

  // Member કાઢો
  const handleRemoveMember = async (member) => {
    if (!selectedChat?._id || groupActionLoading) return;

    const confirmed = window.confirm(
      `શું તમે ${member.fullName || "આ member"} ને group માંથી કાઢવા માંગો છો?`,
    );

    if (!confirmed) return;

    try {
      setGroupActionLoading(true);
      setGroupInfoError("");

      const { data } = await API.delete(
        `/chats/group/${selectedChat._id}/members/${member._id}`,
      );

      if (data.success) {
        applyUpdatedGroup(data.chat);
      }
    } catch (error) {
      console.log("Remove Member Error:", error.response?.data || error);

      setGroupInfoError(
        error.response?.data?.message || "Member કાઢી શકાયો નથી.",
      );
    } finally {
      setGroupActionLoading(false);
    }
  };

  // Group છોડો
  const handleLeaveGroup = async () => {
    if (!selectedChat?._id || groupActionLoading) return;

    const confirmed = window.confirm("શું તમે આ group છોડવા માંગો છો?");

    if (!confirmed) return;

    const leavingChatId = selectedChat._id;

    try {
      setGroupActionLoading(true);
      setGroupInfoError("");

      const { data } = await API.patch(`/chats/group/${leavingChatId}/leave`);

      if (data.success) {
        setChats((previousChats) =>
          previousChats.filter(
            (chat) => String(chat._id) !== String(leavingChatId),
          ),
        );

        setSelectedChat(null);
        setShowGroupInfo(false);
        setShowAddMembers(false);
        setAddMembersSelected([]);
      }
    } catch (error) {
      console.log("Leave Group Error:", error.response?.data || error);

      setGroupInfoError(
        error.response?.data?.message || "Group છોડી શકાયો નથી.",
      );
    } finally {
      setGroupActionLoading(false);
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.dispatchEvent(new Event("auth-change"));
    window.location.href = "/login";
  };

  const otherUser = selectedChat ? getOtherUser(selectedChat) : null;

  // Group માટે members (જેમની સાથે 1-to-1 chat છે)
  const groupCandidates = chats
    .filter((chat) => !chat.isGroupChat)
    .map((chat) => getOtherUser(chat))
    .filter(Boolean)
    .filter((candidate) =>
      (candidate.fullName || "")
        .toLowerCase()
        .includes(groupSearch.toLowerCase()),
    );

  // Filter chats for forwarding
  const filteredForwardChats = chats.filter((chat) =>
    getChatTitle(chat).toLowerCase().includes(forwardSearch.toLowerCase()),
  );

  return (
    <div className="h-[100dvh] min-h-0 overflow-hidden bg-[#080711] text-white flex">
      {/* Sidebar */}
      <aside className="flex w-16 sm:w-[72px] md:w-64 shrink-0 bg-[#12101d] border-r border-purple-500/20 flex-col items-center md:items-stretch p-2 md:p-4">
        <div className="flex items-center justify-center md:justify-start gap-3 mb-8 md:mb-10">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-violet-700 flex items-center justify-center text-xl font-bold">
            C
          </div>

          <h1 className="hidden md:block text-xl font-bold">
            Chat<span className="text-purple-400">Wave</span>
          </h1>
        </div>

        <button className="w-full flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl bg-purple-600">
          <MessageCircle size={21} />
          <span className="hidden md:block">Messages</span>
        </button>

        <button
          onClick={() => (window.location.href = "/profile")}
          className="w-full flex items-center justify-center md:justify-start gap-3 p-3 mt-3 rounded-xl hover:bg-white/5 text-gray-400"
        >
          <User size={21} />
          <span className="hidden md:block">My Profile</span>
        </button>

        <button className="w-full flex items-center justify-center md:justify-start gap-3 p-3 mt-3 rounded-xl hover:bg-white/5 text-gray-400">
          <Settings size={21} />
          <span className="hidden md:block">Settings</span>
        </button>

        <div className="mt-auto">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl text-red-400 hover:bg-red-500/10"
          >
            <LogOut size={21} />
            <span className="hidden md:block">Logout</span>
          </button>
        </div>
      </aside>

      {/* Chat list */}
      <section
        className={`${
          selectedChat ? "hidden" : "flex"
        } md:flex w-[calc(100%-4rem)] md:w-[31%] md:min-w-[320px] md:max-w-[560px] md:shrink-0 min-w-0 min-h-0 flex-col border-r border-purple-500/20 bg-[#0e0c18] p-3 sm:p-4 lg:p-5 overflow-y-auto`}
      >
        <h2 className="text-2xl font-bold mb-2">Messages</h2>

        {/* WhatsApp Status Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Status</h3>

            <button
              type="button"
              onClick={() => {
                setStatusError("");
                setShowStatusUpload(true);
              }}
              className="text-purple-400 text-sm hover:text-purple-300"
            >
              + Add Status
            </button>
          </div>

          {/* My Status */}
          <button
            type="button"
            onClick={handleOpenMyStatus}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#1b1928] border border-gray-800 hover:border-purple-500/50 mb-3 text-left"
          >
            <div className="relative">
              <div className="rounded-full p-[3px] border-2 border-purple-500">
                <UserAvatar
                  profilePic={user.profilePic}
                  fullName={user.fullName}
                />
              </div>

              <span className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-purple-600 border-2 border-[#1b1928] flex items-center justify-center">
                <Plus size={14} />
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-semibold">My Status</p>
              <p className="text-xs text-gray-400">
                Add a photo or video update
              </p>
            </div>

            <Camera size={20} className="text-purple-400" />
          </button>

          {/* Recent Status */}
          {statuses
            .filter((status) => {
              const statusUserId = status.user?._id || status.user;

              return String(statusUserId) !== String(currentUserId);
            })
            .map((status) => (
              <button
                key={status._id}
                type="button"
                onClick={() =>
                  handleOpenStatus(
                    statuses.findIndex((item) => item._id === status._id),
                  )
                }
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-left"
              >
                <div className="rounded-full p-[3px] border-2 border-purple-500">
                  <UserAvatar
                    profilePic={status.user?.profilePic}
                    fullName={
                      status.user?.fullName || status.user?.name || "User"
                    }
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">
                    {status.user?.fullName || status.user?.name || "User"}
                  </p>

                  <p className="text-xs text-gray-400">
                    {new Date(status.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                {status.mediaType === "video" && (
                  <Play size={16} className="text-purple-400" />
                )}
              </button>
            ))}

          {statusError && (
            <p className="text-red-400 text-xs mt-2">{statusError}</p>
          )}
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-3.5 text-gray-400" size={19} />

          <input
            type="text"
            placeholder="Search users by name or email..."
            value={search}
            onChange={handleSearch}
            className="w-full bg-[#1b1928] border border-gray-700 rounded-xl py-3 pl-12 pr-4 outline-none focus:border-purple-500"
          />
        </div>

        {loading && (
          <p className="text-purple-400 text-sm mb-4">Searching users...</p>
        )}

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {!loading && users.length > 0 && (
          <div className="space-y-3 mb-6">
            <h3 className="text-sm text-gray-400">
              Search Results ({users.length})
            </h3>

            {users.map((item) => (
              <button
                key={item._id}
                onClick={() => handleStartChat(item)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#1b1928] border border-gray-800 hover:border-purple-500/50 transition text-left"
              >
                <UserAvatar
                  profilePic={item.profilePic}
                  fullName={item.fullName}
                />

                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold truncate">{item.fullName}</h3>
                  <p className="text-sm text-gray-400 truncate">{item.email}</p>
                </div>

                <Plus size={20} className="text-purple-400" />
              </button>
            ))}
          </div>
        )}

        {!loading && search.trim() && users.length === 0 && !error && (
          <p className="text-gray-500 text-sm mb-4">No users found.</p>
        )}

        <div className="mb-5">
          <button
            type="button"
            onClick={() => setShowStarredMessages((value) => !value)}
            className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border transition ${
              showStarredMessages
                ? "bg-yellow-500/15 border-yellow-500/40 text-yellow-200"
                : "bg-[#1b1928] border-gray-800 hover:border-yellow-500/40 text-gray-300"
            }`}
          >
            <span className="flex items-center gap-2">
              <Star size={18} className="text-yellow-400" />
              <span className="font-semibold text-sm">Starred Messages</span>
            </span>

            <span className="text-xs rounded-full bg-yellow-500/20 px-2 py-1 text-yellow-200">
              {starredMessages.length}
            </span>
          </button>

          {showStarredMessages && (
            <div className="mt-2 max-h-64 overflow-y-auto space-y-2">
              {starredMessages.length === 0 ? (
                <p className="text-xs text-gray-500 p-3">
                  You have no starred messages yet.
                </p>
              ) : (
                starredMessages.map((starredMsg) => {
                  const starredChatId = starredMsg.chat?._id || starredMsg.chat;

                  const starredChat = chats.find(
                    (chat) => String(chat._id) === String(starredChatId),
                  );

                  return (
                    <button
                      key={starredMsg._id}
                      type="button"
                      onClick={() => handleOpenStarredMessage(starredMsg)}
                      className="w-full text-left rounded-xl border border-yellow-500/20 bg-[#1b1928] hover:bg-yellow-500/10 p-3 transition"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Star size={13} className="text-yellow-400 shrink-0" />

                        <span className="text-xs text-yellow-200 font-semibold truncate">
                          {starredChat
                            ? getChatTitle(starredChat)
                            : starredMsg.sender?.fullName || "Starred message"}
                        </span>
                      </div>

                      <p className="text-xs text-gray-300 line-clamp-2 break-words">
                        {starredMsg.content}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div className="border-t border-gray-800 pt-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Your Conversations</h3>

            <button
              type="button"
              onClick={() => {
                setGroupError("");
                setShowGroupModal(true);
              }}
              className="flex items-center gap-1 text-purple-400 text-sm hover:text-purple-300"
            >
              <Users size={16} />
              New Group
            </button>
          </div>

          {chatLoading && (
            <p className="text-purple-400 text-sm">Loading chats...</p>
          )}

          {chatError && (
            <p className="text-red-400 text-sm mb-3">{chatError}</p>
          )}

          {!chatLoading && chats.length === 0 && (
            <p className="text-gray-500 text-sm">
              No conversations yet. Search for a friend to start chatting.
            </p>
          )}

          <div className="space-y-2">
            {chats.map((chat) => {
              const chatOtherUser = getOtherUser(chat);

              return (
                <button
                  key={chat._id}
                  onClick={() => setSelectedChat(chat)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition ${
                    selectedChat?._id === chat._id
                      ? "bg-purple-600/20 border border-purple-500/40"
                      : "hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <div className="relative">
                    {chat.isGroupChat ? (
                      <GroupAvatar />
                    ) : (
                      <>
                        <UserAvatar
                          profilePic={chatOtherUser?.profilePic}
                          fullName={chatOtherUser?.fullName}
                        />

                        <span
                          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0e0c18] ${
                            chatOtherUser?.isOnline
                              ? "bg-green-400"
                              : "bg-gray-500"
                          }`}
                        />
                      </>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold truncate">
                      {getChatTitle(chat)}
                    </h4>

                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <p className="text-xs text-gray-400 truncate">
                        {chat.latestMessage?.content || "Start a conversation"}
                      </p>

                      {chat.unreadCount > 0 && (
                        <span className="shrink-0 min-w-5 h-5 px-1 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center">
                          {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main chat area */}
      <main
        className={`${
          selectedChat ? "flex" : "hidden"
        } md:flex flex-1 min-w-0 min-h-0 flex-col bg-[#080711]`}
      >
        {selectedChat ? (
          <>
            {/* Chat header */}
            <div className="shrink-0 p-3 sm:p-5 border-b border-purple-500/20 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedChat(null);
                  setReplyingTo(null);
                  setEditingMessage(null);
                  setNewMessage("");
                  setActiveMenuMessage(null);
                  setReactionMenuMessage(null);
                  setMessageSearch("");
                }}
                className="md:hidden shrink-0 rounded-lg p-2 -ml-1 text-gray-300 hover:bg-white/10"
                aria-label="Back to conversations"
                title="Back to conversations"
              >
                <ArrowLeft size={22} />
              </button>

              <div className="relative">
                {selectedChat.isGroupChat ? (
                  <GroupAvatar size="w-12 h-12" />
                ) : (
                  <>
                    <UserAvatar
                      profilePic={otherUser?.profilePic}
                      fullName={otherUser?.fullName}
                      size="w-12 h-12"
                    />

                    <span
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#080711] ${
                        otherUser?.isOnline ? "bg-green-400" : "bg-gray-500"
                      }`}
                    />
                  </>
                )}
              </div>

              <div className="min-w-0">
                <h2 className="font-bold text-lg truncate">
                  {getChatTitle(selectedChat)}
                </h2>

                {selectedChat.isGroupChat ? (
                  <p className="text-xs text-gray-400 truncate">
                    {selectedChat.participants?.length || 0} members
                  </p>
                ) : (
                  <p
                    className={`text-xs ${
                      otherUser?.isOnline ? "text-green-400" : "text-gray-400"
                    }`}
                  >
                    {otherUser?.isOnline
                      ? "● Online"
                      : `● Last seen: ${formatLastSeen(otherUser?.lastSeen)}`}
                  </p>
                )}

                <p
                  className={`text-[10px] ${
                    isConnected ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {isConnected ? "Socket Connected" : "Socket Disconnected"}
                </p>
              </div>

              {selectedChat.isGroupChat && (
                <button
                  type="button"
                  onClick={() => {
                    setGroupInfoError("");
                    setShowGroupInfo(true);
                  }}
                  className="ml-auto shrink-0 flex items-center gap-2 rounded-xl border border-purple-500/40 px-3 py-2 text-sm text-purple-300 hover:bg-purple-600/20"
                  title="Group Info"
                >
                  <Users size={17} />
                  <span className="hidden sm:inline">Group Info</span>
                </button>
              )}
            </div>

            {/* Message Search Bar */}
            <div className="shrink-0 px-3 sm:px-6 py-3 border-b border-purple-500/20 bg-[#100e1a]">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-3.5 text-gray-400"
                />

                <input
                  type="text"
                  placeholder="Search messages in this chat..."
                  value={messageSearch}
                  onChange={(e) => setMessageSearch(e.target.value)}
                  className="w-full bg-[#1b1928] border border-gray-700 rounded-xl py-3 pl-10 pr-12 outline-none focus:border-purple-500"
                />

                {messageSearch && (
                  <button
                    type="button"
                    onClick={() => setMessageSearch("")}
                    className="absolute right-3 top-3 text-gray-400 hover:text-white"
                    title="Clear search"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              {messageSearch.trim() && (
                <p className="text-xs text-purple-300 mt-2">
                  {filteredMessages.length} messages found
                </p>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 space-y-3 sm:space-y-4">
              {/* Pinned Messages Section */}
              {!messageSearch.trim() && pinnedMessages.length > 0 && (
                <div className="rounded-xl border border-purple-500/40 bg-[#191528] p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-3 text-purple-300">
                    <Pin size={17} />

                    <h3 className="font-semibold text-sm">
                      Pinned Messages ({pinnedMessages.length})
                    </h3>
                  </div>

                  <div className="space-y-2">
                    {pinnedMessages.map((pinnedMsg) => (
                      <div
                        key={pinnedMsg._id}
                        className="flex items-start gap-2 rounded-lg bg-white/5 p-2"
                      >
                        <Pin
                          size={14}
                          className="text-purple-400 mt-1 shrink-0"
                        />

                        <div className="min-w-0">
                          <p className="text-xs text-purple-300 font-semibold">
                            {pinnedMsg.sender?.fullName || "User"}
                          </p>

                          <p className="text-sm text-gray-200 break-words">
                            {pinnedMsg.content}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {messageLoading && (
                <p className="text-center text-purple-400">
                  Loading messages...
                </p>
              )}

              {messageError && (
                <p className="text-center text-red-400">{messageError}</p>
              )}

              {!messageLoading && messages.length === 0 && !messageError && (
                <p className="text-center text-gray-500 mt-10">
                  No messages yet. Say Hello!
                </p>
              )}

              {!messageLoading &&
                messages.length > 0 &&
                messageSearch.trim() &&
                filteredMessages.length === 0 && (
                  <p className="text-center text-gray-500 mt-10">
                    No matching messages found.
                  </p>
                )}

              {filteredMessages.map((msg) => {
                const senderId = msg.sender?._id || msg.sender;

                const isMine =
                  Boolean(currentUserId && senderId) &&
                  String(senderId) === String(currentUserId);

                const isMenuOpen = activeMenuMessage === msg._id;

                return (
                  <div
                    key={msg._id}
                    className={`flex ${
                      isMine ? "justify-end" : "justify-start"
                    } ${isMenuOpen ? "relative z-50" : "relative z-0"}`}
                  >
                    <div
                      className={`relative max-w-[88%] sm:max-w-[70%] px-4 py-3 rounded-2xl ${
                        isMenuOpen ? "z-50" : "z-0"
                      } ${
                        isMine
                          ? "bg-purple-600 rounded-br-sm"
                          : "bg-[#1b1928] rounded-bl-sm"
                      }`}
                    >
                      <div className="flex flex-col gap-2">
                        {/* Group માં મોકલનારનું નામ */}
                        {selectedChat.isGroupChat && !isMine && (
                          <p className="text-xs font-semibold text-purple-300">
                            {msg.sender?.fullName || "User"}
                          </p>
                        )}

                        {/* Pinned label */}
                        {msg.isPinned && (
                          <div className="flex items-center gap-1 text-xs text-yellow-200">
                            <Pin size={13} />
                            <span>Pinned Message</span>
                          </div>
                        )}

                        {isMessageStarred(msg) && (
                          <div className="flex items-center gap-1 text-xs text-yellow-200">
                            <Star size={13} />
                            <span>Starred</span>
                          </div>
                        )}

                        {/* Forwarded label */}
                        {msg.isForwarded && (
                          <div className="flex items-center gap-1 text-xs text-white/60 italic">
                            <Forward size={13} />
                            <span>Forwarded</span>
                          </div>
                        )}

                        {/* Reply preview */}
                        {msg.replyTo && (
                          <div className="rounded-lg border-l-4 border-purple-300 bg-black/20 px-3 py-2">
                            <p className="text-xs font-semibold text-purple-200">
                              {msg.replyTo.sender?.fullName || "User"}
                            </p>

                            <p className="truncate text-xs text-white/70">
                              {msg.replyTo.isDeletedForEveryone
                                ? "This message was deleted"
                                : msg.replyTo.content}
                            </p>
                          </div>
                        )}

                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <p
                              className={`break-words ${
                                msg.isDeletedForEveryone
                                  ? "italic text-gray-300"
                                  : ""
                              }`}
                            >
                              {msg.isDeletedForEveryone
                                ? "This message was deleted"
                                : highlightMessage(msg.content)}
                            </p>

                            {msg.isEdited && !msg.isDeletedForEveryone && (
                              <span className="text-[10px] text-white/60 italic">
                                Edited
                              </span>
                            )}
                          </div>

                          {!msg.isDeletedForEveryone && (
                            <button
                              type="button"
                              onClick={() =>
                                setActiveMenuMessage(
                                  isMenuOpen ? null : msg._id,
                                )
                              }
                              className="text-white/70 hover:text-white"
                              title="Message options"
                            >
                              <MoreVertical size={17} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Reaction picker */}
                      {!msg.isDeletedForEveryone && (
                        <div className="relative mt-2">
                          <button
                            type="button"
                            onClick={() =>
                              setReactionMenuMessage(
                                reactionMenuMessage === msg._id
                                  ? null
                                  : msg._id,
                              )
                            }
                            className="text-xs text-white/60 hover:text-white rounded-full border border-white/15 px-2 py-1"
                            title="Add reaction"
                          >
                            ☺ React
                          </button>

                          {reactionMenuMessage === msg._id && (
                            <div className="absolute bottom-full left-0 z-[100] mb-2 flex gap-1 rounded-full border border-purple-400/30 bg-[#211d31] p-2 shadow-xl">
                              {reactionEmojis.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => handleReaction(msg._id, emoji)}
                                  className="rounded-full p-1.5 text-xl transition hover:scale-125 hover:bg-white/10"
                                  title={`React ${emoji}`}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Display reactions */}
                      {msg.reactions?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {Object.entries(
                            msg.reactions.reduce((groups, reaction) => {
                              groups[reaction.emoji] =
                                (groups[reaction.emoji] || 0) + 1;

                              return groups;
                            }, {}),
                          ).map(([emoji, count]) => {
                            const myReaction = msg.reactions.some(
                              (reaction) =>
                                String(reaction.user?._id || reaction.user) ===
                                  String(currentUserId) &&
                                reaction.emoji === emoji,
                            );

                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleReaction(msg._id, emoji)}
                                className={`rounded-full border px-2 py-0.5 text-xs ${
                                  myReaction
                                    ? "border-purple-300 bg-purple-500/30"
                                    : "border-white/15 bg-black/20"
                                }`}
                                title="Click to remove or change your reaction"
                              >
                                {emoji} {count}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Message menu */}
                      {isMenuOpen && !msg.isDeletedForEveryone && (
                        <div
                          className={`absolute ${
                            isMine ? "right-0" : "left-0"
                          } bottom-full mb-2 z-[9999] w-52 max-w-[85vw] max-h-[60vh] overflow-y-auto bg-[#242134] border border-purple-500/30 rounded-xl shadow-2xl`}
                        >
                          {/* Reply */}
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingTo(msg);
                              setEditingMessage(null);
                              setNewMessage("");
                              setActiveMenuMessage(null);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-white/10 text-left"
                          >
                            <MessageCircle size={16} />
                            Reply
                          </button>

                          {/* Forward */}
                          <button
                            type="button"
                            onClick={() => {
                              setForwardingMessage(msg);
                              setForwardSearch("");
                              setActiveMenuMessage(null);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-white/10 text-left"
                          >
                            <Forward size={16} />
                            Forward
                          </button>

                          {/* Star / Unstar */}
                          {isMessageStarred(msg) ? (
                            <button
                              type="button"
                              disabled={starringMessage}
                              onClick={() => handleUnstarMessage(msg._id)}
                              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-yellow-300 hover:bg-white/10 text-left disabled:opacity-50"
                            >
                              <StarOff size={16} />
                              {starringMessage
                                ? "Please wait..."
                                : "Remove Star"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={starringMessage}
                              onClick={() => handleStarMessage(msg._id)}
                              className="w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-white/10 text-left disabled:opacity-50"
                            >
                              <Star size={16} className="text-yellow-400" />
                              {starringMessage
                                ? "Please wait..."
                                : "Star Message"}
                            </button>
                          )}

                          {/* Pin / Unpin */}
                          {msg.isPinned ? (
                            <button
                              type="button"
                              disabled={pinningMessage}
                              onClick={() => handleUnpinMessage(msg._id)}
                              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-yellow-300 hover:bg-white/10 text-left disabled:opacity-50"
                            >
                              <PinOff size={16} />
                              {pinningMessage
                                ? "Please wait..."
                                : "Unpin Message"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={pinningMessage}
                              onClick={() => handlePinMessage(msg._id)}
                              className="w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-white/10 text-left disabled:opacity-50"
                            >
                              <Pin size={16} />
                              {pinningMessage
                                ? "Please wait..."
                                : "Pin Message"}
                            </button>
                          )}

                          {/* Edit (ફક્ત પોતાનો text message) */}
                          {isMine && msg.messageType === "text" && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMessage(msg);
                                setNewMessage(msg.content);
                                setReplyingTo(null);
                                setActiveMenuMessage(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-white/10 text-left"
                            >
                              <Pencil size={16} />
                              Edit Message
                            </button>
                          )}

                          {/* Delete for me */}
                          <button
                            type="button"
                            onClick={() => handleDeleteForMe(msg._id)}
                            className="w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-white/10 text-left"
                          >
                            <Trash2 size={16} />
                            Delete for Me
                          </button>

                          {/* Delete for everyone */}
                          {isMine && (
                            <button
                              type="button"
                              onClick={() => handleDeleteForEveryone(msg._id)}
                              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-white/10 text-left"
                            >
                              <Trash2 size={16} />
                              Delete for Everyone
                            </button>
                          )}
                        </div>
                      )}

                      {/* Time and ticks */}
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className="text-[10px] opacity-60">
                          {msg.createdAt
                            ? new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </span>

                        {isMine && (
                          <span
                            title={
                              msg.isRead
                                ? "Seen"
                                : msg.isDelivered
                                  ? "Delivered"
                                  : "Sent"
                            }
                            className={`text-xs font-bold ${
                              msg.isRead ? "text-sky-300" : "text-white/60"
                            }`}
                          >
                            {msg.isRead || msg.isDelivered ? "✓✓" : "✓"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {!messageSearch.trim() && otherUserTyping && (
                <div className="flex items-center gap-2 text-purple-400 text-sm">
                  <span>
                    {selectedChat.isGroupChat
                      ? "Someone"
                      : otherUser?.fullName || "User"}{" "}
                    is typing
                  </span>

                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                </div>
              )}
            </div>

            {/* Message input */}
            <form
              onSubmit={editingMessage ? handleEditMessage : handleSendMessage}
              className="relative shrink-0 p-3 sm:p-5 border-t border-purple-500/20 flex items-center gap-2 sm:gap-3"
            >
              {(replyingTo || editingMessage) && (
                <div className="absolute bottom-full left-5 right-5 mb-2 flex items-center justify-between gap-3 rounded-xl border border-purple-500/40 bg-[#242134] p-3 shadow-xl">
                  <div className="min-w-0 border-l-4 border-purple-400 pl-3">
                    <p className="text-sm font-semibold text-purple-300">
                      {editingMessage
                        ? "Editing your message"
                        : `Replying to ${
                            replyingTo?.sender?.fullName || "User"
                          }`}
                    </p>

                    <p className="truncate text-sm text-gray-300">
                      {editingMessage
                        ? editingMessage.content
                        : replyingTo?.isDeletedForEveryone
                          ? "This message was deleted"
                          : replyingTo?.content}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setReplyingTo(null);
                      setEditingMessage(null);
                      setNewMessage("");
                    }}
                    className="rounded-lg p-2 text-gray-300 hover:bg-white/10"
                    title="Cancel"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}

              <input
                type="text"
                value={newMessage}
                onChange={handleMessageChange}
                placeholder={
                  editingMessage
                    ? "Edit your message..."
                    : "Type your message..."
                }
                className="min-w-0 flex-1 bg-[#1b1928] border border-gray-700 rounded-xl px-3 sm:px-5 py-3 text-sm sm:text-base outline-none focus:border-purple-500"
              />

              {editingMessage && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingMessage(null);
                    setNewMessage("");
                  }}
                  className="shrink-0 px-3 py-3 rounded-xl bg-gray-700 hover:bg-gray-600"
                >
                  Cancel
                </button>
              )}

              <button
                type="submit"
                disabled={sending || !newMessage.trim()}
                className="shrink-0 px-3 sm:px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {editingMessage ? <Pencil size={18} /> : <Send size={18} />}

                {sending
                  ? editingMessage
                    ? "Saving..."
                    : "Sending..."
                  : editingMessage
                    ? "Save"
                    : "Send"}
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div className="max-w-md">
              <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-purple-500/30 to-violet-700/30 flex items-center justify-center mb-6">
                <MessageCircle size={45} className="text-purple-400" />
              </div>

              <h2 className="text-3xl font-bold">
                Welcome to <span className="text-purple-400">ChatWave</span>
              </h2>

              <p className="text-gray-400 mt-3">
                Hello {user.fullName || "Friend"}! Search and select a friend to
                start chatting.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Full Screen Status Viewer */}
      {viewingStatus &&
        activeStatusIndex !== null &&
        statuses[activeStatusIndex] && (
          <div className="fixed inset-0 z-[11000] bg-black flex items-center justify-center">
            {(() => {
              const status = statuses[activeStatusIndex];

              const statusUserId = status.user?._id || status.user;

              const isMyStatus = String(statusUserId) === String(currentUserId);

              const mediaPath = status.media || "";

              const mediaUrl = /^https?:\/\//i.test(mediaPath)
                ? mediaPath
                : `${SERVER_URL}${
                    mediaPath.startsWith("/") ? mediaPath : `/${mediaPath}`
                  }`;

              return (
                <div className="relative w-full max-w-lg h-full max-h-[850px] bg-[#171425] flex flex-col">
                  {/* Progress / Header */}
                  <div className="absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black/80 to-transparent">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={closeStatusViewer}
                        className="p-2 rounded-full hover:bg-white/10"
                      >
                        <X size={24} />
                      </button>

                      <UserAvatar
                        profilePic={status.user?.profilePic}
                        fullName={
                          status.user?.fullName || status.user?.name || "User"
                        }
                      />

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">
                          {status.user?.fullName || status.user?.name || "User"}
                        </p>

                        <p className="text-xs text-gray-300">
                          {new Date(status.createdAt).toLocaleString()}
                        </p>
                      </div>

                      {isMyStatus && (
                        <button
                          type="button"
                          onClick={() => handleDeleteStatus(status._id)}
                          className="p-2 text-red-400 hover:bg-white/10 rounded-full"
                          title="Delete Status"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Status Media */}
                  <div className="flex-1 min-h-0 flex items-center justify-center bg-black">
                    {status.mediaType === "video" ? (
                      <video
                        key={status._id}
                        src={mediaUrl}
                        controls
                        autoPlay
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <img
                        key={status._id}
                        src={mediaUrl}
                        alt="Status"
                        className="max-w-full max-h-full object-contain"
                      />
                    )}
                  </div>

                  {/* Caption */}
                  {status.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6 pt-12 text-center">
                      <p className="text-white break-words">{status.caption}</p>
                    </div>
                  )}

                  {/* Navigation */}
                  <button
                    type="button"
                    onClick={previousStatus}
                    disabled={activeStatusIndex === 0}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 disabled:opacity-20"
                  >
                    <ChevronLeft size={30} />
                  </button>

                  <button
                    type="button"
                    onClick={nextStatus}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40"
                  >
                    <ChevronRight size={30} />
                  </button>

                  {/* View Count */}
                  {isMyStatus && (
                    <div className="absolute bottom-4 left-4 flex items-center gap-2 text-white bg-black/50 rounded-full px-3 py-2">
                      <Eye size={17} />
                      <span className="text-sm">
                        {status.viewers?.length || 0} Views
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

      {/* Status Upload Popup */}
      {showStatusUpload && (
        <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4">
          <form
            onSubmit={handleUploadStatus}
            className="w-full max-w-md bg-[#171425] border border-purple-500/30 rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold">Add Status</h2>

              <button
                type="button"
                onClick={() => {
                  setShowStatusUpload(false);
                  setStatusFile(null);
                  setStatusCaption("");
                }}
                className="p-2 hover:bg-white/10 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <label className="block text-sm text-gray-300 mb-2">
              Select Photo or Video
            </label>

            <input
              type="file"
              accept="image/jpeg,image/png,image/jpg,image/webp,video/mp4,video/webm,video/quicktime"
              onChange={(e) => setStatusFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-300 bg-[#242134] rounded-xl p-3 mb-4"
            />

            {statusFile && (
              <div className="mb-4 rounded-xl overflow-hidden bg-black">
                {statusFile.type.startsWith("video/") ? (
                  <video
                    src={URL.createObjectURL(statusFile)}
                    controls
                    className="w-full max-h-64 object-contain"
                  />
                ) : (
                  <img
                    src={URL.createObjectURL(statusFile)}
                    alt="Status Preview"
                    className="w-full max-h-64 object-contain"
                  />
                )}
              </div>
            )}

            <textarea
              value={statusCaption}
              onChange={(e) => setStatusCaption(e.target.value)}
              placeholder="Write a caption..."
              maxLength={500}
              className="w-full bg-[#242134] border border-gray-700 rounded-xl p-3 outline-none focus:border-purple-500 mb-4"
            />

            {statusError && (
              <p className="text-red-400 text-sm mb-3">{statusError}</p>
            )}

            <button
              type="submit"
              disabled={!statusFile || uploadingStatus}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl py-3 font-semibold"
            >
              {uploadingStatus ? "Uploading..." : "Upload Status"}
            </button>
          </form>
        </div>
      )}

      {/* Forward Message Popup */}
      {forwardingMessage && (
        <div
          className="fixed inset-0 z-[10000] bg-black/70 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !forwarding) {
              setForwardingMessage(null);
              setForwardSearch("");
            }
          }}
        >
          <div className="w-full max-w-md bg-[#171425] border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden">
            {/* Popup Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Forward className="text-purple-400" size={21} />
                <h2 className="text-lg font-bold">Forward Message</h2>
              </div>

              <button
                type="button"
                disabled={forwarding}
                onClick={() => {
                  setForwardingMessage(null);
                  setForwardSearch("");
                }}
                className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            {/* Message Preview */}
            <div className="p-4 border-b border-white/10">
              <p className="text-xs text-purple-400 mb-2">Selected Message</p>

              <div className="bg-[#242134] rounded-xl p-3">
                <p className="text-sm text-gray-200 break-words">
                  {forwardingMessage.isDeletedForEveryone
                    ? "This message was deleted"
                    : forwardingMessage.content}
                </p>
              </div>
            </div>

            {/* Search Chats */}
            <div className="p-4">
              <input
                type="text"
                placeholder="Search conversations..."
                value={forwardSearch}
                onChange={(e) => setForwardSearch(e.target.value)}
                className="w-full bg-[#242134] border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-purple-500"
              />

              <h3 className="text-sm text-gray-400 mt-4 mb-3">
                Select a conversation
              </h3>

              <div className="max-h-64 overflow-y-auto space-y-2">
                {filteredForwardChats.map((chat) => {
                  const chatUser = getOtherUser(chat);

                  return (
                    <button
                      key={chat._id}
                      type="button"
                      disabled={forwarding}
                      onClick={() => handleForwardMessage(chat._id)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-purple-600/20 border border-transparent hover:border-purple-500/30 transition text-left disabled:opacity-50"
                    >
                      {chat.isGroupChat ? (
                        <GroupAvatar />
                      ) : (
                        <UserAvatar
                          profilePic={chatUser?.profilePic}
                          fullName={chatUser?.fullName}
                        />
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">
                          {getChatTitle(chat)}
                        </p>

                        <p className="text-xs text-gray-400 truncate">
                          {chat.isGroupChat
                            ? `${chat.participants?.length || 0} members`
                            : chatUser?.email || "Conversation"}
                        </p>
                      </div>

                      <Forward size={18} className="text-purple-400" />
                    </button>
                  );
                })}

                {filteredForwardChats.length === 0 && (
                  <p className="text-center text-gray-500 py-6 text-sm">
                    No conversations found.
                  </p>
                )}
              </div>
            </div>

            {forwarding && (
              <div className="p-3 text-center text-purple-400 text-sm">
                Forwarding message...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Group Info Popup */}
      {showGroupInfo &&
        selectedChat?.isGroupChat &&
        (() => {
          const adminId =
            selectedChat.groupAdmin?._id || selectedChat.groupAdmin;

          const isAdmin = String(adminId) === String(currentUserId);

          const memberIds = (selectedChat.participants || []).map((member) =>
            String(member?._id || member),
          );

          // Add કરી શકાય તેવા users (1-to-1 chat છે અને હજી group માં નથી)
          const addCandidates = chats
            .filter((chat) => !chat.isGroupChat)
            .map((chat) => getOtherUser(chat))
            .filter(Boolean)
            .filter((candidate) => !memberIds.includes(String(candidate._id)));

          return (
            <div
              className="fixed inset-0 z-[10000] bg-black/70 flex items-center justify-center p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) closeGroupInfo();
              }}
            >
              <div className="w-full max-w-md max-h-[90vh] flex flex-col bg-[#171425] border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                  <div className="flex items-center gap-2 min-w-0">
                    <Users className="text-purple-400 shrink-0" size={21} />
                    <h2 className="text-lg font-bold truncate">
                      {selectedChat.groupName || "Group"}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={closeGroupInfo}
                    className="p-2 rounded-lg hover:bg-white/10"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
                  <p className="text-xs text-purple-300">
                    {memberIds.length} members
                  </p>

                  <div className="space-y-2">
                    {(selectedChat.participants || []).map((member) => {
                      const memberId = String(member?._id || member);
                      const isMe = memberId === String(currentUserId);
                      const memberIsAdmin = memberId === String(adminId);

                      return (
                        <div
                          key={memberId}
                          className="flex items-center gap-3 p-3 rounded-xl bg-[#1b1928]"
                        >
                          <UserAvatar
                            profilePic={member?.profilePic}
                            fullName={member?.fullName}
                          />

                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">
                              {isMe ? "You" : member?.fullName || "User"}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              {member?.email || ""}
                            </p>
                          </div>

                          {memberIsAdmin && (
                            <span className="text-[10px] rounded-full bg-purple-500/20 border border-purple-400/40 px-2 py-1 text-purple-200">
                              Admin
                            </span>
                          )}

                          {isAdmin && !isMe && !memberIsAdmin && (
                            <button
                              type="button"
                              disabled={groupActionLoading}
                              onClick={() => handleRemoveMember(member)}
                              className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                              title="Remove from group"
                            >
                              <Trash2 size={17} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Add Members (ફક્ત Admin) */}
                  {isAdmin && (
                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          setGroupInfoError("");
                          setShowAddMembers((value) => !value);
                        }}
                        className="w-full flex items-center justify-center gap-2 rounded-xl border border-purple-500/40 py-3 text-purple-300 hover:bg-purple-600/20"
                      >
                        <Plus size={18} />
                        Add Members
                      </button>

                      {showAddMembers && (
                        <div className="mt-3 space-y-2">
                          {addCandidates.length === 0 && (
                            <p className="text-center text-gray-500 py-4 text-sm">
                              ઉમેરવા માટે કોઈ user નથી. પહેલાં તેમની સાથે chat
                              શરૂ કરો.
                            </p>
                          )}

                          {addCandidates.map((candidate) => {
                            const selected = addMembersSelected.includes(
                              candidate._id,
                            );

                            return (
                              <button
                                key={candidate._id}
                                type="button"
                                onClick={() =>
                                  setAddMembersSelected((previous) =>
                                    previous.includes(candidate._id)
                                      ? previous.filter(
                                          (id) => id !== candidate._id,
                                        )
                                      : [...previous, candidate._id],
                                  )
                                }
                                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition ${
                                  selected
                                    ? "bg-purple-600/20 border-purple-500/50"
                                    : "border-transparent hover:bg-white/5"
                                }`}
                              >
                                <UserAvatar
                                  profilePic={candidate.profilePic}
                                  fullName={candidate.fullName}
                                />

                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold truncate">
                                    {candidate.fullName}
                                  </p>
                                  <p className="text-xs text-gray-400 truncate">
                                    {candidate.email}
                                  </p>
                                </div>

                                {selected && (
                                  <span className="text-purple-300 font-bold">
                                    ✓
                                  </span>
                                )}
                              </button>
                            );
                          })}

                          {addCandidates.length > 0 && (
                            <button
                              type="button"
                              disabled={
                                groupActionLoading ||
                                addMembersSelected.length === 0
                              }
                              onClick={handleAddMembers}
                              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl py-3 font-semibold"
                            >
                              {groupActionLoading
                                ? "Adding..."
                                : `Add ${addMembersSelected.length} Member(s)`}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {groupInfoError && (
                    <p className="text-red-400 text-sm">{groupInfoError}</p>
                  )}
                </div>

                <div className="p-4 border-t border-white/10">
                  <button
                    type="button"
                    disabled={groupActionLoading}
                    onClick={handleLeaveGroup}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-500/40 py-3 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    <LogOut size={18} />
                    Leave Group
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Create Group Popup */}
      {showGroupModal && (
        <div
          className="fixed inset-0 z-[10000] bg-black/70 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeGroupModal();
          }}
        >
          <form
            onSubmit={handleCreateGroup}
            className="w-full max-w-md bg-[#171425] border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Users className="text-purple-400" size={21} />
                <h2 className="text-lg font-bold">New Group</h2>
              </div>

              <button
                type="button"
                onClick={closeGroupModal}
                className="p-2 rounded-lg hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <input
                type="text"
                placeholder="Group name"
                value={groupName}
                maxLength={50}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full bg-[#242134] border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-purple-500"
              />

              <input
                type="text"
                placeholder="Search members..."
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
                className="w-full bg-[#242134] border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-purple-500"
              />

              <p className="text-xs text-purple-300">
                Selected: {groupMembers.length} (ઓછામાં ઓછા 2)
              </p>

              <div className="max-h-60 overflow-y-auto space-y-2">
                {groupCandidates.length === 0 && (
                  <p className="text-center text-gray-500 py-6 text-sm">
                    કોઈ user મળ્યો નથી. પહેલાં તેમની સાથે chat શરૂ કરો.
                  </p>
                )}

                {groupCandidates.map((candidate) => {
                  const selected = groupMembers.includes(candidate._id);

                  return (
                    <button
                      key={candidate._id}
                      type="button"
                      onClick={() => toggleGroupMember(candidate._id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition ${
                        selected
                          ? "bg-purple-600/20 border-purple-500/50"
                          : "border-transparent hover:bg-white/5"
                      }`}
                    >
                      <UserAvatar
                        profilePic={candidate.profilePic}
                        fullName={candidate.fullName}
                      />

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">
                          {candidate.fullName}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {candidate.email}
                        </p>
                      </div>

                      {selected && (
                        <span className="text-purple-300 font-bold">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {groupError && (
                <p className="text-red-400 text-sm">{groupError}</p>
              )}
            </div>

            <div className="p-4 border-t border-white/10">
              <button
                type="submit"
                disabled={creatingGroup}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl py-3 font-semibold"
              >
                {creatingGroup ? "Creating..." : "Create Group"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default Dashboard;