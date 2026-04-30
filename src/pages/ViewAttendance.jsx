import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  getAttendanceDetails,
  getMeetingSummary,
  getMeetingHighlights,
  getMeetingMinutes,
} from "../api/attendanceApi";
import { ArrowLeft } from "lucide-react";
import { useToast } from "../hooks/use-toast";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "../components/ui/pagination";

const NAVBAR_HEIGHT = 72;

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function rowsToTSV(headers, rows) {
  const headerLine = headers.join("\t");
  const lines = rows.map((row) =>
    headers.map((header) => row[header] ?? "").join("\t")
  );
  return [headerLine, ...lines].join("\n");
}

function rowsToCSV(headers, rows) {
  const escapeValue = (value) => {
    const stringValue = String(value ?? "");
    const needsQuotes = /[",\n\r]/.test(stringValue);
    const safeValue = stringValue.replaceAll('"', '""');
    return needsQuotes ? `"${safeValue}"` : safeValue;
  };

  const headerLine = headers.map(escapeValue).join(",");
  const lines = rows.map((row) =>
    headers.map((header) => escapeValue(row[header])).join(",")
  );

  return [headerLine, ...lines].join("\n");
}

function rowsToExcelHTML(title, headers, rows) {
  const thead = `<tr>${headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join("")}</tr>`;

  const tbody = rows
    .map(
      (row) =>
        `<tr>${headers
          .map((header) => `<td>${escapeHtml(row[header] ?? "")}</td>`)
          .join("")}</tr>`
    )
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
</head>
<body>
  <h3>${escapeHtml(title)}</h3>
  <table border="1" cellspacing="0" cellpadding="6">
    <thead>${thead}</thead>
    <tbody>${tbody}</tbody>
  </table>
</body>
</html>`;
}

function printTableLikePayments(
  title,
  headers,
  rows,
  footerLabel,
  onPopupBlocked
) {
  const win = window.open("", "_blank", "width=900,height=700");

  if (!win) {
    onPopupBlocked?.();
    return;
  }

  const thead = `<tr>${headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join("")}</tr>`;

  const tbody = rows
    .map(
      (row) =>
        `<tr>${headers
          .map((header) => `<td>${escapeHtml(row[header] ?? "")}</td>`)
          .join("")}</tr>`
    )
    .join("");

  win.document.write(`
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            color: #222;
          }
          h1 {
            text-align: center;
            margin-bottom: 5px;
          }
          .subtitle {
            text-align: center;
            margin-bottom: 30px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          th, td {
            border: 1px solid #333;
            padding: 8px;
            text-align: left;
            font-size: 13px;
          }
          th {
            background: #f3f3f3;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 12px;
            color: #777;
          }
        </style>
      </head>
      <body>
        <h1>Konn3ct</h1>
        <p class="subtitle">${escapeHtml(title)}</p>

        <table>
          <thead>${thead}</thead>
          <tbody>${tbody}</tbody>
        </table>

        <div class="footer">
          <p>${escapeHtml(footerLabel)}</p>
        </div>

        <script>
          window.onload = function () {
            window.print();
          };
        </script>
      </body>
    </html>
  `);

  win.document.close();
}

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    // Continue to fallback.
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const wasCopied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return wasCopied;
  } catch (error) {
    return false;
  }
}

const normalizeStatus = (status) => {
  if (!status) return "participant";

  const normalizedStatus = String(status ?? "").trim().toLowerCase();

  if (
    normalizedStatus === "moderator" ||
    normalizedStatus === "host" ||
    normalizedStatus === "admin" ||
    normalizedStatus === "start meeting"
  ) {
    return "moderator";
  }

  if (normalizedStatus === "joined") {
    return "participant";
  }

  return "participant";
};

const ViewAttendance = () => {
  const { t } = useTranslation();
  const { meeting_id, identifier } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState(false);

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTitle, setPanelTitle] = useState("");
  const [panelContent, setPanelContent] = useState("");
  const [panelLoading, setPanelLoading] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await getAttendanceDetails(meeting_id, identifier, page);
        setAttendanceData(data);
      } catch (fetchError) {
        console.error(fetchError);
        setError(t("attendance.details.states.loadError"));
      } finally {
        setLoading(false);
      }
    };

    if (!meeting_id || !identifier) {
      setError(t("attendance.details.states.missingParams"));
      setLoading(false);
      return;
    }

    fetchDetails();
  }, [meeting_id, identifier, page, t]);

  const attendanceRows = useMemo(
    () => (Array.isArray(attendanceData?.data) ? attendanceData.data : []),
    [attendanceData]
  );

  const currentPage =
    Number.isFinite(Number(attendanceData?.current_page)) &&
    Number(attendanceData.current_page) > 0
      ? Number(attendanceData.current_page)
      : page;

  const lastPage =
    Number.isFinite(Number(attendanceData?.last_page)) &&
    Number(attendanceData.last_page) > 0
      ? Number(attendanceData.last_page)
      : 1;

  const perPage =
    Number.isFinite(Number(attendanceData?.per_page)) &&
    Number(attendanceData.per_page) > 0
      ? Number(attendanceData.per_page)
      : attendanceRows.length || 30;

  const rowStart =
    Number.isFinite(Number(attendanceData?.from)) &&
    Number(attendanceData.from) > 0
      ? Number(attendanceData.from)
      : attendanceRows.length > 0
        ? (currentPage - 1) * perPage + 1
        : 0;

  const openPanel = async (type) => {
    setPanelOpen(true);
    setPanelLoading(true);
    setPanelContent("");

    try {
      let result = "";

      if (type === "minutes") {
        setPanelTitle(t("attendance.details.panel.minutesTitle"));
        result = await getMeetingMinutes(meeting_id);
      }

      if (type === "highlights") {
        setPanelTitle(t("attendance.details.panel.highlightsTitle"));
        result = await getMeetingHighlights(meeting_id);
      }

      if (type === "summary") {
        setPanelTitle(t("attendance.details.panel.summaryTitle"));
        result = await getMeetingSummary(meeting_id);
      }

      setPanelContent(result || t("attendance.details.panel.noDataReturned"));
    } catch (panelError) {
      console.error(panelError);
      setPanelContent(t("attendance.details.panel.loadFailed"));
    } finally {
      setPanelLoading(false);
    }
  };

  const getMeetingAttendanceTitle = (count) =>
    t("attendance.details.export.title", { count });

  const serialHeader = t("attendance.details.table.serial");
  const nameHeader = t("attendance.details.table.name");
  const emailHeader = t("attendance.details.table.email");
  const statusHeader = t("attendance.details.table.status");
  const dateTimeHeader = t("attendance.details.table.dateTime");

  const exportRows = useMemo(
    () =>
      attendanceRows.map((row, index) => ({
        [serialHeader]: rowStart + index,
        [nameHeader]:
          row.name || row.attendee_name || t("attendance.common.notAvailable"),
        [emailHeader]:
          row.email || row.attendee_email || t("attendance.common.notAvailable"),
        [statusHeader]:
          normalizeStatus(row.status) === "moderator"
            ? t("attendance.details.status.moderator")
            : t("attendance.details.status.participant"),
        [dateTimeHeader]: row.created_at
          ? new Date(row.created_at).toLocaleString("en-US")
          : row.date
            ? row.date + (row.time ? ` | ${row.time}` : "")
            : t("attendance.common.notAvailable"),
      })),
    [
      attendanceRows,
      dateTimeHeader,
      emailHeader,
      nameHeader,
      rowStart,
      serialHeader,
      statusHeader,
      t,
    ]
  );

  const headers = useMemo(
    () => [serialHeader, nameHeader, emailHeader, statusHeader, dateTimeHeader],
    [dateTimeHeader, emailHeader, nameHeader, serialHeader, statusHeader]
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return exportRows;
    }

    return exportRows.filter((row) =>
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(query)
      )
    );
  }, [exportRows, search]);

  const handleCopy = async () => {
    const tsv = rowsToTSV(headers, filteredRows);
    const wasCopied = await copyToClipboard(tsv);

    if (wasCopied) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      return;
    }

    toast({
      description: t("attendance.details.toasts.copyFailed"),
      variant: "destructive",
    });
  };

  const handleCSV = () => {
    const csv = rowsToCSV(headers, filteredRows);
    downloadBlob(
      `attendance-${meeting_id || "export"}.csv`,
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    );
  };

  const handleExcel = () => {
    const html = rowsToExcelHTML(
      getMeetingAttendanceTitle(filteredRows.length),
      headers,
      filteredRows
    );

    downloadBlob(
      `attendance-${meeting_id || "export"}.xls`,
      new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" })
    );
  };

  const handlePrint = () => {
    printTableLikePayments(
      getMeetingAttendanceTitle(filteredRows.length),
      headers,
      filteredRows,
      t("attendance.details.export.printFooter"),
      () =>
        toast({
          description: t("attendance.details.toasts.allowPopups"),
          variant: "destructive",
        })
    );
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-gray-600 dark:text-muted-foreground">
          {t("attendance.details.states.loading")}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="m-auto flex min-h-screen items-center justify-center px-4 py-20 md:px-6 lg:px-4">
        <div className="w-full max-w-6xl rounded-2xl border bg-white p-8 shadow-sm dark:border-border dark:bg-card">
          <div className="mb-6 flex items-center justify-between md:flex-col md:items-stretch md:gap-4 lg:flex-row lg:items-center">
            <div>
              <div className="mb-3 flex gap-3 md:flex-wrap lg:flex-nowrap">
                <button
                  onClick={handleCopy}
                  className="rounded-md border px-4 py-1.5 text-sm dark:border-border dark:bg-background dark:hover:bg-accent dark:hover:text-accent-foreground"
                >
                  {copied
                    ? t("attendance.details.actions.copied")
                    : t("attendance.details.actions.copy")}
                </button>
                <button
                  onClick={handleCSV}
                  className="rounded-md border px-4 py-1.5 text-sm dark:border-border dark:bg-background dark:hover:bg-accent dark:hover:text-accent-foreground"
                >
                  {t("attendance.details.actions.csv")}
                </button>
                <button
                  onClick={handleExcel}
                  className="rounded-md border px-4 py-1.5 text-sm dark:border-border dark:bg-background dark:hover:bg-accent dark:hover:text-accent-foreground"
                >
                  {t("attendance.details.actions.excel")}
                </button>
                <button
                  onClick={handlePrint}
                  className="rounded-md border px-4 py-1.5 text-sm dark:border-border dark:bg-background dark:hover:bg-accent dark:hover:text-accent-foreground"
                >
                  {t("attendance.details.actions.print")}
                </button>
              </div>

              <div className="flex gap-3 md:flex-wrap lg:flex-nowrap">
                <button
                  onClick={() => openPanel("minutes")}
                  className="rounded-md bg-blue-100 px-4 py-2 text-xs text-blue-700 dark:bg-blue-500/15 dark:text-blue-200"
                >
                  {t("attendance.details.actions.sendMinutes")}
                </button>
                <button
                  onClick={() => openPanel("highlights")}
                  className="rounded-md bg-yellow-100 px-4 py-2 text-xs text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-200"
                >
                  {t("attendance.details.actions.sendHighlights")}
                </button>
                <button
                  onClick={() => openPanel("summary")}
                  className="rounded-md bg-purple-100 px-4 py-2 text-xs text-purple-700 dark:bg-purple-500/15 dark:text-purple-200"
                >
                  {t("attendance.details.actions.sendSummary")}
                </button>
              </div>
            </div>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              type="text"
              placeholder={t("attendance.details.filters.search")}
              className="w-64 rounded-full border border-input bg-white px-4 py-2 text-sm shadow-sm dark:bg-background dark:text-foreground dark:placeholder:text-muted-foreground md:w-full lg:w-64"
            />
          </div>

          <div className="mb-4 flex items-center justify-between md:flex-col md:items-start md:gap-3 lg:flex-row lg:items-center">
            <h2 className="text-base font-semibold">
              {t("attendance.details.title")}
            </h2>
            <button
              onClick={() => navigate("/attendance")}
              className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm dark:border-border dark:bg-background dark:hover:bg-accent dark:hover:text-accent-foreground"
            >
              <ArrowLeft size={16} />
              {t("attendance.details.actions.back")}
            </button>
          </div>

          <div className="md:overflow-x-auto lg:overflow-visible">
            <div className="md:min-w-[760px] lg:min-w-0">
              <div className="mb-2 grid grid-cols-[60px_1.5fr_2fr_1fr_1.5fr] text-sm font-medium text-gray-500 dark:text-muted-foreground">
                <span>{serialHeader}</span>
                <span>{nameHeader}</span>
                <span>{emailHeader}</span>
                <span>{statusHeader}</span>
                <span>{dateTimeHeader}</span>
              </div>

              <div className="space-y-3">
                {filteredRows.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-500 dark:text-muted-foreground">
                    {t("attendance.details.states.empty")}
                  </div>
                ) : (
                  filteredRows.map((row, index) => (
                    <div
                      key={`${row[serialHeader]}-${index}`}
                      className="grid grid-cols-[60px_1.5fr_2fr_1fr_1.5fr] items-center rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700 transition hover:bg-gray-100 dark:bg-background/40 dark:text-foreground dark:hover:bg-muted/70"
                    >
                      <span>{row[serialHeader]}</span>
                      <span>{row[nameHeader]}</span>
                      <span className="truncate" title={row[emailHeader]}>
                        {row[emailHeader]}
                      </span>
                      <span>
                        <span
                          className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
                            String(row[statusHeader]).toLowerCase() ===
                            "moderator"
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-200"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200"
                          }`}
                        >
                          {row[statusHeader]}
                        </span>
                      </span>
                      <span>{row[dateTimeHeader]}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {(attendanceRows.length > 0 || lastPage > 1) && (
            <div className="mt-6 flex items-center justify-center border-t pt-4 dark:border-border">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      disabled={
                        attendanceData?.prev_page_url === null || currentPage <= 1
                      }
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="px-2 text-sm text-gray-700 dark:text-muted-foreground">
                      {currentPage} / {lastPage}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      disabled={
                        attendanceData?.next_page_url == null ||
                        currentPage >= lastPage
                      }
                      onClick={() =>
                        setPage((prev) => Math.min(lastPage, prev + 1))
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      </div>

      {panelOpen && (
        <div
          onClick={() => setPanelOpen(false)}
          className="fixed inset-0 z-40 bg-black/20"
        />
      )}

      <div
        className={`fixed right-0 z-50 border-l bg-white shadow-xl transition-transform duration-300 dark:border-border dark:bg-popover
        w-full md:w-[420px] lg:w-[360px]
        ${panelOpen ? "translate-x-0" : "translate-x-full"}`}
        style={{
          top: NAVBAR_HEIGHT,
          height: `calc(100vh - ${NAVBAR_HEIGHT}px)`,
        }}
      >
        <div className="flex items-center justify-between border-b px-4 py-3 dark:border-border">
          <h3 className="text-sm font-semibold">{panelTitle}</h3>
          <button
            onClick={() => setPanelOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-accent"
            aria-label={t("attendance.details.panel.close")}
          >
            X
          </button>
        </div>

        <div className="h-[calc(100%-56px)] overflow-y-auto p-4">
          {panelLoading ? (
            <p className="text-sm text-gray-500 dark:text-muted-foreground">
              {t("attendance.details.panel.loading")}
            </p>
          ) : (
            <div className="whitespace-pre-wrap rounded-lg border bg-gray-50 p-4 text-sm leading-relaxed text-gray-800 dark:border-border dark:bg-background/50 dark:text-foreground">
              {panelContent}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ViewAttendance;
