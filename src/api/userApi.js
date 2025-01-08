import { api } from ".";
import useAuth from "../hooks/useAuth";
import axios from "axios";
const BASE_URL = "https://dev.konn3ct.ng/api/app";

const token = localStorage.getItem("token");

export const getUser = async () => {
  try {
    const res = await api.get("/profile");

    return res.data.data;
  } catch (error) {
    throw error(error);
  }
};
