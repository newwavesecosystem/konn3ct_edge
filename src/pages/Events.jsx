import React from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import EventList from "./EventList";
import CreateEvents from "./CreateEvents";
import EventParticipants from "./EventParticipants";

const Events = () => {
  const navigate = useNavigate();

  return (
    <div className="flex w-full items-start justify-center px-3 py-4 md:px-4 md:py-6 lg:p-8">
      <Routes>
        {/* Default route: event list */}
        <Route path="/" element={<EventList />} />

        {/* Create event form */}
        <Route
          path="create"
          element={<CreateEvents onClose={() => navigate("/events")} />}
        />

        {/* Participant route */}
        <Route
          path="participants/:reference"
          element={<EventParticipants />}
        />
      </Routes>
    </div>
  );
};

export default Events;
