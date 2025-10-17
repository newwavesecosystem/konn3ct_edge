import React, { useState } from "react";

const CreateEvents = () => {
  const [formData, setFormData] = useState({
    eventTitle: "",
    hostName: "",
    room: "",
    date: "",
    time: "",
    timezone: "",
    about: "",
    reminder: "A day before",
    logo: null,
  });

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    setFormData({ ...formData, [name]: files ? files[0] : value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log(formData);
  };

  return (
    // 👇 add this wrapper — same as EventList uses
    <div className="overflow-x-auto w-full">
      <div className="min-w-[1024px] px-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <span className="bg-blue-100 text-blue-600 p-1 rounded-full text-sm">📅</span>
            Create Event
          </h2>
          <span className="text-gray-400 text-sm">EVENT SETUP</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 w-full">
          {/* Event Title */}
          <div>
            <label className="block text-sm font-medium mb-1">Event Title</label>
            <input
              type="text"
              name="eventTitle"
              value={formData.eventTitle}
              onChange={handleChange}
              className="w-full border rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Host Name */}
          <div>
            <label className="block text-sm font-medium mb-1">Host Name</label>
            <input
              type="text"
              name="hostName"
              value={formData.hostName}
              onChange={handleChange}
              className="w-full border rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* 2-column sections */}
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium mb-1">Select Room</label>
              <select
                name="room"
                value={formData.room}
                onChange={handleChange}
                className="w-full border rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">Select Room</option>
                <option>Room A</option>
                <option>Room B</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Event Date</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="w-full border rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium mb-1">Event Time</label>
              <input
                type="time"
                name="time"
                value={formData.time}
                onChange={handleChange}
                className="w-full border rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Time Zone</label>
              <select
                name="timezone"
                value={formData.timezone}
                onChange={handleChange}
                className="w-full border rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">Select time zone</option>
                <option>GMT</option>
                <option>WAT</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">About the event</label>
            <textarea
              name="about"
              rows="3"
              value={formData.about}
              onChange={handleChange}
              className="w-full border rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Set Reminder</label>
            <select
              name="reminder"
              value={formData.reminder}
              onChange={handleChange}
              className="w-full border rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option>A day before</option>
              <option>An hour before</option>
              <option>30 minutes before</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Upload a logo</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
              <input id="fileInput" type="file" className="hidden" />
              <label htmlFor="fileInput" className="cursor-pointer text-gray-500 text-sm">
                Select a file or drop here
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              className="bg-red-100 text-red-600 px-5 py-2 rounded-lg hover:bg-red-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700"
            >
              Submit
            </button>
          </div>
        </form>

        {/* Bottom padding to imitate EventList table space */}
        <div className="h-40" />
      </div>
    </div>
  );
};

export default CreateEvents;
