import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const capitalize = (str) => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const formatDate = (dateString, time = true) => {
  // Create a Date object from the input string
  const date = new Date(dateString);

  // Get the components of the date
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  // Return the formatted string
  return (
    `${year}-${month}-${day}` + (time ? ` ${hours}:${minutes}:${seconds}` : "")
  );
};

export const byteToMB = (byte) => {
  return (byte / (1024 * 1024)).toFixed(2);
};
