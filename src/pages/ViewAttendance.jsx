import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getAttendanceDetails,
  getMeetingSummary,
  getMeetingHighlights,
  getMeetingMinutes,
} from "../api/attendanceApi";
import { ArrowLeft } from "lucide-react";
import { useToast } from "../hooks/use-toast";

const NAVBAR_HEIGHT = 72;

/* ======================================
   HELPERS (COPY / CSV / EXCEL / PRINT)
====================================== */
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
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function rowsToTSV(headers, rows) {
  const headerLine = headers.join("\t");
  const lines = rows.map((r) => headers.map((h) => (r[h] ?? "")).join("\t"));
  return [headerLine, ...lines].join("\n");
}

function rowsToCSV(headers, rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    const needsQuotes = /[",\n\r]/.test(s);
    const safe = s.replaceAll('"', '""');
    return needsQuotes ? `"${safe}"` : safe;
  };

  const headerLine = headers.map(esc).join(",");
  const lines = rows.map((r) => headers.map((h) => esc(r[h])).join(","));
  return [headerLine, ...lines].join("\n");
}

// Excel: save HTML table as .xls (Excel opens it fine)
function rowsToExcelHTML(title, headers, rows) {
  const thead = `<tr>${headers
    .map((h) => `<th>${escapeHtml(h)}</th>`)
    .join("")}</tr>`;

  const tbody = rows
    .map(
      (r) =>
        `<tr>${headers
          .map((h) => `<td>${escapeHtml(r[h] ?? "")}</td>`)
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

/**
 * ✅ PRINT (same method as Payments.jsx):
 * - open popup
 * - write HTML
 * - in popup: window.onload => window.print()
 */
function printTableLikePayments(title, headers, rows, onPopupBlocked) {
  const win = window.open("", "_blank", "width=900,height=700");

  if (!win) {
    onPopupBlocked?.();
    return;
  }

  const thead = `<tr>${headers
    .map((h) => `<th>${escapeHtml(h)}</th>`)
    .join("")}</tr>`;

  const tbody = rows
    .map(
      (r) =>
        `<tr>${headers
          .map((h) => `<td>${escapeHtml(r[h] ?? "")}</td>`)
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
          <p>This printout was generated electronically.</p>
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

/**
 * ✅ COPY with fallback (works if navigator.clipboard fails)
 */
async function copyToClipboard(text) {
  // modern clipboard (needs secure context)
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    // continue to fallback
  }

  // fallback method
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch (e) {
    return false;
  }
}

/* ======================================
   ✅ STATUS NORMALIZER (moderator/participant only)
====================================== */
const normalizeStatus = (status) => {
  if (!status) return "participant";

  const s = String(status ?? "").trim().toLowerCase();

  // Treat these as moderator-like roles (optional, safe mapping)
  if (
    s === "moderator" ||
    s === "host" ||
    s === "admin" ||
    s === "start meeting"
  )
    return "moderator";

  // Backend "joined" => participant
  if (s === "joined") return "participant";

  // Everything else becomes participant
  return "participant";
};

/* ======================================
   VIEW ATTENDANCE COMPONENT
====================================== */
const ViewAttendance = () => {
  const { meeting_id, identifier } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");

  // ✅ copy feedback
  const [copied, setCopied] = useState(false);

  // Side panel
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTitle, setPanelTitle] = useState("");
  const [panelContent, setPanelContent] = useState("");
  const [panelLoading, setPanelLoading] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const data = await getAttendanceDetails(meeting_id, identifier);

        if (Array.isArray(data)) setAttendanceData(data);
        else if (typeof data === "object" && data) setAttendanceData([data]);
        else setAttendanceData([]);
      } catch (err) {
        console.error(err);
        setError("Unable to load participant details.");
      } finally {
        setLoading(false);
      }
    };

    if (!meeting_id || !identifier) {
      setError("Missing meeting_id or identifier.");
      setLoading(false);
      return;
    }

    fetchDetails();
  }, [meeting_id, identifier]);

  const openPanel = async (type) => {
    setPanelOpen(true);
    setPanelLoading(true);
    setPanelContent("");

    try {
      let result = "";
      if (type === "minutes") {
        setPanelTitle("Minutes of Meeting");
        result = await getMeetingMinutes(meeting_id);
      }
      if (type === "highlights") {
        setPanelTitle("Meeting Highlights");
        result = await getMeetingHighlights(meeting_id);
      }
      if (type === "summary") {
        setPanelTitle("Meeting Summary");
        result = await getMeetingSummary(meeting_id);
      }

      setPanelContent(result || "No data returned.");
    } catch (err) {
      console.error(err);
      setPanelContent("Failed to load content.");
    } finally {
      setPanelLoading(false);
    }
  };

  // Normalize rows for export + filtering
  const exportRows = useMemo(() => {
    return (attendanceData || []).map((row, i) => ({
      "S/N": i + 1,
      NAME: row.name || row.attendee_name || "N/A",
      EMAIL: row.email || row.attendee_email || "N/A",

      // ✅ CHANGED: only moderator/participant
      STATUS: normalizeStatus(row.status),

      "DATE & TIME": row.created_at
        ? new Date(row.created_at).toLocaleString()
        : row.date
        ? row.date + (row.time ? ` | ${row.time}` : "")
        : "N/A",
    }));
  }, [attendanceData]);

  const headers = useMemo(
    () => ["S/N", "NAME", "EMAIL", "STATUS", "DATE & TIME"],
    []
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return exportRows;
    return exportRows.filter((r) =>
      Object.values(r).some((v) => String(v).toLowerCase().includes(q))
    );
  }, [exportRows, search]);

  // Actions
  const handleCopy = async () => {
    const tsv = rowsToTSV(headers, filteredRows);
    const ok = await copyToClipboard(tsv);

    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } else {
      toast({
        description:
          "Copy failed. Please allow clipboard permission or use HTTPS.",
        variant: "destructive",
      });
    }
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
      `Meeting Attendance (${filteredRows.length})`,
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
      `Meeting Attendance (${filteredRows.length})`,
      headers,
      filteredRows,
      () =>
        toast({
          description: "Please allow popups to print",
          variant: "destructive",
        })
    );
  };

  if (loading)
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-sm text-gray-600 dark:text-muted-foreground">Loading participant data...</p>
      </div>
    );

  if (error)
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );

  return (
    <>
      {/* MAIN CONTENT */}
      <div className="m-auto flex min-h-screen items-center justify-center px-4 py-20 md:px-6 lg:px-4">
        <div className="w-full max-w-6xl rounded-2xl border bg-white p-8 shadow-sm dark:border-border dark:bg-card">
          {/* TOP ACTIONS */}
          <div className="mb-6 flex items-center justify-between md:flex-col md:items-stretch md:gap-4 lg:flex-row lg:items-center">
            <div>
              <div className="mb-3 flex gap-3 md:flex-wrap lg:flex-nowrap">
                <button
                  onClick={handleCopy}
                  className="rounded-md border px-4 py-1.5 text-sm dark:border-border dark:bg-background dark:hover:bg-accent dark:hover:text-accent-foreground"
                >
                  {copied ? "COPIED ✅" : "COPY"}
                </button>
                <button
                  onClick={handleCSV}
                  className="rounded-md border px-4 py-1.5 text-sm dark:border-border dark:bg-background dark:hover:bg-accent dark:hover:text-accent-foreground"
                >
                  CSV
                </button>
                <button
                  onClick={handleExcel}
                  className="rounded-md border px-4 py-1.5 text-sm dark:border-border dark:bg-background dark:hover:bg-accent dark:hover:text-accent-foreground"
                >
                  EXCEL
                </button>
                <button
                  onClick={handlePrint}
                  className="rounded-md border px-4 py-1.5 text-sm dark:border-border dark:bg-background dark:hover:bg-accent dark:hover:text-accent-foreground"
                >
                  PRINT
                </button>
              </div>

              <div className="flex gap-3 md:flex-wrap lg:flex-nowrap">
                <button
                  onClick={() => openPanel("minutes")}
                  className="rounded-md bg-blue-100 px-4 py-2 text-xs text-blue-700 dark:bg-blue-500/15 dark:text-blue-200"
                >
                  Send Minutes of Meeting
                </button>
                <button
                  onClick={() => openPanel("highlights")}
                  className="rounded-md bg-yellow-100 px-4 py-2 text-xs text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-200"
                >
                  Send Meeting Highlight
                </button>
                <button
                  onClick={() => openPanel("summary")}
                  className="rounded-md bg-purple-100 px-4 py-2 text-xs text-purple-700 dark:bg-purple-500/15 dark:text-purple-200"
                >
                  Send Meeting Summary
                </button>
              </div>
            </div>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              type="text"
              placeholder="Search"
              className="w-64 rounded-full border border-input bg-white px-4 py-2 text-sm shadow-sm dark:bg-background dark:text-foreground dark:placeholder:text-muted-foreground md:w-full lg:w-64"
            />
          </div>

          {/* TITLE */}
          <div className="mb-4 flex items-center justify-between md:flex-col md:items-start md:gap-3 lg:flex-row lg:items-center">
            <h2 className="text-base font-semibold">Meeting Attendance</h2>
            <button
              onClick={() => navigate("/attendance")}
              className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm dark:border-border dark:bg-background dark:hover:bg-accent dark:hover:text-accent-foreground"
            >
              <ArrowLeft size={16} />
              Back to Attendance
            </button>
          </div>

          {/* TABLE HEADER */}
          <div className="md:overflow-x-auto lg:overflow-visible">
            <div className="md:min-w-[760px] lg:min-w-0">
              <div className="mb-2 grid grid-cols-[60px_1.5fr_2fr_1fr_1.5fr] text-sm font-medium text-gray-500 dark:text-muted-foreground">
                <span>S/N</span>
                <span>NAME</span>
                <span>EMAIL</span>
                <span>STATUS</span>
                <span>DATE & TIME</span>
              </div>

              {/* TABLE ROWS */}
              <div className="space-y-3">
                {filteredRows.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-500 dark:text-muted-foreground">
                    No participants found for this meeting.
                  </div>
                ) : (
                  filteredRows.map((r, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-[60px_1.5fr_2fr_1fr_1.5fr] items-center rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700 transition hover:bg-gray-100 dark:bg-background/40 dark:text-foreground dark:hover:bg-muted/70"
                    >
                      <span>{r["S/N"]}</span>
                      <span>{r.NAME}</span>

                      <span className="truncate" title={r.EMAIL}>
                        {r.EMAIL}
                      </span>

                      <span>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                            String(r.STATUS).toLowerCase() === "moderator"
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-200"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200"
                          }`}
                        >
                          {r.STATUS}
                        </span>
                      </span>

                      <span>{r["DATE & TIME"]}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* OVERLAY */}
      {panelOpen && (
        <div
          onClick={() => setPanelOpen(false)}
          className="fixed inset-0 bg-black/20 z-40"
        />
      )}

      {/* SIDE PANEL */}
      <div
        className={`fixed right-0 z-50 border-l bg-white shadow-xl transition-transform duration-300 dark:border-border dark:bg-popover
        w-full md:w-[420px] lg:w-[360px]
        ${panelOpen ? "translate-x-0" : "translate-x-full"}`}
        style={{
          top: NAVBAR_HEIGHT,
          height: `calc(100vh - ${NAVBAR_HEIGHT}px)`,
        }}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between border-b px-4 py-3 dark:border-border">
          <h3 className="text-sm font-semibold">{panelTitle}</h3>
          <button
            onClick={() => setPanelOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-accent"
          >
            ✕
          </button>
        </div>

        {/* CONTENT */}
        <div className="p-4 overflow-y-auto h-[calc(100%-56px)]">
          {panelLoading ? (
            <p className="text-sm text-gray-500 dark:text-muted-foreground">Loading...</p>
          ) : (
            <div className="rounded-lg border bg-gray-50 p-4 text-sm leading-relaxed whitespace-pre-wrap text-gray-800 dark:border-border dark:bg-background/50 dark:text-foreground">
              {panelContent}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ViewAttendance;
