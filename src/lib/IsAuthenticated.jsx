import useAuth from "../hooks/useAuth";
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const IsAuthenticated = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated && !loading) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate, loading]);

  return isAuthenticated ? children : "loading...";
};

export default IsAuthenticated;
