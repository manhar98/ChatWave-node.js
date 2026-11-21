
import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext(null);

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || "https://chatwave-node-js.onrender.com";

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  const [token, setToken] = useState(() =>
    localStorage.getItem("token")
  );

  // Listen for login and logout
  useEffect(() => {
    const updateToken = () => {
      setToken(localStorage.getItem("token"));
    };

    window.addEventListener("auth-change", updateToken);
    window.addEventListener("storage", updateToken);

    return () => {
      window.removeEventListener("auth-change", updateToken);
      window.removeEventListener("storage", updateToken);
    };
  }, []);

  // Connect Socket.IO with Auto Reconnect
  useEffect(() => {
    if (!token) {
      setSocket(null);
      setIsConnected(false);
      return;
    }

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      withCredentials: true,

      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    newSocket.on("connect", () => {
      console.log("Socket Connected:", newSocket.id);

      setIsConnected(true);

      // Notify backend that user is online
      newSocket.emit("user_online");
    });

    newSocket.on("disconnect", (reason) => {
      console.log("Socket Disconnected:", reason);
      setIsConnected(false);
    });

    newSocket.on("connect_error", (error) => {
      console.log("Socket Connection Error:", error.message);
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      setIsConnected(false);
    };
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
