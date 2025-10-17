import React from "react";

const EventList = () => {
    const events = [
        {
            id: 1,
            title: "Konn3ct Launch...",
            host: "Odejinni Samuel",
            room: "konn3ct.ng/join/12345",
            date: "2025-09-14",
            time: "05:00:00 PM",
            tz: "WAT +01:0",
        },
        {
            id: 2,
            title: "Konn3ct Seminar...",
            host: "Odejinni Samuel",
            room: "konn3ct.ng/join/67890",
            date: "2025-09-14",
            time: "05:00:00 PM",
            tz: "WAT +01:0",
        },
    ];

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <button
                        className="inline-flex items-center gap-2 bg-[#227451] hover:bg-emerald-700 text-white text-sm font-medium px-7 py-1 rounded-full"
                        aria-label="Create"
                    >
                        <span className="text-lg">+</span>
                        <span className="leading-none">Create</span>
                    </button>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#eef6ff] flex items-center justify-center">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12.5159 7.86104L12.9558 8.74825C13.0158 8.87175 13.1758 8.99017 13.3108 9.01284L14.1082 9.14642C14.6181 9.23217 14.7381 9.60517 14.3706 9.97309L13.7507 10.5982C13.6457 10.704 13.5882 10.9082 13.6207 11.0543L13.7982 11.8281C13.9382 12.4406 13.6157 12.6775 13.0783 12.3574L12.3309 11.9113C12.1959 11.8307 11.9735 11.8307 11.836 11.9113L11.0886 12.3574C10.5536 12.6775 10.2286 12.4381 10.3686 11.8281L10.5461 11.0543C10.5786 10.9082 10.5211 10.704 10.4161 10.5982L9.79622 9.97309C9.43122 9.60517 9.54872 9.23217 10.0586 9.14642L10.8561 9.01284C10.9886 8.99017 11.1486 8.87175 11.2086 8.74825L11.6485 7.86104C11.8885 7.37965 12.2784 7.37965 12.5159 7.86104Z" stroke="#2D8CFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                                <path d="M6.66602 14.167V17.0837" stroke="#2D8CFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                                <path d="M6.66602 2.91699V5.83366" stroke="#2D8CFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                                <path d="M18.3323 7.39945C18.2766 6.11438 18.1203 5.27781 17.6826 4.61603C17.4308 4.23529 17.118 3.90415 16.7583 3.63756C15.7863 2.91699 14.4148 2.91699 11.6722 2.91699H8.32654C5.58382 2.91699 4.21245 2.91699 3.24035 3.63756C2.88071 3.90415 2.56789 4.23529 2.31606 4.61603C1.87839 5.27773 1.72214 6.1142 1.66636 7.39902C1.65682 7.61873 1.84607 7.78678 2.05343 7.78678C3.20825 7.78678 4.14441 8.77783 4.14441 10.0003C4.14441 11.2228 3.20825 12.2138 2.05343 12.2138C1.84607 12.2138 1.65682 12.3819 1.66636 12.6017C1.72214 13.8865 1.87839 14.7229 2.31606 15.3847C2.56789 15.7653 2.88071 16.0965 3.24035 16.3631C4.21245 17.0837 5.58382 17.0837 8.32655 17.0837H11.6722C14.4148 17.0837 15.7863 17.0837 16.7583 16.3631C17.118 16.0965 17.4308 15.7653 17.6826 15.3847C18.1203 14.7228 18.2766 13.8862 18.3323 12.6012V7.39945Z" stroke="#2D8CFF" stroke-width="1.5" stroke-linejoin="round" />
                            </svg>

                        </div>
                        <div className="text-right">
                            <div className="text-sm font-semibold text-gray-800 leading-none">2</div>
                            <div className="text-[11px] text-gray-400">TOTAL EVENTS</div>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="w-px h-8 bg-gray-200" />

                    {/* Total Participants */}
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#ecfdf5] flex items-center justify-center">
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
                        <div className="text-right">
                            <div className="text-sm font-semibold text-gray-800 leading-none">350</div>
                            <div className="text-[11px] text-gray-400">TOTAL PARTICIPANTS</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table header */}
            <div className="overflow-x-auto">
                <table className="w-full" cellPadding="0" cellSpacing="0">
                    <thead>
                        <tr className="text-left text-xs text-gray-500 border-t border-b border-gray-100">
                            <th className="py-3 px-4 font-medium">TITLE</th>
                            <th className="py-3 px-4 font-medium">HOST</th>
                            <th className="py-3 px-4 font-medium">ROOM</th>
                            <th className="py-3 px-4 font-medium">DATE</th>
                            <th className="py-3 px-4 font-medium">TIME</th>
                            <th className="py-3 px-4 font-medium">TIME ZONE</th>
                            <th className="py-3 px-4 font-medium text-right">ACTION</th>
                        </tr>
                    </thead>

                    <tbody>
                        {events.map((ev, idx) => (
                            <tr key={ev.id} className={`${idx !== events.length - 1 ? "border-b border-gray-100" : ""}`}>
                                <td className="py-4 px-4 text-sm text-gray-700 w-[22%]">{ev.title}</td>
                                <td className="py-4 px-4 text-sm text-gray-700 w-[18%]">{ev.host}</td>
                                <td className="py-4 px-4 text-sm text-blue-600 underline w-[18%] cursor-pointer">{ev.room}</td>
                                <td className="py-4 px-4 text-sm text-gray-700 w-[10%]">{ev.date}</td>
                                <td className="py-4 px-4 text-sm text-gray-700 w-[10%]">{ev.time}</td>
                                <td className="py-4 px-4 text-sm text-gray-700 w-[10%]">{ev.tz}</td>
                                <td className="py-4 px-4 text-right w-[12%]">
                                    <button className="inline-block bg-[#227451] text-white text-xs font-medium px-4 py-1.5 rounded-full hover:bg-emerald-800">
                                        Participants
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Empty space like screenshot (makes the table area tall) */}
                <div className="h-40" />
            </div>

            {/* Pagination centered */}
            <div className="flex justify-center items-center py-4">
                <button className="text-gray-400 px-3 text-lg">‹</button>
                <div className="text-sm text-gray-600 mx-2">1/5</div>
                <button className="text-gray-400 px-3 text-lg">›</button>
            </div>
        </div>
    );
};

export default EventList;
