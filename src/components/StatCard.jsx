import React from "react";

const StatCard = ({ value, name, icon }) => {
  return (
    <div className="flex font-medium text-base w-[240px] items-center">
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
