import { useState, useEffect, createContext, useContext } from "react";
import { login as apiLogin, register as apiRegister } from "../api/authService";

// Create Auth Context
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const storedUser = localStorage.getItem("user");

    if (storedUser && storedUser !== "undefined") {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  // Login Function (API Call)
  const login = async (credentials) => {
    try {
      const res = await apiLogin(credentials);
      setUser(res.data);
      localStorage.setItem("user", JSON.stringify(res.data));
      localStorage.setItem("token", res.token); // Store token for future requests
      return res;
    } catch (error) {
      throw error;
    }
  };

  // Register Function
  const register = async (userData) => {
    try {
      const data = await apiRegister(userData);
      return data;
    } catch (error) {
      throw error;
    }
  };

  // Logout
  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  const value = {
    user,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// useAuth Hook
export default function useAuth() {
  return useContext(AuthContext);
}
