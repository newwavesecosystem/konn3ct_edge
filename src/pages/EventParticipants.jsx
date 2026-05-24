import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { 
  ArrowLeft, 
  Copy, 
  Table as TableIcon, 
  Printer, 
  Search, 
  BellRing, 
  Users, 
  User, 
  CalendarDays,
  Phone,
  Mail
} from "lucide-react";

import { getPreRegParticipants, sendReminder } from "../api/eventsApi";
import { useToast } from "../hooks/use-toast";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "../components/ui/pagination";

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

function printHTML(title, html) {
  const printWindow = window.open(
    "",
    "_blank",
    "noopener,noreferrer,width=900,height=700"
  );
  if (!printWindow) {
    return;
  }

  printWindow.document.open();
  printWindow.document.write(`
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #222; }
          h1 { text-align: center; margin-bottom: 5px; }
          .subtitle { text-align: center; margin-bottom: 30px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #333; padding: 8px; text-align: left; font-size: 13px; }
          th { background: #f3f3f3; }
        </style>
      </head>
      <body>
        <h1>Konn3ct</h1>
        <p class="subtitle">${escapeHtml(title)}</p>
        ${html.split('<body>')[1].split('</body>')[0]}
        <script>
          window.onload = function () { window.print(); };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

const EventParticipants = () => {
  const { t } = useTranslation();
  const { reference } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;
  
  const getParticipantsTitle = (count) =>
    t("events.participants.title", { count }) || `Event Participants (${count})`;

  const headers = useMemo(
    () => [
      t("events.participants.table.serial", "#"),
      t("events.participants.table.name", "Name"),
      t("events.participants.table.email", "Email"),
      t("events.participants.table.phone", "Phone"),
      t("events.participants.table.dateTime", "Registration Date"),
    ],
    [t]
  );

  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        setLoading(true);
        const response = await getPreRegParticipants(reference);
        setParticipants(response?.users || []);
      } catch (error) {
        console.error("Error fetching participants:", error);
      } finally {
        setLoading(false);
      }
    };

    if (reference) {
      fetchParticipants();
    }
  }, [reference]);

  const sendReminderNow = async () => {
    try {
      setActionLoading(true);
      const response = await sendReminder(reference);
      toast({
        description: response?.message || t("events.participants.toasts.reminderSent", "Reminder sent successfully!"),
      });
    } catch (error) {
      console.error("Error sending reminder:", error);
      toast({
        description: t("events.participants.toasts.reminderFailed", "Failed to send reminder."),
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const exportRows = useMemo(
    () =>
      (participants || []).map((participant, index) => ({
        [headers[0]]: index + 1,
        [headers[1]]: participant?.name || "-",
        [headers[2]]: participant?.email || "-",
        [headers[3]]: participant?.phone || "-",
        [headers[4]]: participant?.created_at
          ? new Date(participant.created_at).toLocaleString("en-US")
          : "-",
      })),
    [headers, participants]
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

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paginatedRows = filteredRows.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const handleCopy = async () => {
    try {
      const tsv = rowsToTSV(headers, filteredRows);
      await navigator.clipboard.writeText(tsv);
      toast({ description: t("events.participants.toasts.copied", "Copied to clipboard!") });
    } catch (error) {
      console.error(error);
      toast({
        description: t("events.participants.toasts.copyFailed", "Failed to copy."),
        variant: "destructive",
      });
    }
  };

  const handleCSV = () => {
    const csv = rowsToCSV(headers, filteredRows);
    downloadBlob(
      `participants-${reference || "export"}.csv`,
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    );
    toast({ description: t("events.participants.toasts.csvDownloaded", "CSV Downloaded") });
  };

  const handleExcel = () => {
    const html = rowsToExcelHTML(
      getParticipantsTitle(filteredRows.length),
      headers,
      filteredRows
    );
    downloadBlob(
      `participants-${reference || "export"}.xls`,
      new Blob([html], {
        type: "application/vnd.ms-excel;charset=utf-8",
      })
    );
    toast({ description: t("events.participants.toasts.excelDownloaded", "Excel Downloaded") });
  };

  const handlePrint = () => {
    const html = rowsToExcelHTML(
      getParticipantsTitle(filteredRows.length),
      headers,
      filteredRows
    );
    printHTML(t("events.participants.actions.print", "Print"), html);
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-100px)] w-full items-center justify-center">
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          {t("events.participants.states.loading", "Loading participants...")}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 p-4 md:p-6 lg:p-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
        <div>
          <Button
            variant="ghost"
            onClick={() => navigate("/events")}
            className="mb-4 h-8 px-2 text-muted-foreground hover:text-foreground -ml-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("common.actions.goBack", "Back to Events")}
          </Button>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-brand-blue" />
            {getParticipantsTitle(filteredRows.length)}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review who has registered for your event and send reminders.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            onClick={sendReminderNow}
            disabled={actionLoading || participants.length === 0}
            className="h-10 rounded-xl bg-brand-green hover:bg-[#287854] text-white shadow-[0_4px_14px_rgba(32,116,80,0.2)] font-semibold transition-all"
          >
            {actionLoading ? (
               <div className="flex items-center gap-2">
                 <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                 Sending...
               </div>
            ) : (
              <>
                <BellRing className="mr-2 h-4 w-4" />
                {t("events.participants.actions.sendReminder", "Send Reminder to All")}
              </>
            )}
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy} className="h-9 rounded-lg border-border/60">
              <Copy className="mr-2 h-3.5 w-3.5" />
              {t("events.participants.actions.copy", "Copy")}
            </Button>
            <Button variant="outline" size="sm" onClick={handleCSV} className="h-9 rounded-lg border-border/60">
              <TableIcon className="mr-2 h-3.5 w-3.5" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExcel} className="h-9 rounded-lg border-border/60">
              <TableIcon className="mr-2 h-3.5 w-3.5" />
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="h-9 rounded-lg border-border/60">
              <Printer className="mr-2 h-3.5 w-3.5" />
              Print
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border-border/60 bg-surface shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/40 bg-black/[0.01]">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={t("events.participants.filters.search", "Search participants by name, email, phone...")}
              className="pl-9 h-10 rounded-xl bg-background border-border/60 focus-visible:ring-brand-green/30"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-[60px_1.5fr_2fr_1fr_1.5fr] items-center px-6 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40 bg-black/[0.02]">
              <span>{headers[0]}</span>
              <span>{headers[1]}</span>
              <span>{headers[2]}</span>
              <span>{headers[3]}</span>
              <span>{headers[4]}</span>
            </div>

            <div className="divide-y divide-border/40">
              {paginatedRows.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  {t("events.participants.states.empty", "No participants found matching your criteria.")}
                </div>
              ) : (
                paginatedRows.map((row, index) => (
                  <div
                    key={`${row[headers[0]]}-${index}`}
                    className="grid grid-cols-[60px_1.5fr_2fr_1fr_1.5fr] items-center px-6 py-4 text-sm text-foreground hover:bg-black/[0.01] transition-colors"
                  >
                    <span className="font-medium text-muted-foreground">{row[headers[0]]}</span>
                    
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-brand-green/10 flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-brand-green" />
                      </div>
                      <span className="font-semibold">{row[headers[1]]}</span>
                    </div>

                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 shrink-0 opacity-50" />
                      <span className="truncate pr-4" title={row[headers[2]]}>
                        {row[headers[2]]}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {row[headers[3]] !== "-" && <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-50" />}
                      <span className="text-muted-foreground">{row[headers[3]]}</span>
                    </div>

                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      <Badge variant="secondary" className="bg-black/[0.03] text-foreground border-0 font-medium">
                        {row[headers[4]]}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {(filteredRows.length > 0 || totalPages > 1) && (
          <div className="flex items-center justify-center py-4 border-t border-border/40 bg-black/[0.01]">
            <Pagination className="w-auto bg-background rounded-full border border-border/60 shadow-sm px-2 py-1">
              <PaginationContent className="flex items-center space-x-1">
                <PaginationItem>
                  <PaginationPrevious
                    className="h-8 w-8 rounded-full p-0 flex items-center justify-center hover:bg-black/5 cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      setCurrentPage((prev) => Math.max(1, prev - 1));
                    }}
                    disabled={currentPage === 1}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="text-sm font-medium text-foreground px-3">
                    {currentPage} <span className="text-muted-foreground font-normal">/ {totalPages}</span>
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    className="h-8 w-8 rounded-full p-0 flex items-center justify-center hover:bg-black/5 cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1));
                    }}
                    disabled={currentPage === totalPages}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventParticipants;
