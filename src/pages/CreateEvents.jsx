import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { createPreRegEvent, getRooms } from "../api/eventsApi";
import { useToast } from "../hooks/use-toast";

const getTimezones = () => {
  return Intl.supportedValuesOf("timeZone").map((tz) => tz);
};

const CreateEvents = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const defaultReminderOptions = [
    { value: "2", label: t("events.create.reminder.twoDays") },
    { value: "1", label: t("events.create.reminder.oneDay") },
    { value: "0.5", label: t("events.create.reminder.twelveHours") },
  ];
  const rawReminderOptions = t("events.create.reminderOptions", {
    returnObjects: true,
    defaultValue: defaultReminderOptions,
  });
  const reminderOptions = Array.isArray(rawReminderOptions)
    ? rawReminderOptions
    : defaultReminderOptions;

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
      setLogoError(t("events.create.logoRequired"));
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
        toast({ description: t("events.create.success") });
        navigate("/events");
      } else {
        toast({
          description: res?.message || t("events.create.failure"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating event:", error);
      toast({
        description: t("events.create.failureRetry"),
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
              {t("events.create.title")}
            </h2>
            <p className="text-sm text-gray-500 dark:text-muted-foreground">
              {t("events.create.description")}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-6">
          <div className="max-w-5xl">
            <div>
              <label className="mb-1 block text-sm text-gray-700 dark:text-foreground">
                {t("events.create.fields.title")}
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder={t("events.create.placeholders.title")}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition-colors focus:border-green-500 focus:ring-2 focus:ring-green-100 dark:border-input dark:bg-background dark:text-foreground dark:placeholder:text-muted-foreground dark:focus:ring-ring/30"
              />
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm text-gray-700 dark:text-foreground">
                {t("events.create.fields.host")}
              </label>
              <input
                type="text"
                name="host"
                value={formData.host}
                onChange={handleChange}
                placeholder={t("events.create.placeholders.host")}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition-colors focus:border-green-500 focus:ring-2 focus:ring-green-100 dark:border-input dark:bg-background dark:text-foreground dark:placeholder:text-muted-foreground dark:focus:ring-ring/30"
              />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-gray-700 dark:text-foreground">
                  {t("events.create.fields.room")}
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
                      ? t("events.create.loadingRooms")
                      : t("events.create.placeholders.room")}
                  </option>
                  {Array.isArray(rooms) &&
                    rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.room_name ||
                          room.name ||
                          room.label ||
                          t("events.create.roomFallback", { id: room.id })}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-700 dark:text-foreground">
                  {t("events.create.fields.date")}
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
                  {t("events.create.fields.time")}
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
                    {t("events.create.fields.type")}
                  </label>
                  <select
                    name="free"
                    value={formData.free}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm transition-colors dark:border-input dark:bg-background dark:text-foreground"
                  >
                    <option value="1">{t("events.create.typeOptions.free")}</option>
                    <option value="0">{t("events.create.typeOptions.paid")}</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-700 dark:text-foreground">
                    {t("events.create.fields.currency")}
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
                    {t("events.create.fields.amount")}
                  </label>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleChange}
                    disabled={formData.free === "1"}
                    placeholder={t("events.create.placeholders.amount")}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm transition-colors dark:border-input dark:bg-background dark:text-foreground dark:placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-700 dark:text-foreground">
                  {t("events.create.fields.timezone")}
                </label>
                <select
                  name="timezone"
                  value={formData.timezone}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition-colors focus:border-green-500 focus:ring-2 focus:ring-green-100 dark:border-input dark:bg-background dark:text-foreground dark:focus:ring-ring/30"
                >
                  <option value="">
                    {t("events.create.placeholders.timezone")}
                  </option>
                  {timezones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm text-gray-700 dark:text-foreground">
                {t("events.create.fields.about")}
              </label>
              <textarea
                name="about"
                rows="4"
                value={formData.about}
                onChange={handleChange}
                placeholder={t("events.create.placeholders.about")}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition-colors focus:border-green-500 focus:ring-2 focus:ring-green-100 dark:border-input dark:bg-background dark:text-foreground dark:placeholder:text-muted-foreground dark:focus:ring-ring/30"
              />
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm text-gray-700 dark:text-foreground">
                {t("events.create.fields.reminder")}
              </label>
              <select
                name="reminder"
                value={formData.reminder}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition-colors focus:border-green-500 focus:ring-2 focus:ring-green-100 dark:border-input dark:bg-background dark:text-foreground dark:focus:ring-ring/30"
              >
                <option value="">{t("events.create.placeholders.reminder")}</option>
                {reminderOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm text-gray-700 dark:text-foreground">
                {t("events.create.fields.logo")} *
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
                    {t("events.create.fileUpload.selectOrDrop")}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-muted-foreground/80">
                    {t("events.create.fileUpload.supportedFormats")}
                  </span>
                </label>
              </div>
              {formData.logo ? (
                <p className="mt-2 text-xs text-gray-500 dark:text-muted-foreground">
                  {t("events.create.fileUpload.selectedFile", {
                    name: formData.logo.name,
                  })}
                </p>
              ) : null}
              {logoError ? (
                <p className="mt-2 text-xs text-red-500">{logoError}</p>
              ) : null}
              <p className="mt-1 text-xs text-gray-400 dark:text-muted-foreground/80">
                {t("events.create.fileUpload.recommended")}
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-6">
              <button
                type="button"
                onClick={() => navigate("/events")}
                className="rounded-lg bg-red-100 px-5 py-2 text-red-600 transition hover:bg-red-200 dark:bg-red-500/15 dark:text-red-200 dark:hover:bg-red-500/25"
              >
                {t("actions.cancel")}
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`rounded-lg px-5 py-2 text-white transition ${
                  loading ? "bg-green-400" : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {loading ? t("events.create.submitting") : t("actions.submit")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateEvents;
