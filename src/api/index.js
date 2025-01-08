import axios from "axios";

const BASE_URL = "https://dev.konn3ct.ng/api/app";

const token = localStorage.getItem("token");

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
