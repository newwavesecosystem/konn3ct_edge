import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPreRegEvent, getRooms } from "../api/eventsApi";
import { useToast } from "../hooks/use-toast";

// --- TIMEZONE GENERATOR ---
const getTimezones = () => {
  return Intl.supportedValuesOf("timeZone").map((tz) => tz);
};

const CreateEvents = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: "",
    host: "",
    room: "",
    date: "",
    time: "",
    timezone: "",
    about: "",
    reminder: "",
    logo: null,

        free: "1",
    currency: "NGN",
    amount: "",

  });

  const [loading, setLoading] = useState(false);
  const [logoError, setLogoError] = useState("");

  // Rooms state
  const [rooms, setRooms] = useState([]);
  const [roomLoading, setRoomLoading] = useState(true);

  // --- NEW TIMEZONE STATE ---
  const [timezones, setTimezones] = useState([]);

  // Load timezones
  useEffect(() => {
    setTimezones(getTimezones());
  }, []);

  // Fetch rooms
  useEffect(() => {
    let cancelled = false;
    const loadRooms = async () => {
      try {
        const res = await getRooms();
        let list = res;

        if (!Array.isArray(list)) {
          if (list && typeof list === "object") {
            if (Array.isArray(list.data)) list = list.data;
            else if (Array.isArray(list.rooms)) list = list.rooms;
            else {
              const values = Object.values(list).filter((v) => Array.isArray(v));
              list = values.length > 0 ? values[0] : [];
            }
          } else {
            list = [];
          }
        }

        if (!cancelled) setRooms(list);
      } catch (err) {
        console.error("Failed to load rooms:", err);
        setRooms([]);
      } finally {
        if (!cancelled) setRoomLoading(false);
      }
    };

    loadRooms();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    setLogoError("");
    setFormData((prev) => ({ ...prev, logo: file }));
  };

  const handleFileDragOver = (e) => {
    e.preventDefault();
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0] || null;
    if (file) {
      setLogoError("");
      setFormData((prev) => ({ ...prev, logo: file }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.logo) {
      setLogoError("Logo upload is required.");
      return;
    }

    setLogoError("");
    setLoading(true);

    try {
      const data = new FormData();

      if (formData.title) data.append("title", formData.title);
      if (formData.host) data.append("hostname", formData.host);
      if (formData.room) data.append("room_id", formData.room);
      if (formData.date) data.append("date", formData.date);
      if (formData.time) data.append("time", formData.time);
      if (formData.timezone) data.append("timezone", formData.timezone);
      if (formData.about) data.append("about", formData.about);
      if (formData.reminder) data.append("reminder", formData.reminder);
      if (formData.logo) data.append("logo", formData.logo);
            data.append("free", formData.free);
      data.append("currency", formData.currency);
      data.append("amount", formData.free === "1" ? 0 : formData.amount);


      const res = await createPreRegEvent(data);

      if (res?.success) {
        toast({ description: "Event created successfully!" });
        navigate("/events");
      } else {
        toast({
          description:
            res?.message || "Event creation failed. Please check your inputs.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating event:", error);
      toast({
        description: "Failed to create event. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full px-10 py-10 md:px-6 lg:px-10">
      <div className="w-full rounded-2xl border border-gray-100 bg-white p-10 shadow-sm md:p-6 lg:p-10">
        {/* Header */}
        <div className="flex items-start gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10m-12 8h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-gray-800">Create Event</h2>
            <p className="text-gray-500 text-sm">
              Fill the form to create an event instantly
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6 w-full">
          <div className="max-w-5xl">
            <div>
              <label className="block text-gray-700 text-sm mb-1">Event Title</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Enter your event title"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
              />
            </div>

            <div className="mt-4">
              <label className="block text-gray-700 text-sm mb-1">Host Name</label>
              <input
                type="text"
                name="host"
                value={formData.host}
                onChange={handleChange}
                placeholder="Enter host name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div>
                <label className="block text-gray-700 text-sm mb-1">Select Room</label>
                <select
                  name="room"
                  value={formData.room}
                  onChange={handleChange}
                  disabled={roomLoading}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
                >
                  <option value="">
                    {roomLoading ? "Loading rooms..." : "Select Room"}
                  </option>
                  {Array.isArray(rooms) &&
                    rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.room_name ||
                          room.name ||
                          room.label ||
                          `Room ${room.id}`}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-700 text-sm mb-1">Event Date</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div>
                <label className="block text-gray-700 text-sm mb-1">Event Time</label>
                <input
                  type="time"
                  name="time"
                  value={formData.time}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
                />
              </div>
                          <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-gray-700 text-sm mb-1">
                  Event Type
                </label>
                <select
                  name="free"
                  value={formData.free}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
                >
                  <option value="1">Free</option>
                  <option value="0">Paid</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 text-sm mb-1">
                  Currency
                </label>
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  disabled={formData.free === "1"}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
                >
                  <option value="NGN">NGN</option>
                  <option value="USD">USD</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 text-sm mb-1">
                  Amount
                </label>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  disabled={formData.free === "1"}
                  placeholder="6000"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
                />
              </div>
            </div>


              {/* ----------- NEW TIMEZONE DROPDOWN ----------- */}
              <div>
                <label className="block text-gray-700 text-sm mb-1">Time Zone</label>
                <select
                  name="timezone"
                  value={formData.timezone}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
                >
                  <option value="">Select timezone</option>
                  {timezones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-gray-700 text-sm mb-1">About the event</label>
              <textarea
                name="about"
                rows="4"
                value={formData.about}
                onChange={handleChange}
                placeholder="Write a short description about your event"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
              />
            </div>

            <div className="mt-4">
              <label className="block text-gray-700 text-sm mb-1">Set Reminder</label>
              <select
                name="reminder"
                value={formData.reminder}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
              >
                <option value="">Select reminder</option>
                <option value="2">2 days before</option>
                <option value="1">1 day before</option>
                <option value="0.5">12 hours before</option>
              </select>
            </div>

            <div className="mt-4">
              <label className="block text-gray-700 text-sm mb-2">
                Upload a logo *
              </label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center ${
                  logoError ? "border-red-400" : "border-gray-300"
                }`}
                onDragOver={handleFileDragOver}
                onDrop={handleFileDrop}
              >
                <input
                  id="fileUpload"
                  name="logo"
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <label htmlFor="fileUpload" className="cursor-pointer text-gray-500 text-sm">
                  <span className="block mb-1">Select a file or drop here</span>
                  <span className="text-xs text-gray-400">JPG, PNG, or PDF (max 10MB)</span>
                </label>
              </div>
              {formData.logo ? (
                <p className="text-xs text-gray-500 mt-2">Selected: {formData.logo.name}</p>
              ) : null}
              {logoError ? <p className="text-xs text-red-500 mt-2">{logoError}</p> : null}
              <p className="text-xs text-gray-400 mt-1">Recommended: 80px by 80px, PNG format</p>
            </div>

            <div className="flex justify-end gap-3 pt-6">
              <button
                type="button"
                onClick={() => navigate("/events")}
                className="bg-red-100 text-red-600 px-5 py-2 rounded-lg hover:bg-red-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`${loading ? "bg-green-400" : "bg-green-600 hover:bg-green-700"
                  } text-white px-5 py-2 rounded-lg transition`}
              >
                {loading ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateEvents;
