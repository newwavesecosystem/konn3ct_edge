import { useState, useEffect, createContext, useContext } from "react";
import {login as apiLogin, loginSocial, register as apiRegister} from "../api/authService";

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

  // --------------------------
  // ✅ Normal Login Function
  // --------------------------
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

  const login_social = async (credentials) => {
    try {
      const res = await loginSocial(credentials);
      setUser(res.data);
      localStorage.setItem("user", JSON.stringify(res.data));
      localStorage.setItem("token", res.token); // Store token for future requests
      return res;
    } catch (error) {
      throw error;
    }
  };

  // --------------------------
  // ✅ Register Function
  // --------------------------
  const register = async (userData) => {
    try {
      const data = await apiRegister(userData);
      return data;
    } catch (error) {
      throw error;
    }
  };

  // --------------------------
  // ✅ Facebook Login Function
  // --------------------------
  const loginWithFacebook = async () => {
    return new Promise((resolve, reject) => {
      if (!window.FB) {
        return reject(new Error("Facebook SDK not loaded"));
      }

      window.FB.login(
        (response) => {
          if (response.authResponse) {
            // Fetch user profile from Facebook
            window.FB.api("/me", { fields: "id,name,email,picture" }, async (fbUser) => {
              try {
                // Here you’d typically call your backend
                // Example: send fbUser + accessToken to your API for validation
                const userData = {
                  name: fbUser.name,
                  email: fbUser.email,
                  facebookId: fbUser.id,
                  picture: fbUser.picture?.data?.url,
                  token: response.authResponse.accessToken,
                };

                // Save in state + localStorage
                setUser(userData);
                localStorage.setItem("user", JSON.stringify(userData));
                localStorage.setItem("token", userData.token);

                resolve(userData);
              } catch (err) {
                reject(err);
              }
            });
          } else {
            reject(new Error("Facebook login failed"));
          }
        },
        { scope: "public_profile,email" }
      );
    });
  };

  // --------------------------
  // ✅ Logout Function
  // --------------------------
  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  const value = {
    user,
    isAuthenticated: !!user,
    login,
    login_social,
    register,
    loginWithFacebook, // 👉 Now available everywhere
    logout,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// useAuth Hook
export default function useAuth() {
  return useContext(AuthContext);
}
