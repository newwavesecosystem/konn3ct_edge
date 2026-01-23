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
    <div className="bg-white rounded-2xl shadow-sm p-6 w-full max-w-5xl mx-auto mt-16">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-5">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleCopy}
            className="border border-gray-300 text-gray-700 text-sm px-3 py-1.5 rounded-md hover:bg-gray-50"
          >
            Copy
          </button>
          <button
            onClick={handleCSV}
            className="border border-gray-300 text-gray-700 text-sm px-3 py-1.5 rounded-md hover:bg-gray-50"
          >
            CSV
          </button>
          <button
            onClick={handleExcel}
            className="border border-gray-300 text-gray-700 text-sm px-3 py-1.5 rounded-md hover:bg-gray-50"
          >
            Excel
          </button>
          <button
            onClick={handlePrint}
            className="border border-gray-300 text-gray-700 text-sm px-3 py-1.5 rounded-md hover:bg-gray-50"
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
          onChange={(e) => setSearch(e.target.value)}
          type="text"
          placeholder="Search"
          className="w-full sm:w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
        />
      </div>

      {/* Header + Back Button */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-md font-semibold text-gray-800">
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
        <table className="min-w-full border border-gray-100 rounded-xl overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left font-medium">S/N</th>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Phone</th>
              <th className="px-4 py-3 text-left font-medium">Date & Time</th>
            </tr>
          </thead>

          <tbody className="text-sm text-gray-700">
            {loading ? (
              <tr>
                <td colSpan="5" className="text-center py-6 text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : filteredRows.length > 0 ? (
              filteredRows.map((r, index) => (
                <tr
                  key={index}
                  className={`border-t hover:bg-gray-50 transition ${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50"
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
                <td colSpan="5" className="text-center py-6 text-gray-500">
                  No participants found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
        <span>Showing {filteredRows.length > 0 ? `1-${filteredRows.length}` : "0/0"}</span>
        {/* pagination buttons still dummy - optional */}
        <div className="flex space-x-1">
          <button className="border border-gray-300 rounded-md px-2 py-1 hover:bg-gray-100">
            &lt;
          </button>
          <button className="border border-gray-300 rounded-md px-2 py-1 hover:bg-gray-100">
            &gt;
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventParticipants;
