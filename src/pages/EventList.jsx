import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPreRegList, getPreRegSummary } from "../api/eventsApi";
import { useToast } from "../hooks/use-toast";

const EventList = () => {
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState({ totalEvents: 0, totalParticipants: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();
  const { toast } = useToast();
  const PAGE_SIZE = 4;

  const fetchData = async () => {
    try {
      const [listRes, summaryRes] = await Promise.all([
        getPreRegList(),
        getPreRegSummary(),
      ]);

      const eventList = Array.isArray(listRes)
        ? listRes
        : listRes?.data?.data || [];

      setEvents(eventList);

      // Use backend keys directly
      setSummary({
        totalEvents: summaryRes?.events || 0,
        totalParticipants: summaryRes?.participants || 0,
      });
    } catch (err) {
      console.error("Error fetching events:", err);
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
    if (!url) return;
    navigator.clipboard.writeText(url);
    toast({ description: "Event link copied!" });
  };

  return (
    <div className="flex justify-center items-start w-full px-2 py-4 mt-5 md:p-6 md:mt-7">
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4 md:p-6 w-full max-w-5xl">
        {/* Header Section */}
        <div className="flex flex-col items-start gap-4 mb-6 md:flex-row md:items-center md:justify-between">
          <button
            onClick={() => navigate("/events/create")}
            className="mt-2 md:mt-0 inline-flex w-full md:w-auto items-center justify-center gap-2 bg-[#227451] hover:bg-emerald-700 text-white text-sm font-medium px-6 py-2 rounded-full transition-all"
          >
            <span className="text-lg">+</span>
            <span className="leading-none">Create</span>
          </button>

          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center md:gap-6">
            {/* Total Events */}
            <div className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2 md:border-0 md:p-0 md:justify-start md:gap-3">
              <div className="w-9 h-9 rounded-full bg-[#eef6ff] flex items-center justify-center">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="20" cy="20" r="20" fill="#E8F1FF" />
                  <path d="M23.0159 17.861L23.4558 18.7483C23.5158 18.8718 23.6758 18.9902 23.8108 19.0128L24.6082 19.1464C25.1181 19.2322 25.2381 19.6052 24.8706 19.9731L24.2507 20.5982C24.1457 20.704 24.0882 20.9082 24.1207 21.0543L24.2982 21.8281C24.4382 22.4406 24.1157 22.6775 23.5783 22.3574L22.8309 21.9113C22.6959 21.8307 22.4735 21.8307 22.336 21.9113L21.5886 22.3574C21.0536 22.6775 20.7286 22.4381 20.8686 21.8281L21.0461 21.0543C21.0786 20.9082 21.0211 20.704 20.9161 20.5982L20.2962 19.9731C19.9312 19.6052 20.0487 19.2322 20.5586 19.1464L21.3561 19.0128C21.4886 18.9902 21.6486 18.8718 21.7086 18.7483L22.1485 17.861C22.3885 17.3797 22.7784 17.3797 23.0159 17.861Z" stroke="#2D8CFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M17.166 24.167V27.0837" stroke="#2D8CFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M17.166 12.917V15.8337" stroke="#2D8CFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M28.8323 17.3995C28.7766 16.1144 28.6203 15.2778 28.1826 14.616C27.9308 14.2353 27.618 13.9042 27.2583 13.6376C26.2863 12.917 24.9148 12.917 22.1722 12.917H18.8265C16.0838 12.917 14.7125 12.917 13.7404 13.6376C13.3807 13.9042 13.0679 14.2353 12.8161 14.616C12.3784 15.2777 12.2221 16.1142 12.1664 17.399C12.1568 17.6187 12.3461 17.7868 12.5534 17.7868C13.7082 17.7868 14.6444 18.7778 14.6444 20.0003C14.6444 21.2228 13.7082 22.2138 12.5534 22.2138C12.3461 22.2138 12.1568 22.3819 12.1664 22.6017C12.2221 23.8865 12.3784 24.7229 12.8161 25.3847C13.0679 25.7653 13.3807 26.0965 13.7404 26.3631C14.7125 27.0837 16.0838 27.0837 18.8266 27.0837H22.1722C24.9148 27.0837 26.2863 27.0837 27.2583 26.3631C27.618 26.0965 27.9308 25.7653 28.1826 25.3847C28.6203 24.7228 28.7766 23.8862 28.8323 22.6012V17.3995Z" stroke="#2D8CFF" stroke-width="1.5" stroke-linejoin="round" />
                </svg>

              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 leading-none">
                  {summary.totalEvents}
                </p>
                <p className="text-[11px] text-gray-400 uppercase tracking-wide">
                  Total Events
                </p>
              </div>
            </div>

            <div className="hidden w-px h-8 bg-gray-200 md:block" />

            {/* Total Participants */}
            <div className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2 md:border-0 md:p-0 md:justify-start md:gap-3">
              <div className="w-9 h-9 rounded-full bg-[#ecfdf5] flex items-center justify-center">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="20" cy="20" r="20" fill="#D8FFEE" />
                  <path d="M22.9173 19.1667C22.9173 17.5558 21.6115 16.25 20.0007 16.25C18.3898 16.25 17.084 17.5558 17.084 19.1667C17.084 20.7775 18.3898 22.0833 20.0007 22.0833C21.6115 22.0833 22.9173 20.7775 22.9173 19.1667Z" stroke="#36B37E" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M22.9022 19.4583C23.1705 19.5396 23.4551 19.5833 23.7499 19.5833C25.3607 19.5833 26.6666 18.2775 26.6666 16.6667C26.6666 15.0558 25.3607 13.75 23.7499 13.75C22.2375 13.75 20.9939 14.9012 20.8477 16.3751" stroke="#36B37E" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M19.1529 16.3751C19.0067 14.9012 17.7631 13.75 16.2507 13.75C14.6398 13.75 13.334 15.0558 13.334 16.6667C13.334 18.2775 14.6398 19.5833 16.2507 19.5833C16.5455 19.5833 16.8301 19.5396 17.0984 19.4583" stroke="#36B37E" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M28.3333 23.7497C28.3333 21.4485 26.2813 19.583 23.75 19.583" stroke="#36B37E" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M24.5827 26.2497C24.5827 23.9485 22.5307 22.083 19.9993 22.083C17.468 22.083 15.416 23.9485 15.416 26.2497" stroke="#36B37E" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M16.2493 19.583C13.718 19.583 11.666 21.4485 11.666 23.7497" stroke="#36B37E" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
                </svg>

              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 leading-none">
                  {summary.totalParticipants}
                </p>
                <p className="text-[11px] text-gray-400 uppercase tracking-wide">
                  Total Participants
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="overflow-x-auto">
          <table className="min-w-[900px] md:min-w-full border border-gray-100 rounded-xl overflow-hidden">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Title</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Host</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Room</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Date</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Time</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Time Zone</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="text-sm text-gray-700">
              {events.length > 0 ? (
                paginatedEvents.map((ev, index) => (
                  <tr
                    key={ev.id || index}
                    className={`border-t hover:bg-gray-50 transition ${(pageStart + index) % 2 === 0 ? "bg-white" : "bg-gray-50"
                      }`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">{ev.title || "Untitled"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {ev.host_name ||
                        `${ev.owner?.firstname || ""} ${ev.owner?.lastname || ""}`.trim() ||
                        "N/A"}
                    </td>
                    <td className="px-4 py-3 text-blue-600 underline cursor-pointer whitespace-nowrap">
                      {ev.room?.name || "No Room"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{ev.date || "-"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{ev.time || "-"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{ev.timezone || "-"}</td>
                    <td className="px-4 py-3 text-right flex flex-col gap-2 items-end">
                      <button
                        onClick={() => navigate(`/events/participants/${ev.reference}`)}
                        className="bg-[#227451] text-white text-xs font-medium px-4 py-1.5 rounded-full hover:bg-emerald-800 transition whitespace-nowrap"
                      >
                        Participants
                      </button>

                      {/* NEW COPY BUTTON */}
                      <button
                        onClick={() => copyEventUrl(ev.event_url)}
                        className="border border-gray-300 text-gray-700 text-xs font-medium px-4 py-1.5 rounded-full hover:bg-gray-100 transition whitespace-nowrap"
                      >
                        Event Link
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-6 text-gray-500">
                    No events found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-center mt-4 text-xs text-gray-500">
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1}
            className={`border border-gray-300 rounded-md px-2 py-1 ${
              currentPage === 1 ? "cursor-not-allowed opacity-50" : "hover:bg-gray-100"
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
            className={`border border-gray-300 rounded-md px-2 py-1 ${
              currentPage === totalPages
                ? "cursor-not-allowed opacity-50"
                : "hover:bg-gray-100"
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
