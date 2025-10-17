import React from "react";
import EventList from "./EventList"; 
import CreateEvents from "./CreateEvents";

const Events = () => {
  return (
    <div className="min-h-screen pt-24 px-6 pb-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-[14px] border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-5 mt-8 ">
            {/* <EventList /> */}
            <CreateEvents />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Events;
