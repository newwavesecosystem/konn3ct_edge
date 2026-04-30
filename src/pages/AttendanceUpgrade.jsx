import React, { useState } from "react";
import { MessageCircle, Mic, Video, Wifi } from "lucide-react";
import { useTranslation } from "react-i18next";

const users = [
  {
    name: "Odejimni Samuel",
    initials: "OD",
    time: "Oct 2, 05:35:47 PM",
    online: "00:06:43",
    talk: "00:00:04",
    webcam: "00:06:17",
    messages: 3,
    reaction: "\u{1F605}",
    raise: 4,
  },
  {
    name: "Akanji Joseph",
    initials: "AJ",
    time: "Oct 2, 05:50:00 PM",
    online: "00:06:43",
    talk: "00:00:04",
    webcam: "00:06:17",
    messages: 3,
    reaction: "\u{1F605}",
    raise: 2,
  },
  {
    name: "Debbie Williams",
    initials: "DW",
    time: "Oct 2, 05:35:47 PM",
    online: "00:02:43",
    talk: "00:01:14",
    webcam: "00:01:17",
    messages: 8,
    reaction: "\u{1F605}",
    raise: 2,
  },
  {
    name: "Name Name",
    initials: "NN",
    time: "Oct 2, 05:35:47 PM",
    online: "00:02:43",
    talk: "00:01:14",
    webcam: "00:01:17",
    messages: 8,
    reaction: "\u{1F605}",
    raise: 2,
  },
  {
    name: "Name Name",
    initials: "NN",
    time: "Oct 2, 05:35:47 PM",
    online: "00:02:43",
    talk: "00:01:14",
    webcam: "00:01:17",
    messages: 8,
    reaction: "\u{1F605}",
    raise: 2,
  },
  {
    name: "Name Name",
    initials: "NN",
    time: "Oct 2, 05:35:47 PM",
    online: "00:02:43",
    talk: "00:01:14",
    webcam: "00:01:17",
    messages: 8,
    reaction: "\u{1F605}",
    raise: 2,
  },
];

const stats = [
  {
    titleKey: "attendance.upgrade.stats.activeUser",
    value: 3,
    color:
      "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200",
  },
  {
    titleKey: "attendance.upgrade.stats.activityScore",
    value: 2,
    color:
      "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-200",
  },
  {
    titleKey: "attendance.upgrade.stats.timeline",
    value: 0,
    color:
      "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200",
  },
  {
    titleKey: "attendance.upgrade.stats.polls",
    value: 1,
    color:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-200",
  },
  {
    titleKey: "attendance.upgrade.stats.donation",
    value: 0,
    color:
      "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-200",
  },
];

export default function AttendanceUpgrade() {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 4;
  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paginatedUsers = users.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <div className="flex min-h-screen flex-col items-center px-2 py-6">
      <div className="w-full max-w-6xl rounded-2xl bg-white p-4 shadow dark:border dark:border-border dark:bg-card">
        <h2 className="mb-4 text-sm font-semibold">
          {t("attendance.upgrade.roomTitle", { room: "Odejimni Samuel" })}
        </h2>

        <div className="mb-6 flex flex-wrap gap-2">
          {stats.map((item) => (
            <div
              key={item.titleKey}
              className={`flex min-w-[120px] flex-1 flex-col items-center justify-center rounded-lg p-2 ${item.color}`}
            >
              <p className="text-lg font-semibold">{item.value}</p>
              <p className="text-xs font-medium">{t(item.titleKey)}</p>
            </div>
          ))}
        </div>

        <h3 className="mb-2 text-sm font-semibold">
          {t("attendance.upgrade.overview")}
        </h3>

        <div className="md:overflow-x-auto lg:overflow-visible">
          <div className="md:min-w-[720px] lg:min-w-0">
            <div className="mb-2 grid grid-cols-7 border-b pb-1 text-xs font-semibold text-gray-600 dark:border-border dark:text-muted-foreground">
              <p>{t("attendance.upgrade.table.user")}</p>
              <p>{t("attendance.upgrade.table.online")}</p>
              <p>{t("attendance.upgrade.table.talk")}</p>
              <p>{t("attendance.upgrade.table.webcam")}</p>
              <p>{t("attendance.upgrade.table.messages")}</p>
              <p>{t("attendance.upgrade.table.reactions")}</p>
              <p>{t("attendance.upgrade.table.raise")}</p>
            </div>

            <div className="space-y-2">
              {paginatedUsers.map((user, index) => (
                <div
                  key={`${user.name}-${pageStart + index}`}
                  className="grid grid-cols-7 items-center rounded-lg bg-white p-2 shadow-sm transition hover:shadow-md dark:border dark:border-border dark:bg-background"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[10px] font-medium text-gray-700 dark:bg-muted dark:text-foreground">
                      {user.initials}
                    </div>
                    <div className="leading-tight">
                      <p className="text-xs font-medium">{user.name}</p>
                      <p className="text-[10px] text-gray-500 dark:text-muted-foreground">
                        {user.time}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-gray-700 dark:text-muted-foreground">
                    <Wifi size={12} /> {user.online}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-700 dark:text-muted-foreground">
                    <Mic size={12} /> {user.talk}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-700 dark:text-muted-foreground">
                    <Video size={12} /> {user.webcam}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-700 dark:text-muted-foreground">
                    <MessageCircle size={12} /> {user.messages}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-700 dark:text-muted-foreground">
                    <span>{user.reaction}</span>
                    <span>{user.reaction === "\u{1F605}" ? 1 : 0}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-700 dark:text-muted-foreground">
                    <span>{"\u{1F525}"}</span> {user.raise}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-muted-foreground">
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1}
            aria-label={t("components.pagination.previousAriaLabel")}
            className="rounded-l-md border px-2 py-1 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border dark:bg-background dark:hover:bg-accent"
          >
            &lt;
          </button>
          <span className="px-3">
            {currentPage}/{totalPages}
          </span>
          <button
            type="button"
            onClick={() =>
              setCurrentPage((page) => Math.min(totalPages, page + 1))
            }
            disabled={currentPage === totalPages}
            aria-label={t("components.pagination.nextAriaLabel")}
            className="rounded-r-md border px-2 py-1 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border dark:bg-background dark:hover:bg-accent"
          >
            &gt;
          </button>
        </div>
      </div>
    </div>
  );
}
