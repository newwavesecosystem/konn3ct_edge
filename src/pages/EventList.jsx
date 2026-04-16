import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getPreRegList, getPreRegSummary } from "../api/eventsApi";
import { useToast } from "../hooks/use-toast";

const EVENT_LIST_TEXT = {
  create: "Create",
  totalEvents: "Total Events",
  totalParticipants: "Total Participants",
  copyEventLinkSuccess: "Event link copied!",
  untitled: "Untitled",
  notAvailable: "N/A",
  noRoom: "No Room",
  participantsButton: "Participants",
  eventLinkButton: "Event Link",
  noEvents: "No events found.",
  columns: {
    title: "Title",
    host: "Host",
    room: "Room",
    date: "Date",
    time: "Time",
    timezone: "Time Zone",
    action: "Action",
  },
};

const EventList = () => {
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState({
    totalEvents: 0,
    totalParticipants: 0,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();
  const { toast } = useToast();
  const PAGE_SIZE = 4;

  const fetchData = async () => {
    try {
      const [listResponse, summaryResponse] = await Promise.all([
        getPreRegList(),
        getPreRegSummary(),
      ]);

      const eventList = Array.isArray(listResponse)
        ? listResponse
        : listResponse?.data?.data || [];

      setEvents(eventList);
      setSummary({
        totalEvents: summaryResponse?.events || 0,
        totalParticipants: summaryResponse?.participants || 0,
      });
    } catch (error) {
      console.error("Error fetching events:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalPages = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paginatedEvents = events.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const copyEventUrl = (url) => {
    if (!url) {
      return;
    }

    navigator.clipboard.writeText(url);
    toast({ description: EVENT_LIST_TEXT.copyEventLinkSuccess });
  };

  return (
    <div className="mt-5 flex w-full items-start justify-center px-2 py-4 md:mt-6 md:px-4 md:py-5 lg:mt-7 lg:p-6">
      <div className="w-full max-w-5xl rounded-2xl border border-gray-100 bg-white p-4 shadow-md dark:border-border dark:bg-card md:p-5 lg:p-6">
        <div className="mb-6 flex flex-col items-start gap-4 lg:flex-row lg:items-center lg:justify-between">
          <button
            onClick={() => navigate("/events/create")}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#227451] px-6 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-700 lg:mt-0 lg:w-auto"
          >
            <span className="text-lg">+</span>
            <span className="leading-none">{EVENT_LIST_TEXT.create}</span>
          </button>

          <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:items-center lg:gap-6">
            <div className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2 dark:border-border lg:justify-start lg:gap-3 lg:border-0 lg:p-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef6ff] dark:bg-blue-500/15">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 40 40"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="20" cy="20" r="20" fill="#E8F1FF" />
                  <path
                    d="M23.0159 17.861L23.4558 18.7483C23.5158 18.8718 23.6758 18.9902 23.8108 19.0128L24.6082 19.1464C25.1181 19.2322 25.2381 19.6052 24.8706 19.9731L24.2507 20.5982C24.1457 20.704 24.0882 20.9082 24.1207 21.0543L24.2982 21.8281C24.4382 22.4406 24.1157 22.6775 23.5783 22.3574L22.8309 21.9113C22.6959 21.8307 22.4735 21.8307 22.336 21.9113L21.5886 22.3574C21.0536 22.6775 20.7286 22.4381 20.8686 21.8281L21.0461 21.0543C21.0786 20.9082 21.0211 20.704 20.9161 20.5982L20.2962 19.9731C19.9312 19.6052 20.0487 19.2322 20.5586 19.1464L21.3561 19.0128C21.4886 18.9902 21.6486 18.8718 21.7086 18.7483L22.1485 17.861C22.3885 17.3797 22.7784 17.3797 23.0159 17.861Z"
                    stroke="#2D8CFF"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M17.166 24.167V27.0837"
                    stroke="#2D8CFF"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M17.166 12.917V15.8337"
                    stroke="#2D8CFF"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M28.8323 17.3995C28.7766 16.1144 28.6203 15.2778 28.1826 14.616C27.9308 14.2353 27.618 13.9042 27.2583 13.6376C26.2863 12.917 24.9148 12.917 22.1722 12.917H18.8265C16.0838 12.917 14.7125 12.917 13.7404 13.6376C13.3807 13.9042 13.0679 14.2353 12.8161 14.616C12.3784 15.2777 12.2221 16.1142 12.1664 17.399C12.1568 17.6187 12.3461 17.7868 12.5534 17.7868C13.7082 17.7868 14.6444 18.7778 14.6444 20.0003C14.6444 21.2228 13.7082 22.2138 12.5534 22.2138C12.3461 22.2138 12.1568 22.3819 12.1664 22.6017C12.2221 23.8865 12.3784 24.7229 12.8161 25.3847C13.0679 25.7653 13.3807 26.0965 13.7404 26.3631C14.7125 27.0837 16.0838 27.0837 18.8266 27.0837H22.1722C24.9148 27.0837 26.2863 27.0837 27.2583 26.3631C27.618 26.0965 27.9308 25.7653 28.1826 25.3847C28.6203 24.7228 28.7766 23.8862 28.8323 22.6012V17.3995Z"
                    stroke="#2D8CFF"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold leading-none text-gray-800 dark:text-foreground">
                  {summary.totalEvents}
                </p>
                <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-muted-foreground">
                  {EVENT_LIST_TEXT.totalEvents}
                </p>
              </div>
            </div>

            <div className="hidden h-8 w-px bg-gray-200 dark:bg-border lg:block" />

            <div className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2 dark:border-border lg:justify-start lg:gap-3 lg:border-0 lg:p-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ecfdf5] dark:bg-emerald-500/15">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 40 40"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="20" cy="20" r="20" fill="#D8FFEE" />
                  <path
                    d="M22.9173 19.1667C22.9173 17.5558 21.6115 16.25 20.0007 16.25C18.3898 16.25 17.084 17.5558 17.084 19.1667C17.084 20.7775 18.3898 22.0833 20.0007 22.0833C21.6115 22.0833 22.9173 20.7775 22.9173 19.1667Z"
                    stroke="#36B37E"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M22.9022 19.4583C23.1705 19.5396 23.4551 19.5833 23.7499 19.5833C25.3607 19.5833 26.6666 18.2775 26.6666 16.6667C26.6666 15.0558 25.3607 13.75 23.7499 13.75C22.2375 13.75 20.9939 14.9012 20.8477 16.3751"
                    stroke="#36B37E"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M19.1529 16.3751C19.0067 14.9012 17.7631 13.75 16.2507 13.75C14.6398 13.75 13.334 15.0558 13.334 16.6667C13.334 18.2775 14.6398 19.5833 16.2507 19.5833C16.5455 19.5833 16.8301 19.5396 17.0984 19.4583"
                    stroke="#36B37E"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M28.3333 23.7497C28.3333 21.4485 26.2813 19.583 23.75 19.583"
                    stroke="#36B37E"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M24.5827 26.2497C24.5827 23.9485 22.5307 22.083 19.9993 22.083C17.468 22.083 15.416 23.9485 15.416 26.2497"
                    stroke="#36B37E"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M16.2493 19.583C13.718 19.583 11.666 21.4485 11.666 23.7497"
                    stroke="#36B37E"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold leading-none text-gray-800 dark:text-foreground">
                  {summary.totalParticipants}
                </p>
                <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-muted-foreground">
                  {EVENT_LIST_TEXT.totalParticipants}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[900px] overflow-hidden rounded-xl border border-gray-100 dark:border-border lg:min-w-full">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600 dark:bg-muted/70 dark:text-muted-foreground">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">
                  {EVENT_LIST_TEXT.columns.title}
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">
                  {EVENT_LIST_TEXT.columns.host}
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">
                  {EVENT_LIST_TEXT.columns.room}
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">
                  {EVENT_LIST_TEXT.columns.date}
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">
                  {EVENT_LIST_TEXT.columns.time}
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">
                  {EVENT_LIST_TEXT.columns.timezone}
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">
                  {EVENT_LIST_TEXT.columns.action}
                </th>
              </tr>
            </thead>
            <tbody className="text-sm text-gray-700 dark:text-foreground">
              {events.length > 0 ? (
                paginatedEvents.map((event, index) => (
                  <tr
                    key={event.id || index}
                    className={`border-t transition dark:border-border dark:hover:bg-muted/60 ${
                      (pageStart + index) % 2 === 0
                        ? "bg-white dark:bg-background/30"
                        : "bg-gray-50 dark:bg-muted/40"
                    }`}
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      {event.title || EVENT_LIST_TEXT.untitled}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {event.host_name ||
                        `${event.owner?.firstname || ""} ${event.owner?.lastname || ""}`.trim() ||
                        EVENT_LIST_TEXT.notAvailable}
                    </td>
                    <td className="cursor-pointer whitespace-nowrap px-4 py-3 text-blue-600 underline">
                      {event.room?.name || EVENT_LIST_TEXT.noRoom}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {event.date || "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {event.time || "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {event.timezone || "-"}
                    </td>
                    <td className="flex flex-col items-end gap-2 px-4 py-3 text-right">
                      <button
                        onClick={() =>
                          navigate(`/events/participants/${event.reference}`)
                        }
                        className="whitespace-nowrap rounded-full bg-[#227451] px-4 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-800"
                      >
                        {EVENT_LIST_TEXT.participantsButton}
                      </button>

                      <button
                        onClick={() => copyEventUrl(event.event_url)}
                        className="whitespace-nowrap rounded-full border border-gray-300 px-4 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-100 dark:border-border dark:bg-background dark:text-muted-foreground dark:hover:bg-accent dark:hover:text-accent-foreground"
                      >
                        {EVENT_LIST_TEXT.eventLinkButton}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="7"
                    className="py-6 text-center text-gray-500 dark:text-muted-foreground"
                  >
                    {EVENT_LIST_TEXT.noEvents}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-center text-xs text-gray-500 dark:text-muted-foreground">
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1}
            className={`rounded-md border border-gray-300 px-2 py-1 dark:border-border dark:bg-background ${
              currentPage === 1
                ? "cursor-not-allowed opacity-50"
                : "hover:bg-gray-100 dark:hover:bg-accent dark:hover:text-accent-foreground"
            }`}
          >
            &lt;
          </button>
          <span className="mx-2">
            {currentPage}/{totalPages}
          </span>
          <button
            type="button"
            onClick={() =>
              setCurrentPage((page) => Math.min(totalPages, page + 1))
            }
            disabled={currentPage === totalPages}
            className={`rounded-md border border-gray-300 px-2 py-1 dark:border-border dark:bg-background ${
              currentPage === totalPages
                ? "cursor-not-allowed opacity-50"
                : "hover:bg-gray-100 dark:hover:bg-accent dark:hover:text-accent-foreground"
            }`}
          >
            &gt;
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventList;
