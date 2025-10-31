import React from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import EventList from "./EventList";
import CreateEvents from "./CreateEvents";
import EventParticipants from "./EventParticipants";

const Events = () => {
  const navigate = useNavigate();

  return (
    <div className="flex justify-center items-start w-full p-8">
      <Routes>
        {/* Default route: event list */}
        <Route path="/" element={<EventList />} />

        {/* Create event form */}
        <Route
          path="create"
          element={<CreateEvents onClose={() => navigate("/events")} />}
        />

        {/* Future participants route */}
        <Route path="participants/:id" element={<EventParticipants />} />
      </Routes>
    </div>
  );
};

export default Events;
