import { useEffect, useState, useRef } from "react";
import {
  MessageCircle,
  Search,
  Settings,
  LogOut,
  User,
  Plus,
  Send,
  MoreVertical,
  Trash2,
} from "lucide-react";

import API from "../utils/api";
import { useSocket } from "../context/SocketContext";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000/api";

const SERVER_URL = API_BASE_URL.replace(/\/api\/?$/, "");

// Profile image URL
const getProfileImage = (profilePic) => {
  if (!profilePic) return "";

  if (/^https?:\/\//i.test(profilePic)) {
    return profilePic;
  }

  const imagePath = profilePic.startsWith("/") ? profilePic : `/${profilePic}`;

  return `${SERVER_URL}${imagePath}`;
};

// Reusable Avatar Component
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

function Dashboard() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const { socket, isConnected } = useSocket();

  // Search states
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
  const [activeMenuMessage, setActiveMenuMessage] = useState(null);

  const typingTimeoutRef = useRef(null);

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

        if (updatedChat) {
          setSelectedChat(updatedChat);
        }
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

  // Mark messages as delivered
  const markChatMessagesAsDelivered = async (chatId) => {
    try {
      const { data } = await API.patch(`/messages/${chatId}/delivered`);

      if (data.success) {
        setMessages((previousMessages) =>
          previousMessages.map((msg) => {
            const senderId = msg.sender?._id || msg.sender;

            if (String(senderId) !== String(user._id)) {
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

            if (String(senderId) !== String(user._id)) {
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

  // Load chats when Dashboard opens
  useEffect(() => {
    fetchChats();
  }, []);

  // Load messages when selected chat changes
  useEffect(() => {
    if (selectedChat?._id) {
      setActiveMenuMessage(null);

      const loadMessages = async () => {
        await fetchMessages(selectedChat._id);
        await markChatMessagesAsDelivered(selectedChat._id);
        await markChatMessagesAsRead(selectedChat._id);
      };

      loadMessages();
    } else {
      setMessages([]);
    }
  }, [selectedChat?._id]);

  // Real-time Online / Offline Status
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

  // Real-time Chat, Delivery, Read, Delete and Typing
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

    // Receive new messages
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

      if (String(senderId) !== String(user._id)) {
        if (document.visibilityState === "visible") {
          markChatMessagesAsDelivered(chatId);
          markChatMessagesAsRead(chatId);
        } else {
          fetchChats();
        }
      }
    };

    // When other user reads messages
    const handleMessagesRead = (data) => {
      if (String(data.chatId) !== String(chatId)) return;

      if (String(data.readerId) === String(user._id)) return;

      setMessages((previousMessages) =>
        previousMessages.map((msg) => {
          const senderId = msg.sender?._id || msg.sender;

          if (String(senderId) === String(user._id)) {
            return { ...msg, isRead: true };
          }

          return msg;
        }),
      );
    };

    // When messages are delivered
    const handleMessagesDelivered = (data) => {
      if (String(data.chatId) !== String(chatId)) return;

      // Receiver should not update their own outgoing messages
      if (String(data.receiverId) === String(user._id)) return;

      setMessages((previousMessages) =>
        previousMessages.map((msg) => {
          const senderId = msg.sender?._id || msg.sender;

          if (String(senderId) === String(user._id)) {
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

    // Receive message deleted for everyone
    const handleMessageDeleted = (data) => {
      if (String(data.chatId) !== String(chatId)) return;

      setMessages((previousMessages) =>
        previousMessages.map((msg) =>
          String(msg._id) === String(data.messageId)
            ? {
                ...msg,
                content: "This message was deleted",
                isDeletedForEveryone: true,
              }
            : msg,
        ),
      );

      setActiveMenuMessage(null);
    };

    // Other user started typing
    const handleUserTyping = (data) => {
      if (
        String(data.chatId) === String(chatId) &&
        String(data.userId) !== String(user._id)
      ) {
        setOtherUserTyping(true);
      }
    };

    // Other user stopped typing
    const handleUserStopTyping = (data) => {
      if (
        String(data.chatId) === String(chatId) &&
        String(data.userId) !== String(user._id)
      ) {
        setOtherUserTyping(false);
      }
    };

    // Register listeners
    socket.on("new_message", handleNewMessage);
    socket.on("messages_read", handleMessagesRead);
    socket.on("messages_delivered", handleMessagesDelivered);
    socket.on("message_deleted_for_everyone", handleMessageDeleted);
    socket.on("user_typing", handleUserTyping);
    socket.on("user_stop_typing", handleUserStopTyping);

    // Cleanup listeners
    return () => {
      clearTimeout(typingTimeoutRef.current);

      socket.emit("stop_typing", chatId);

      socket.off("new_message", handleNewMessage);
      socket.off("messages_read", handleMessagesRead);
      socket.off("messages_delivered", handleMessagesDelivered);
      socket.off("message_deleted_for_everyone", handleMessageDeleted);
      socket.off("user_typing", handleUserTyping);
      socket.off("user_stop_typing", handleUserStopTyping);

      setOtherUserTyping(false);
    };
  }, [socket, selectedChat?._id]);

  // Automatically reconnect and refresh messages
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

      if (data.chat) {
        setSelectedChat(data.chat);
      }

      await fetchChats();

      setSearch("");
      setUsers([]);
    } catch (err) {
      console.log("Create Chat Error:", err);

      setChatError(err.response?.data?.message || "Chat શરૂ થઈ શક્યો નથી.");
    }
  };

  // Format Last Seen
  const formatLastSeen = (date) => {
    if (!date) return "Offline";

    return new Date(date).toLocaleString([], {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Find other participant
  const getOtherUser = (chat) => {
    return chat.participants?.find((participant) => {
      const participantId = participant?._id || participant;

      return String(participantId) !== String(user._id);
    });
  };

  // Handle typing
  const handleMessageChange = (e) => {
    const value = e.target.value;

    setNewMessage(value);

    if (!socket || !selectedChat?._id || !isConnected) {
      return;
    }

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

    if (!newMessage.trim() || !selectedChat?._id || sending) {
      return;
    }

    try {
      setSending(true);
      setMessageError("");

      const { data } = await API.post("/messages", {
        chatId: selectedChat._id,
        content: newMessage.trim(),
      });

      clearTimeout(typingTimeoutRef.current);

      if (socket && selectedChat?._id) {
        socket.emit("stop_typing", selectedChat._id);
      }

      setNewMessage("");

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

  // Delete Message for Me
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

  // Delete Message for Everyone
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

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.dispatchEvent(new Event("auth-change"));

    window.location.href = "/login";
  };

  const otherUser = selectedChat ? getOtherUser(selectedChat) : null;

  return (
    <div className="min-h-screen bg-[#080711] text-white flex">
      {/* Sidebar */}
      <aside className="w-20 md:w-64 bg-[#12101d] border-r border-purple-500/20 flex flex-col p-4">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-violet-700 flex items-center justify-center text-xl font-bold">
            C
          </div>

          <h1 className="hidden md:block text-xl font-bold">
            Chat<span className="text-purple-400">Wave</span>
          </h1>
        </div>

        <button className="flex items-center gap-3 p-3 rounded-xl bg-purple-600">
          <MessageCircle size={21} />
          <span className="hidden md:block">Messages</span>
        </button>

        <button
          onClick={() => (window.location.href = "/profile")}
          className="flex items-center gap-3 p-3 mt-3 rounded-xl hover:bg-white/5 text-gray-400 w-full"
        >
          <User size={21} />
          <span className="hidden md:block">My Profile</span>
        </button>

        <button className="flex items-center gap-3 p-3 mt-3 rounded-xl hover:bg-white/5 text-gray-400">
          <Settings size={21} />
          <span className="hidden md:block">Settings</span>
        </button>

        <div className="mt-auto">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 p-3 rounded-xl text-red-400 hover:bg-red-500/10 w-full"
          >
            <LogOut size={21} />
            <span className="hidden md:block">Logout</span>
          </button>
        </div>
      </aside>

      {/* Chat List and Search */}
      <section className="w-full md:w-96 border-r border-purple-500/20 bg-[#0e0c18] p-5 overflow-y-auto">
        <h2 className="text-2xl font-bold mb-2">Messages</h2>

        <p className="text-gray-400 text-sm mb-6">Connect with your friends</p>

        {/* Search Input */}
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

        {/* Search Results */}
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

        {/* Conversations */}
        <div className="border-t border-gray-800 pt-5">
          <h3 className="text-lg font-semibold mb-4">Your Conversations</h3>

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
                    <UserAvatar
                      profilePic={chatOtherUser?.profilePic}
                      fullName={chatOtherUser?.fullName}
                    />

                    <span
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0e0c18] ${
                        chatOtherUser?.isOnline ? "bg-green-400" : "bg-gray-500"
                      }`}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold truncate">
                      {chatOtherUser?.fullName || "Unknown User"}
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

      {/* Main Chat Area */}
      <main className="hidden md:flex flex-1 flex-col bg-[#080711]">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="p-5 border-b border-purple-500/20 flex items-center gap-3">
              <div className="relative">
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
              </div>

              <div>
                <h2 className="font-bold text-lg">
                  {otherUser?.fullName || "Chat"}
                </h2>

                <p
                  className={`text-xs ${
                    otherUser?.isOnline ? "text-green-400" : "text-gray-400"
                  }`}
                >
                  {otherUser?.isOnline
                    ? "● Online"
                    : `● Last seen: ${formatLastSeen(otherUser?.lastSeen)}`}
                </p>

                <p
                  className={`text-[10px] ${
                    isConnected ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {isConnected ? "Socket Connected" : "Socket Disconnected"}
                </p>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
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

              {/* Message List */}
              {messages.map((msg) => {
                const senderId = msg.sender?._id || msg.sender;

                const isMine = String(senderId) === String(user._id);

                const isMenuOpen = activeMenuMessage === msg._id;

                return (
                  <div
                    key={msg._id}
                    className={`flex ${
                      isMine ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`relative max-w-[70%] px-4 py-3 rounded-2xl ${
                        isMine
                          ? "bg-purple-600 rounded-br-sm"
                          : "bg-[#1b1928] rounded-bl-sm"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <p
                          className={`break-words flex-1 ${
                            msg.isDeletedForEveryone
                              ? "italic text-gray-300"
                              : ""
                          }`}
                        >
                          {msg.isDeletedForEveryone
                            ? "This message was deleted"
                            : msg.content}
                        </p>

                        {/* Message Menu */}
                        {!msg.isDeletedForEveryone && (
                          <button
                            type="button"
                            onClick={() =>
                              setActiveMenuMessage(isMenuOpen ? null : msg._id)
                            }
                            className="text-white/70 hover:text-white"
                            title="Message options"
                          >
                            <MoreVertical size={17} />
                          </button>
                        )}
                      </div>

                      {/* Delete Options */}
                      {isMenuOpen && !msg.isDeletedForEveryone && (
                        <div className="absolute right-2 top-9 z-20 w-52 bg-[#242134] border border-purple-500/30 rounded-xl shadow-xl overflow-hidden">
                          <button
                            type="button"
                            onClick={() => handleDeleteForMe(msg._id)}
                            className="w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-white/10 text-left"
                          >
                            <Trash2 size={16} />
                            Delete for Me
                          </button>

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

                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className="text-[10px] opacity-60">
                          {msg.createdAt
                            ? new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </span>

                        {/* WhatsApp Style Ticks */}
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

              {/* Typing Indicator */}
              {otherUserTyping && (
                <div className="flex items-center gap-2 text-purple-400 text-sm">
                  <span>{otherUser?.fullName || "User"} is typing</span>

                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                </div>
              )}
            </div>

            {/* Message Input */}
            <form
              onSubmit={handleSendMessage}
              className="p-5 border-t border-purple-500/20 flex gap-3"
            >
              <input
                type="text"
                value={newMessage}
                onChange={handleMessageChange}
                placeholder="Type your message..."
                className="flex-1 bg-[#1b1928] border border-gray-700 rounded-xl px-5 py-3 outline-none focus:border-purple-500"
              />

              <button
                type="submit"
                disabled={sending || !newMessage.trim()}
                className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Send size={18} />
                {sending ? "Sending..." : "Send"}
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
    </div>
  );
}

export default Dashboard;
