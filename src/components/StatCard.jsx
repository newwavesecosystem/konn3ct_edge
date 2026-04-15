import React from "react";

import { cn } from "../lib/utils";

const StatCard = ({
  value,
  name,
  icon,
  className,
  onIconClick,
  iconButtonLabel,
}) => {
  const hasIconAction = typeof onIconClick === "function";

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
        {hasIconAction ? (
          <button
            type="button"
            onClick={onIconClick}
            aria-label={iconButtonLabel || name}
            className="inline-flex rounded-md transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <img src={icon} alt="" />
          </button>
        ) : (
          <img src={icon} alt="" />
        )}
      </div>
    </div>
  );
};

export default StatCard;
