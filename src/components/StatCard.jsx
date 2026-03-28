import React from "react";

import { cn } from "../lib/utils";

const StatCard = ({ value, name, icon, className }) => {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 max-w-[240px] items-center font-medium text-base",
        className
      )}
    >
      <div className="flex flex-col gap-y-2">
        <p>{value}</p>
        <p>{name.toUpperCase()}</p>
      </div>
      <div className="ml-auto">
        <img src={icon} alt="" />
      </div>
    </div>
  );
};

export default StatCard;
