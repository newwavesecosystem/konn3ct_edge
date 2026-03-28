import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPreRegParticipants, sendReminder } from "../api/eventsApi";
import { useToast } from "../hooks/use-toast";

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

function rowsToExcelHTML(title, headers, rows) {
  // HTML table saved as .xls (Excel opens it)
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

function printHTML(title, html) {
  const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!w) return;

  w.document.open();
  w.document.write(html);
  w.document.close();

  w.focus();
  // wait a tick so layout is ready
  setTimeout(() => {
    w.print();
    w.close();
  }, 250);
}

const EventParticipants = () => {
  const { reference } = useParams();
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        setLoading(true);
        const res = await getPreRegParticipants(reference);
        setParticipants(res?.users || []);
      } catch (err) {
        console.error("Error fetching participants:", err);
      } finally {
        setLoading(false);
      }
    };
    if (reference) fetchParticipants();
  }, [reference]);

  const sendReminderNow = async () => {
    try {
      setLoading(true);
      const res = await sendReminder(reference);
      toast({ description: res?.message || "Reminder sent." });
    } catch (err) {
      console.error("Error sending reminder:", err);
      toast({ description: "Failed to send reminder.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Build a normalized dataset for exports/printing
  const exportRows = useMemo(() => {
    return (participants || []).map((p, i) => ({
      "S/N": i + 1,
      Name: p?.name || "-",
      Email: p?.email || "-",
      Phone: p?.phone || "-",
      "Date & Time": p?.created_at ? new Date(p.created_at).toLocaleString() : "-",
    }));
  }, [participants]);

  const headers = useMemo(
    () => ["S/N", "Name", "Email", "Phone", "Date & Time"],
    []
  );

  // Search filter (name/email/phone/date)
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return exportRows;
    return exportRows.filter((r) =>
      Object.values(r).some((v) => String(v).toLowerCase().includes(q))
    );
  }, [exportRows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paginatedRows = filteredRows.slice(pageStart, pageStart + PAGE_SIZE);
  const showingFrom = filteredRows.length === 0 ? 0 : pageStart + 1;
  const showingTo =
    filteredRows.length === 0 ? 0 : pageStart + paginatedRows.length;

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const handleCopy = async () => {
    try {
      const tsv = rowsToTSV(headers, filteredRows);
      await navigator.clipboard.writeText(tsv);
      toast({ description: "Copied to clipboard." });
    } catch (e) {
      console.error(e);
      toast({ description: "Copy failed (browser blocked clipboard).", variant: "destructive" });
    }
  };

  const handleCSV = () => {
    const csv = rowsToCSV(headers, filteredRows);
    downloadBlob(`participants-${reference || "export"}.csv`, new Blob([csv], { type: "text/csv;charset=utf-8" }));
    toast({ description: "CSV downloaded." });
  };

  const handleExcel = () => {
    const html = rowsToExcelHTML(`Pre-Registered Users (${filteredRows.length})`, headers, filteredRows);
    downloadBlob(`participants-${reference || "export"}.xls`, new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" }));
    toast({ description: "Excel downloaded." });
  };

  const handlePrint = () => {
    const html = rowsToExcelHTML(`Pre-Registered Users (${filteredRows.length})`, headers, filteredRows);
    printHTML("Print", html);
  };

  return (
    <div className="mx-auto mt-16 w-full max-w-5xl rounded-2xl bg-white p-6 shadow-sm dark:border dark:border-border dark:bg-card">
      {/* Toolbar */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between md:flex-col md:items-start lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleCopy}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-background dark:text-muted-foreground dark:hover:bg-accent dark:hover:text-accent-foreground"
          >
            Copy
          </button>
          <button
            onClick={handleCSV}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-background dark:text-muted-foreground dark:hover:bg-accent dark:hover:text-accent-foreground"
          >
            CSV
          </button>
          <button
            onClick={handleExcel}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-background dark:text-muted-foreground dark:hover:bg-accent dark:hover:text-accent-foreground"
          >
            Excel
          </button>
          <button
            onClick={handlePrint}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-border dark:bg-background dark:text-muted-foreground dark:hover:bg-accent dark:hover:text-accent-foreground"
          >
            Print
          </button>
        </div>

        <button
          onClick={sendReminderNow}
          className="bg-[#227451] hover:bg-green-700 text-white text-sm px-5 py-2 rounded-full transition-all"
        >
          Send Reminder Now
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-5">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
          type="text"
          placeholder="Search"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-input dark:bg-background dark:text-foreground dark:placeholder:text-muted-foreground dark:focus:ring-ring sm:w-64 md:w-full lg:w-64"
        />
      </div>

      {/* Header + Back Button */}
      <div className="mb-3 flex items-center justify-between md:flex-col md:items-start md:gap-3 lg:flex-row lg:items-center">
        <h2 className="text-md font-semibold text-gray-800 dark:text-foreground">
          Pre-Registered Users ({filteredRows.length})
        </h2>
        <button
          onClick={() => navigate("/events")}
          className="bg-[#227451] hover:bg-green-700 text-white text-xs px-4 py-2 rounded-full transition-all"
        >
          ← Back
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-[720px] overflow-hidden rounded-xl border border-gray-100 dark:border-border lg:min-w-full">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600 dark:bg-muted/70 dark:text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">S/N</th>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Phone</th>
              <th className="px-4 py-3 text-left font-medium">Date & Time</th>
            </tr>
          </thead>

          <tbody className="text-sm text-gray-700 dark:text-foreground">
            {loading ? (
              <tr>
                <td colSpan="5" className="py-6 text-center text-gray-500 dark:text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : paginatedRows.length > 0 ? (
              paginatedRows.map((r, index) => (
                <tr
                  key={`${r["S/N"]}-${index}`}
                  className={`border-t transition dark:border-border dark:hover:bg-muted/60 ${
                    (pageStart + index) % 2 === 0
                      ? "bg-white dark:bg-background/30"
                      : "bg-gray-50 dark:bg-muted/40"
                  }`}
                >
                  <td className="px-4 py-3">{r["S/N"]}</td>
                  <td className="px-4 py-3">{r.Name}</td>
                  <td className="px-4 py-3">{r.Email}</td>
                  <td className="px-4 py-3">{r.Phone}</td>
                  <td className="px-4 py-3">{r["Date & Time"]}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="py-6 text-center text-gray-500 dark:text-muted-foreground">
                  No participants found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-muted-foreground md:flex-col md:items-start md:gap-3 lg:flex-row lg:items-center">
        <span>
          Showing {showingFrom}-{showingTo} of {filteredRows.length}
        </span>
        <div className="flex space-x-1">
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={loading || currentPage === 1}
            className={`rounded-md border border-gray-300 px-2 py-1 dark:border-border dark:bg-background ${
              loading || currentPage === 1
                ? "cursor-not-allowed opacity-50"
                : "hover:bg-gray-100 dark:hover:bg-accent dark:hover:text-accent-foreground"
            }`}
          >
            &lt;
          </button>
          <span className="px-1 py-1">
            {currentPage}/{totalPages}
          </span>
          <button
            type="button"
            onClick={() =>
              setCurrentPage((page) => Math.min(totalPages, page + 1))
            }
            disabled={loading || currentPage === totalPages}
            className={`rounded-md border border-gray-300 px-2 py-1 dark:border-border dark:bg-background ${
              loading || currentPage === totalPages
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

export default EventParticipants;
