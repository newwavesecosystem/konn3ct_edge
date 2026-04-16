import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { createPreRegEvent, getRooms } from "../api/eventsApi";
import { useToast } from "../hooks/use-toast";

const EVENT_CREATE_TEXT = {
  title: "Create Event",
  description: "Fill the form to create an event instantly",
  loadingRooms: "Loading rooms...",
  logoRequired: "Logo upload is required.",
  success: "Event created successfully!",
  failure: "Event creation failed. Please check your inputs.",
  failureRetry: "Failed to create event. Please try again.",
  submitting: "Submitting...",
  cancel: "Cancel",
  submit: "Submit",
  fields: {
    title: "Event Title",
    host: "Host Name",
    room: "Select Room",
    date: "Event Date",
    time: "Event Time",
    type: "Event Type",
    currency: "Currency",
    amount: "Amount",
    timezone: "Time Zone",
    about: "About the event",
    reminder: "Set Reminder",
    logo: "Upload a logo",
  },
  placeholders: {
    title: "Enter your event title",
    host: "Enter host name",
    room: "Select Room",
    amount: "6000",
    timezone: "Select timezone",
    about: "Write a short description about your event",
    reminder: "Select reminder",
  },
  typeOptions: {
    free: "Free",
    paid: "Paid",
  },
  reminderOptions: [
    { value: "2", label: "2 days before" },
    { value: "1", label: "1 day before" },
    { value: "0.5", label: "12 hours before" },
  ],
  fileUpload: {
    selectOrDrop: "Select a file or drop here",
    supportedFormats: "JPG, PNG, or PDF (max 10MB)",
    recommended: "Recommended: 80px by 80px, PNG format",
  },
};

const getTimezones = () =>
  Intl.supportedValuesOf("timeZone").map((timezone) => timezone);
const getRoomFallbackLabel = (id) => `Room ${id}`;
const getSelectedFileLabel = (name) => `Selected: ${name}`;

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
  const [rooms, setRooms] = useState([]);
  const [roomLoading, setRoomLoading] = useState(true);
  const [timezones, setTimezones] = useState([]);

  useEffect(() => {
    setTimezones(getTimezones());
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadRooms = async () => {
      try {
        const response = await getRooms();
        let list = response;

        if (!Array.isArray(list)) {
          if (list && typeof list === "object") {
            if (Array.isArray(list.data)) {
              list = list.data;
            } else if (Array.isArray(list.rooms)) {
              list = list.rooms;
            } else {
              const values = Object.values(list).filter((value) =>
                Array.isArray(value)
              );
              list = values.length > 0 ? values[0] : [];
            }
          } else {
            list = [];
          }
        }

        if (!cancelled) {
          setRooms(list);
        }
      } catch (error) {
        console.error("Failed to load rooms:", error);
        setRooms([]);
      } finally {
        if (!cancelled) {
          setRoomLoading(false);
        }
      }
    };

    loadRooms();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previousData) => ({ ...previousData, [name]: value }));
  };

  const handleFileChange = (event) => {
    const file =
      event.target.files && event.target.files[0] ? event.target.files[0] : null;
    setLogoError("");
    setFormData((previousData) => ({ ...previousData, logo: file }));
  };

  const handleFileDragOver = (event) => {
    event.preventDefault();
  };

  const handleFileDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0] || null;

    if (file) {
      setLogoError("");
      setFormData((previousData) => ({ ...previousData, logo: file }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.logo) {
      setLogoError(EVENT_CREATE_TEXT.logoRequired);
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

      const response = await createPreRegEvent(data);

      if (response?.success) {
        toast({ description: EVENT_CREATE_TEXT.success });
        navigate("/events");
      } else {
        toast({
          description: response?.message || EVENT_CREATE_TEXT.failure,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating event:", error);
      toast({
        description: EVENT_CREATE_TEXT.failureRetry,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full px-10 py-10 md:px-6 lg:px-10">
      <div className="w-full rounded-2xl border border-gray-100 bg-white p-10 shadow-sm dark:border-border dark:bg-card md:p-6 lg:p-10">
        <div className="mb-8 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/15">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-green-600 dark:text-green-300"
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
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-foreground">
              {EVENT_CREATE_TEXT.title}
            </h2>
            <p className="text-sm text-gray-500 dark:text-muted-foreground">
              {EVENT_CREATE_TEXT.description}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-6">
          <div className="max-w-5xl">
            <div>
              <label className="mb-1 block text-sm text-gray-700 dark:text-foreground">
                {EVENT_CREATE_TEXT.fields.title}
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder={EVENT_CREATE_TEXT.placeholders.title}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition-colors focus:border-green-500 focus:ring-2 focus:ring-green-100 dark:border-input dark:bg-background dark:text-foreground dark:placeholder:text-muted-foreground dark:focus:ring-ring/30"
              />
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm text-gray-700 dark:text-foreground">
                {EVENT_CREATE_TEXT.fields.host}
              </label>
              <input
                type="text"
                name="host"
                value={formData.host}
                onChange={handleChange}
                placeholder={EVENT_CREATE_TEXT.placeholders.host}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition-colors focus:border-green-500 focus:ring-2 focus:ring-green-100 dark:border-input dark:bg-background dark:text-foreground dark:placeholder:text-muted-foreground dark:focus:ring-ring/30"
              />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-gray-700 dark:text-foreground">
                  {EVENT_CREATE_TEXT.fields.room}
                </label>
                <select
                  name="room"
                  value={formData.room}
                  onChange={handleChange}
                  disabled={roomLoading}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition-colors focus:border-green-500 focus:ring-2 focus:ring-green-100 dark:border-input dark:bg-background dark:text-foreground dark:focus:ring-ring/30"
                >
                  <option value="">
                    {roomLoading
                      ? EVENT_CREATE_TEXT.loadingRooms
                      : EVENT_CREATE_TEXT.placeholders.room}
                  </option>
                  {Array.isArray(rooms) &&
                    rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.room_name ||
                          room.name ||
                          room.label ||
                          getRoomFallbackLabel(room.id)}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-700 dark:text-foreground">
                  {EVENT_CREATE_TEXT.fields.date}
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition-colors focus:border-green-500 focus:ring-2 focus:ring-green-100 dark:border-input dark:bg-background dark:text-foreground dark:focus:ring-ring/30"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-gray-700 dark:text-foreground">
                  {EVENT_CREATE_TEXT.fields.time}
                </label>
                <input
                  type="time"
                  name="time"
                  value={formData.time}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition-colors focus:border-green-500 focus:ring-2 focus:ring-green-100 dark:border-input dark:bg-background dark:text-foreground dark:focus:ring-ring/30"
                />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm text-gray-700 dark:text-foreground">
                    {EVENT_CREATE_TEXT.fields.type}
                  </label>
                  <select
                    name="free"
                    value={formData.free}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm transition-colors dark:border-input dark:bg-background dark:text-foreground"
                  >
                    <option value="1">
                      {EVENT_CREATE_TEXT.typeOptions.free}
                    </option>
                    <option value="0">
                      {EVENT_CREATE_TEXT.typeOptions.paid}
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-700 dark:text-foreground">
                    {EVENT_CREATE_TEXT.fields.currency}
                  </label>
                  <select
                    name="currency"
                    value={formData.currency}
                    onChange={handleChange}
                    disabled={formData.free === "1"}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm transition-colors dark:border-input dark:bg-background dark:text-foreground"
                  >
                    <option value="NGN">NGN</option>
                    <option value="USD">USD</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-700 dark:text-foreground">
                    {EVENT_CREATE_TEXT.fields.amount}
                  </label>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleChange}
                    disabled={formData.free === "1"}
                    placeholder={EVENT_CREATE_TEXT.placeholders.amount}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm transition-colors dark:border-input dark:bg-background dark:text-foreground dark:placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-700 dark:text-foreground">
                  {EVENT_CREATE_TEXT.fields.timezone}
                </label>
                <select
                  name="timezone"
                  value={formData.timezone}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition-colors focus:border-green-500 focus:ring-2 focus:ring-green-100 dark:border-input dark:bg-background dark:text-foreground dark:focus:ring-ring/30"
                >
                  <option value="">
                    {EVENT_CREATE_TEXT.placeholders.timezone}
                  </option>
                  {timezones.map((timezone) => (
                    <option key={timezone} value={timezone}>
                      {timezone}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm text-gray-700 dark:text-foreground">
                {EVENT_CREATE_TEXT.fields.about}
              </label>
              <textarea
                name="about"
                rows="4"
                value={formData.about}
                onChange={handleChange}
                placeholder={EVENT_CREATE_TEXT.placeholders.about}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition-colors focus:border-green-500 focus:ring-2 focus:ring-green-100 dark:border-input dark:bg-background dark:text-foreground dark:placeholder:text-muted-foreground dark:focus:ring-ring/30"
              />
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm text-gray-700 dark:text-foreground">
                {EVENT_CREATE_TEXT.fields.reminder}
              </label>
              <select
                name="reminder"
                value={formData.reminder}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition-colors focus:border-green-500 focus:ring-2 focus:ring-green-100 dark:border-input dark:bg-background dark:text-foreground dark:focus:ring-ring/30"
              >
                <option value="">
                  {EVENT_CREATE_TEXT.placeholders.reminder}
                </option>
                {EVENT_CREATE_TEXT.reminderOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm text-gray-700 dark:text-foreground">
                {EVENT_CREATE_TEXT.fields.logo} *
              </label>
              <div
                className={`rounded-lg border-2 border-dashed p-6 text-center ${
                  logoError
                    ? "border-red-400 dark:border-red-500/60"
                    : "border-gray-300 dark:border-border"
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
                <label
                  htmlFor="fileUpload"
                  className="cursor-pointer text-sm text-gray-500 dark:text-muted-foreground"
                >
                  <span className="mb-1 block">
                    {EVENT_CREATE_TEXT.fileUpload.selectOrDrop}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-muted-foreground/80">
                    {EVENT_CREATE_TEXT.fileUpload.supportedFormats}
                  </span>
                </label>
              </div>
              {formData.logo ? (
                <p className="mt-2 text-xs text-gray-500 dark:text-muted-foreground">
                  {getSelectedFileLabel(formData.logo.name)}
                </p>
              ) : null}
              {logoError ? (
                <p className="mt-2 text-xs text-red-500">{logoError}</p>
              ) : null}
              <p className="mt-1 text-xs text-gray-400 dark:text-muted-foreground/80">
                {EVENT_CREATE_TEXT.fileUpload.recommended}
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-6">
              <button
                type="button"
                onClick={() => navigate("/events")}
                className="rounded-lg bg-red-100 px-5 py-2 text-red-600 transition hover:bg-red-200 dark:bg-red-500/15 dark:text-red-200 dark:hover:bg-red-500/25"
              >
                {EVENT_CREATE_TEXT.cancel}
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`rounded-lg px-5 py-2 text-white transition ${
                  loading ? "bg-green-400" : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {loading ? EVENT_CREATE_TEXT.submitting : EVENT_CREATE_TEXT.submit}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateEvents;
