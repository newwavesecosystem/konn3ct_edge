import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { 
  CalendarPlus, 
  UploadCloud, 
  ChevronLeft, 
  Calendar as CalendarIcon, 
  Clock, 
  Globe, 
  MapPin, 
  User, 
  FileText, 
  Tag, 
  DollarSign, 
  Bell 
} from "lucide-react";

import { createPreRegEvent, getRooms } from "../api/eventsApi";
import { useToast } from "../hooks/use-toast";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";

const getTimezones = () =>
  Intl.supportedValuesOf("timeZone").map((timezone) => timezone);
const getRoomFallbackLabel = (id) => `Room ${id}`;

const CreateEvents = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const fileInputRef = useRef(null);

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
      setLogoError(t("events.create.validation.logoRequired", "Please upload an event logo."));
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
        toast({ description: t("events.create.toasts.created", "Event created successfully!") });
        navigate("/events");
      } else {
        toast({
          description:
            response?.message || t("events.create.toasts.createFailed", "Failed to create event."),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating event:", error);
      toast({
        description: t("events.create.toasts.createError", "An unexpected error occurred."),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex-1 p-4 md:p-6 lg:p-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <Card className="w-full rounded-2xl border-border/60 bg-surface shadow-md overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 bg-black/[0.01] p-6 sm:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-green/10 shrink-0">
              <CalendarPlus className="h-6 w-6 text-brand-green" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-foreground">
                {t("events.create.title", "Create New Event")}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t("events.create.description", "Set up your pre-registered event details.")}
              </p>
            </div>
          </div>
          <Button variant="outline" className="h-10 rounded-xl hidden sm:flex" onClick={() => navigate("/events")}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            {t("common.actions.goBack", "Back")}
          </Button>
        </CardHeader>

        <CardContent className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-10">
            
            {/* 1. Basic Details */}
            <section>
              <h3 className="mb-5 text-lg font-bold text-foreground border-b border-border/40 pb-2 flex items-center gap-2">
                <FileText className="h-5 w-5 text-brand-blue" />
                1. Basic Details
              </h3>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="md:col-span-2 space-y-2">
                  <Label className="text-sm font-semibold">{t("events.create.fields.eventTitle", "Event Title")}</Label>
                  <Input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder={t("events.create.placeholders.eventTitle", "e.g. Annual Tech Summit")}
                    className="h-11 rounded-xl bg-black/[0.02] border-border/60 focus-visible:ring-brand-green/30"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {t("events.create.fields.hostName", "Host Name")}
                  </Label>
                  <Input
                    type="text"
                    name="host"
                    value={formData.host}
                    onChange={handleChange}
                    placeholder={t("events.create.placeholders.hostName", "Your Name or Company")}
                    className="h-11 rounded-xl bg-black/[0.02] border-border/60 focus-visible:ring-brand-green/30"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {t("events.create.fields.selectRoom", "Select Room")}
                  </Label>
                  <select
                    name="room"
                    value={formData.room}
                    onChange={handleChange}
                    disabled={roomLoading}
                    className="flex h-11 w-full rounded-xl border border-border/60 bg-black/[0.02] px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-green/30 disabled:cursor-not-allowed disabled:opacity-50"
                    required
                  >
                    <option value="">
                      {roomLoading
                        ? t("events.create.states.loadingRooms", "Loading rooms...")
                        : t("events.create.fields.selectRoom", "Choose a room")}
                    </option>
                    {Array.isArray(rooms) &&
                      rooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.room_name || room.name || room.label || getRoomFallbackLabel(room.id)}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="md:col-span-2 space-y-2">
                  <Label className="text-sm font-semibold">{t("events.create.fields.aboutEvent", "About the Event")}</Label>
                  <Textarea
                    name="about"
                    rows={4}
                    value={formData.about}
                    onChange={handleChange}
                    placeholder={t("events.create.placeholders.aboutEvent", "Describe what your event is about...")}
                    className="rounded-xl bg-black/[0.02] border-border/60 focus-visible:ring-brand-green/30 resize-none"
                    required
                  />
                </div>
              </div>
            </section>

            {/* 2. Scheduling */}
            <section>
              <h3 className="mb-5 text-lg font-bold text-foreground border-b border-border/40 pb-2 flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-brand-green" />
                2. Scheduling
              </h3>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    {t("events.create.fields.eventDate", "Event Date")}
                  </Label>
                  <div className="relative">
                    <input
                      type="date"
                      name="date"
                      value={formData.date}
                      onChange={handleChange}
                      className="w-full h-11 rounded-xl border border-border/60 bg-black/[0.02] px-3 pl-10 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                      required
                    />
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {t("events.create.fields.eventTime", "Event Time")}
                  </Label>
                  <div className="relative">
                    <input
                      type="time"
                      name="time"
                      value={formData.time}
                      onChange={handleChange}
                      className="w-full h-11 rounded-xl border border-border/60 bg-black/[0.02] px-3 pl-10 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                      required
                    />
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    {t("events.create.fields.timeZone", "Timezone")}
                  </Label>
                  <select
                    name="timezone"
                    value={formData.timezone}
                    onChange={handleChange}
                    className="flex h-11 w-full rounded-xl border border-border/60 bg-black/[0.02] px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                    required
                  >
                    <option value="">{t("events.create.placeholders.selectTimezone", "Select Timezone")}</option>
                    {timezones.map((timezone) => (
                      <option key={timezone} value={timezone}>{timezone}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            {/* 3. Ticketing */}
            <section>
              <h3 className="mb-5 text-lg font-bold text-foreground border-b border-border/40 pb-2 flex items-center gap-2">
                <Tag className="h-5 w-5 text-amber-500" />
                3. Ticketing & Reminders
              </h3>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
                
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">{t("events.create.fields.eventType", "Event Type")}</Label>
                  <select
                    name="free"
                    value={formData.free}
                    onChange={handleChange}
                    className="flex h-11 w-full rounded-xl border border-border/60 bg-black/[0.02] px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                  >
                    <option value="1">{t("events.create.eventTypes.free", "Free")}</option>
                    <option value="0">{t("events.create.eventTypes.paid", "Paid")}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">{t("events.create.fields.currency", "Currency")}</Label>
                  <select
                    name="currency"
                    value={formData.currency}
                    onChange={handleChange}
                    disabled={formData.free === "1"}
                    className="flex h-11 w-full rounded-xl border border-border/60 bg-black/[0.02] px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-green/30 disabled:opacity-50"
                  >
                    <option value="NGN">NGN</option>
                    <option value="USD">USD</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    {t("events.create.fields.amount", "Ticket Price")}
                  </Label>
                  <Input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleChange}
                    disabled={formData.free === "1"}
                    placeholder={formData.free === "1" ? "Free" : t("events.create.placeholders.amount", "0.00")}
                    className="h-11 rounded-xl bg-black/[0.02] border-border/60 focus-visible:ring-brand-green/30 disabled:opacity-50"
                    required={formData.free === "0"}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    {t("events.create.fields.setReminder", "Auto-Reminder")}
                  </Label>
                  <select
                    name="reminder"
                    value={formData.reminder}
                    onChange={handleChange}
                    className="flex h-11 w-full rounded-xl border border-border/60 bg-black/[0.02] px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                    required
                  >
                    <option value="">{t("events.create.placeholders.selectReminder", "Select Reminder")}</option>
                    <option value="2">{t("events.create.reminders.twoDays", "2 Days before")}</option>
                    <option value="1">{t("events.create.reminders.oneDay", "1 Day before")}</option>
                    <option value="0.5">{t("events.create.reminders.twelveHours", "12 Hours before")}</option>
                  </select>
                </div>
              </div>
            </section>

            {/* 4. Branding */}
            <section>
              <h3 className="mb-5 text-lg font-bold text-foreground border-b border-border/40 pb-2 flex items-center gap-2">
                <UploadCloud className="h-5 w-5 text-brand-green" />
                4. Branding
              </h3>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">{t("events.create.fields.uploadLogo", "Event Banner / Logo")}</Label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleFileDragOver}
                  onDrop={handleFileDrop}
                  className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 transition-colors ${
                    logoError
                      ? "border-red-400 bg-red-50/50 dark:border-red-500/60 dark:bg-red-500/5"
                      : "border-border/60 bg-black/[0.02] hover:border-brand-green/50 hover:bg-black/[0.04]"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    id="fileUpload"
                    name="logo"
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-background shadow-sm mb-4 group-hover:scale-110 transition-transform">
                    <UploadCloud className="h-6 w-6 text-brand-green" />
                  </div>
                  
                  <span className="mb-1 block text-sm font-semibold text-foreground">
                    {t("events.create.placeholders.selectOrDropFile", "Click to upload or drag and drop")}
                  </span>
                  <span className="text-xs text-muted-foreground text-center">
                    {t("events.create.fileHelp", "SVG, PNG, JPG or PDF (max. 800x400px)")}
                  </span>

                  {formData.logo && (
                    <div className="absolute inset-0 bg-surface/90 backdrop-blur-sm flex flex-col items-center justify-center rounded-2xl p-4">
                      <div className="h-12 w-12 rounded-full bg-brand-green/10 flex items-center justify-center mb-2">
                        <UploadCloud className="h-6 w-6 text-brand-green" />
                      </div>
                      <p className="text-sm font-bold text-foreground truncate max-w-full">
                        {formData.logo.name}
                      </p>
                      <p className="text-xs text-brand-green mt-1 font-medium">Click or drag to replace</p>
                    </div>
                  )}
                </div>
                {logoError && <p className="mt-2 text-xs font-semibold text-red-500">{logoError}</p>}
              </div>
            </section>

            <div className="pt-6 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4">
              <Button 
                variant="ghost" 
                className="hidden sm:flex rounded-xl" 
                onClick={() => navigate("/events")}
                type="button"
              >
                {t("common.actions.cancel", "Cancel")}
              </Button>
              <Button 
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto h-12 px-8 rounded-xl bg-brand-green hover:bg-[#287854] text-white shadow-[0_6px_20px_rgba(32,116,80,0.2)] font-semibold transition-all"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t("events.create.actions.submitting", "Creating...")}
                  </div>
                ) : (
                  <>
                    <CalendarPlus className="mr-2 h-5 w-5" />
                    {t("common.actions.submit", "Create Event")}
                  </>
                )}
              </Button>
            </div>
            
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateEvents;
