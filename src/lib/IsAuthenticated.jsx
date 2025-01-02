import useAuth from "../hooks/useAuth";
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const IsAuthenticated = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated]);

  return isAuthenticated ? children : "loading...";
};

export default IsAuthenticated;
