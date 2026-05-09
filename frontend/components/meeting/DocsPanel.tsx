"use client";

import React, { useState } from "react";
import { useMeeting } from "@/lib/meeting-context";
import { FileText, Table, Presentation, Download, Maximize2, Minimize2 } from "lucide-react";
import dynamic from "next/dynamic";
import "react-quill-new/dist/quill.snow.css";
import "@excalidraw/excalidraw/index.css";
import * as XLSX from "xlsx";

// Dynamically import heavy editors to avoid SSR issues
const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });
const Spreadsheet = dynamic(() => import("react-spreadsheet").then(m => m.Spreadsheet), { ssr: false });
const ExcalidrawWrapper = dynamic(() => import("./CustomExcalidraw"), { ssr: false });

// Extract modules outside component to prevent Quill from re-rendering on every keystroke
const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link', 'image']
  ]
};

const createEmptyMatrix = (rows: number, cols: number) => {
  return Array(rows).fill(null).map(() => Array(cols).fill({ value: "" }));
};

export function DocsPanel() {
  const { sharedNoteContent, updateSharedNote } = useMeeting();
  const [activeTab, setActiveTab] = useState<"doc" | "sheet" | "slide">("doc");
  const [isExpanded, setIsExpanded] = useState(false);

  // Parse unified state
  let state = {
    doc: "",
    sheet: createEmptyMatrix(50, 20),
    excalidraw: [] as readonly any[],
  };

  try {
    if (sharedNoteContent) {
      const parsed = JSON.parse(sharedNoteContent);
      if (parsed.doc !== undefined) state.doc = parsed.doc;
      if (parsed.sheet !== undefined) state.sheet = parsed.sheet;
      if (parsed.excalidraw !== undefined) state.excalidraw = parsed.excalidraw;
    }
  } catch (e) {
    // Fallback if previous content was plain string
    if (sharedNoteContent && !sharedNoteContent.startsWith("{")) {
      state.doc = sharedNoteContent;
    }
  }

  // Local state for Quill to prevent cursor jumps and Enter key bugs
  const [localDoc, setLocalDoc] = useState(state.doc);

  // Sync incoming server changes ONLY if they differ from local
  React.useEffect(() => {
    if (state.doc !== localDoc) {
      setLocalDoc(state.doc);
    }
  }, [state.doc]);

  const handleDocChange = (content: string, delta: any, source: string) => {
    if (source === "user") {
      setLocalDoc(content);
      state.doc = content;
      updateSharedNote(JSON.stringify(state));
    }
  };

  const handleSheetChange = (data: any[]) => {
    state.sheet = data;
    updateSharedNote(JSON.stringify(state));
  };

  const lastExcalidrawVersion = React.useRef(0);

  const handleExcalidrawChange = (elements: readonly any[]) => {
    // Only broadcast if the elements actually changed (calculate version sum)
    const currentVersion = elements.reduce((acc, el) => acc + (el.version || 0), 0);
    if (currentVersion !== lastExcalidrawVersion.current) {
      lastExcalidrawVersion.current = currentVersion;
      state.excalidraw = elements;
      updateSharedNote(JSON.stringify(state));
    }
  };

  const handleDownload = () => {
    if (activeTab === "sheet") {
      const rawData = state.sheet.map((row: any[]) => row.map((cell: any) => cell.value || ""));
      const ws = XLSX.utils.aoa_to_sheet(rawData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Meeting Sheet");
      XLSX.writeFile(wb, "meeting-sheet.xlsx");
      return;
    }

    let content = "";
    let ext = "doc";
    let mime = "application/msword";

    if (activeTab === "doc") {
      content = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'></head>
        <body>${state.doc}</body>
        </html>
      `;
    } else {
      // Excalidraw handles its own export natively in its UI, but we can fallback here
      content = "Kindly download this file from the whiteboard panel.";
      ext = "txt";
      mime = "text/plain";
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meeting-${activeTab}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`flex flex-col bg-[var(--mt-bg)] ${isExpanded ? "fixed inset-0 z-[100] h-screen w-screen" : "h-full"}`}>
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between shrink-0"
        style={{ borderBottom: "1px solid var(--mt-border)" }}
      >
        <h3 className="text-sm font-semibold" style={{ color: "var(--mt-text)" }}>Workspace</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={handleDownload}
            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--mt-bg-hover)]"
            style={{ color: "var(--mt-text-faint)" }}
            title={`Download ${activeTab}`}
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--mt-bg-hover)]"
            style={{ color: "var(--mt-text-faint)" }}
            title={isExpanded ? "Minimize" : "Maximize"}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex px-2 py-2 gap-1 shrink-0" style={{ borderBottom: "1px solid var(--mt-border)" }}>
        <button
          onClick={() => setActiveTab("doc")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === "doc" ? "bg-brand-green/10 text-brand-green" : "hover:bg-[var(--mt-bg-hover)] text-[var(--mt-text-faint)]"
            }`}
        >
          <FileText className="w-3.5 h-3.5" /> Docs
        </button>
        <button
          onClick={() => setActiveTab("sheet")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === "sheet" ? "bg-blue-500/10 text-blue-500" : "hover:bg-[var(--mt-bg-hover)] text-[var(--mt-text-faint)]"
            }`}
        >
          <Table className="w-3.5 h-3.5" /> Sheets
        </button>
        <button
          onClick={() => setActiveTab("slide")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === "slide" ? "bg-orange-500/10 text-orange-500" : "hover:bg-[var(--mt-bg-hover)] text-[var(--mt-text-faint)]"
            }`}
        >
          <Presentation className="w-3.5 h-3.5" /> Whiteboard
        </button>
      </div>

      {/* Editor Canvas */}
      <div className="flex-1 relative overflow-auto bg-white">
        {activeTab === "doc" && (
          <div className="h-full quill-wrapper text-black">
            <ReactQuill
              theme="snow"
              value={localDoc}
              onChange={handleDocChange}
              className="h-full pb-10"
              modules={quillModules}
            />
          </div>
        )}

        {activeTab === "sheet" && (
          <div className="p-4 h-full text-black">
            <Spreadsheet data={state.sheet} onChange={handleSheetChange} />
          </div>
        )}

        {activeTab === "slide" && (
          <div className="absolute inset-0 w-full h-full bg-white z-[0]">
            <ExcalidrawWrapper 
              remoteElements={state.excalidraw} 
              onChange={handleExcalidrawChange} 
            />
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .quill-wrapper .ql-toolbar {
          border: none !important;
          border-bottom: 1px solid #e2e8f0 !important;
          background: #f8fafc;
        }
        .quill-wrapper .ql-container {
          border: none !important;
          font-family: inherit;
        }
        
        /* Hide Excalidraw's external library browse button since we bundle them all */
        .excalidraw a[href*="libraries.excalidraw.com"],
        .excalidraw .library-menu-browse-button,
        .excalidraw .layer-ui__library .dropdown-menu-button,
        .excalidraw .sidebar-provider .dropdown-menu-button,
        .excalidraw .library-menu-items-container__header .dropdown-menu-button,
        .excalidraw .dropdown-menu-button[title="Library options"] {
          display: none !important;
        }

        /* Hide Excalidraw Help Panel Links and Floating Help Icon */
        .excalidraw .help-icon,
        .excalidraw .HelpDialog a[href*="docs.excalidraw.com"],
        .excalidraw .HelpDialog a[href*="blog.excalidraw.com"],
        .excalidraw .HelpDialog a[href*="plus.excalidraw.com"],
        .excalidraw .HelpDialog a[href*="excalidraw.com"],
        .excalidraw .HelpDialog a[href*="github.com"],
        .excalidraw .HelpDialog a[href*="youtube.com"] {
          display: none !important;
        }

        /* Rename Library Section */
        .excalidraw .library-menu-items-container__header {
          font-size: 0 !important;
          color: transparent !important;
        }
        .excalidraw .library-menu-items-container__header::before {
          content: "Konn3ct Assets";
          visibility: visible;
          font-size: 0.875rem !important;
          font-weight: 600 !important;
          color: inherit !important;
          line-height: 1.5;
        }
      `}} />
    </div>
  );
}
