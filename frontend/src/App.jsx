
import { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Register from "./pages/Register";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";

import { SocketProvider } from "./context/SocketContext";

function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem("token")
  );

  useEffect(() => {
    const checkToken = () => {
      setToken(localStorage.getItem("token"));
    };

    window.addEventListener("storage", checkToken);
    window.addEventListener("auth-change", checkToken);

    return () => {
      window.removeEventListener("storage", checkToken);
      window.removeEventListener("auth-change", checkToken);
    };
  }, []);

  return (
    <BrowserRouter>
      <SocketProvider>
        <Routes>
          <Route
            path="/"
            element={
              token ? <Dashboard /> : <Navigate to="/login" replace />
            }
          />

          <Route
            path="/profile"
            element={
              token ? <Profile /> : <Navigate to="/login" replace />
            }
          />

          <Route
            path="/register"
            element={
              token ? <Navigate to="/" replace /> : <Register />
            }
          />

          <Route
            path="/login"
            element={
              token ? <Navigate to="/" replace /> : <Login />
            }
          />

          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Routes>
      </SocketProvider>
    </BrowserRouter>
  );
}

export default App;
