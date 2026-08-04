"use client";

import { useState, useEffect, use } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, Maximize, Volume2, VolumeX,
  Settings, Download, Share2, Info, MessageSquare,
  Clock, Calendar, Users, ChevronLeft, Sun, Moon, X, Copy
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";

import { apiClient } from "@/lib/api-client";

export default function RecordingViewerPage({ params }: { params: Promise<{ recordingId: string }> }) {
  const { recordingId } = use(params);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const details = await apiClient.recordings.getDetails(recordingId);
        setData(details);
      } catch (err: any) {
        setError(err.message || "Failed to load recording");
      } finally {
        setIsLoaded(true);
      }
    }
    loadData();
  }, [recordingId]);

  if (!isLoaded) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-[#0A0A0A]' : 'bg-[#F8FAFC]'} flex items-center justify-center transition-colors duration-500`}>
        <div className="w-12 h-12 border-4 border-brand-green/30 border-t-brand-green rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-[#0A0A0A]' : 'bg-[#F8FAFC]'} flex flex-col items-center justify-center transition-colors duration-500`}>
        <div className="text-red-500 mb-4"><Info className="w-12 h-12" /></div>
        <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'} mb-2`}>Access Denied</h2>
        <p className={`${isDarkMode ? 'text-white/60' : 'text-slate-500'} mb-6`}>{error}</p>
        <Button className="bg-brand-green hover:bg-[#287854] text-white rounded-xl h-10 px-6">
          Sign In
        </Button>
      </div>
    );
  }

  // Theme variables
  const theme = {
    bg: isDarkMode ? "bg-[#0A0A0A]" : "bg-[#F8FAFC]",
    text: isDarkMode ? "text-white" : "text-slate-900",
    textMuted: isDarkMode ? "text-white/60" : "text-slate-500",
    textSubtle: isDarkMode ? "text-white/40" : "text-slate-400",
    border: isDarkMode ? "border-white/10" : "border-slate-200",
    cardBg: isDarkMode ? "bg-white/[0.02]" : "bg-white",
    navBg: isDarkMode ? "from-black/80" : "from-[#F8FAFC]/90",
    iconBg: isDarkMode ? "bg-white/5" : "bg-slate-100",
    hoverIconBg: isDarkMode ? "hover:bg-white/10" : "hover:bg-slate-200",
    cardShadow: isDarkMode ? "shadow-none" : "shadow-sm",
  };

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} selection:bg-brand-green/30 font-sans transition-colors duration-500`}>
      {/* Top Navigation */}
      <nav className={`fixed top-0 w-full z-50 bg-gradient-to-b ${theme.navBg} to-transparent p-6 flex justify-between items-center transition-colors duration-500`}>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-brand-green flex items-center justify-center font-bold text-xl text-white shadow-[0_0_20px_rgba(32,116,80,0.3)]">
            K
          </div>
          <div className="hidden sm:block">
            <p className={`text-xs ${theme.textMuted} font-medium tracking-wider uppercase`}>Recording</p>
            <p className="text-sm font-semibold truncate max-w-[200px]">{recordingId}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)} 
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${theme.iconBg} ${theme.hoverIconBg} transition-colors`}
          >
            {isDarkMode ? <Sun className="w-5 h-5 text-white/80" /> : <Moon className="w-5 h-5 text-slate-700" />}
          </button>
          <Button 
            onClick={() => setIsShareModalOpen(true)}
            variant="outline" 
            className={`${theme.iconBg} ${theme.border} ${theme.hoverIconBg} ${isDarkMode ? 'hover:text-white text-white' : 'hover:text-slate-900 text-slate-800'} rounded-xl h-10 px-4 backdrop-blur-md transition-colors`}
          >
            <Share2 className="w-4 h-4 mr-2" /> Share
          </Button>
          <Button className="bg-brand-green hover:bg-[#287854] text-white rounded-xl h-10 px-4 shadow-[0_4px_14px_rgba(32,116,80,0.4)] transition-all">
            Sign In
          </Button>
        </div>
      </nav>

      {/* Main Content Layout */}
      <main className="max-w-[1600px] mx-auto pt-24 pb-12 px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Video Column */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Video Player Container */}
          <div 
            className={`relative w-full aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl ring-1 ${isDarkMode ? 'ring-white/10' : 'ring-black/5'} group`}
          >
            {data?.recording?.url ? (
              <video 
                src={data.recording.url} 
                controls 
                className="w-full h-full object-contain"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-white/50">Video not ready or processing...</p>
              </div>
            )}
          </div>

          {/* Details Section */}
          <div className="space-y-6">
            <div>
              <h1 className={`text-3xl sm:text-4xl font-extrabold ${theme.text} tracking-tight mb-4`}>
                {data?.recording?.title || "Recording"}
              </h1>
              
              <div className={`flex flex-wrap items-center gap-4 text-sm ${theme.textMuted} font-medium`}>
                <div className={`flex items-center gap-1.5 ${theme.iconBg} px-3 py-1.5 rounded-lg border ${theme.border}`}>
                  <Calendar className="w-4 h-4" /> {data?.recording?.createdAt ? new Date(data.recording.createdAt).toLocaleDateString() : 'N/A'}
                </div>
                <div className={`flex items-center gap-1.5 ${theme.iconBg} px-3 py-1.5 rounded-lg border ${theme.border}`}>
                  <Clock className="w-4 h-4" /> {data?.recording?.duration > 0 ? Math.floor(data.recording.duration / 60) + 'm ' + (data.recording.duration % 60) + 's' : 'Unknown Duration'}
                </div>
                <div className={`flex items-center gap-1.5 ${theme.iconBg} px-3 py-1.5 rounded-lg border ${theme.border}`}>
                  <Users className="w-4 h-4" /> {data?.recording?.room?.name || 'N/A'}
                </div>
                <div className={`flex items-center gap-1.5 ${theme.iconBg} px-3 py-1.5 rounded-lg border ${theme.border}`}>
                  <span className="w-2 h-2 rounded-full bg-brand-green animate-pulse" />
                  Hosted by {data?.recording?.owner?.name || data?.recording?.owner?.email || 'Unknown'}
                </div>
              </div>
            </div>

            <div className={`p-6 rounded-2xl ${theme.cardBg} border ${theme.border} ${theme.cardShadow}`}>
              <h3 className={`text-lg font-semibold mb-2 flex items-center gap-2 ${theme.text}`}>
                <Info className="w-5 h-5 text-brand-green" /> Summary
              </h3>
              <p className={`${theme.textMuted} leading-relaxed`}>
                {data?.summary?.summary || "No AI summary available for this recording."}
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          {/* Action Cards */}
          <div className={`p-6 rounded-3xl ${theme.cardBg} border ${theme.border} backdrop-blur-md ${theme.cardShadow}`}>
            <h3 className={`text-lg font-semibold mb-4 ${theme.text}`}>Recording Options</h3>
            <div className="space-y-3">
              <Button onClick={() => window.open(data?.recording?.url, '_blank')} className={`w-full h-12 ${theme.iconBg} ${theme.hoverIconBg} ${theme.text} justify-start px-4 border ${theme.border} rounded-xl transition-all shadow-none`}>
                <Download className="w-4 h-4 mr-3 text-brand-green" /> Download Recording
              </Button>
              <Button 
                onClick={() => setIsChatOpen(true)}
                className={`w-full h-12 ${theme.iconBg} ${theme.hoverIconBg} ${theme.text} justify-start px-4 border ${theme.border} rounded-xl transition-all shadow-none`}
              >
                <MessageSquare className="w-4 h-4 mr-3 text-brand-green" /> View Meeting Chat ({data?.chatMessages?.length || 0})
              </Button>
            </div>
          </div>

          {/* Action Items */}
          <div className={`p-6 rounded-3xl ${theme.cardBg} border ${theme.border} backdrop-blur-md ${theme.cardShadow}`}>
            <h3 className={`text-lg font-semibold mb-4 ${theme.text}`}>Action Items</h3>
            <div className="space-y-1">
              {data?.summary?.actionItems ? (
                 <p className={`text-sm ${theme.textMuted} whitespace-pre-wrap`}>{data.summary.actionItems}</p>
              ) : (
                 <p className={`text-sm ${theme.textMuted}`}>No action items available.</p>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Chat Sidebar Overlay */}
      <AnimatePresence>
        {isChatOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
              onClick={() => setIsChatOpen(false)}
            />
            {/* Sidebar */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={`fixed right-0 top-0 h-full w-full max-w-[400px] z-50 ${theme.bg} border-l ${theme.border} shadow-2xl flex flex-col`}
            >
              <div className={`p-6 border-b ${theme.border} flex items-center justify-between`}>
                <h3 className={`text-lg font-bold ${theme.text} flex items-center gap-2`}>
                  <MessageSquare className="w-5 h-5 text-brand-green" /> Meeting Chat
                </h3>
                <button 
                  onClick={() => setIsChatOpen(false)}
                  className={`p-2 rounded-lg ${theme.hoverIconBg} ${theme.textMuted} transition-colors`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {data?.chatMessages?.length > 0 ? (
                  data.chatMessages.map((msg: any, i: number) => (
                    <div key={i} className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-brand-green/20 flex items-center justify-center font-bold text-brand-green shrink-0">
                        {msg.senderName?.charAt(0) || "U"}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-baseline justify-between mb-1">
                          <span className={`font-semibold text-sm ${theme.text}`}>{msg.senderName}</span>
                          <span className={`text-xs ${theme.textSubtle}`}>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className={`text-sm ${theme.textMuted} leading-relaxed ${isDarkMode ? 'bg-white/5' : 'bg-black/5'} p-3 rounded-xl rounded-tl-none`}>
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className={`text-sm ${theme.textMuted} text-center mt-10`}>No chat messages found for this meeting.</p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Share Link Modal */}
      <Modal 
        isOpen={isShareModalOpen} 
        onClose={() => setIsShareModalOpen(false)}
        className={isDarkMode ? 'bg-[#111] border-white/10' : 'bg-white border-slate-200'}
      >
        <div className="flex flex-col gap-6">
          <div>
            <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Share Recording</h2>
            <p className={`text-sm ${isDarkMode ? 'text-white/60' : 'text-slate-500'} mt-1`}>
              Copy the link below to share this recording.
            </p>
          </div>

          <div className={`p-4 rounded-xl border ${isDarkMode ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50'} space-y-3`}>
            <div className="flex gap-2">
              <input 
                value={typeof window !== 'undefined' ? window.location.href : ''} 
                readOnly 
                className={`flex-1 px-4 py-2 rounded-xl border outline-none ${isDarkMode ? 'bg-black/20 text-white border-white/10' : 'bg-white text-slate-900 border-slate-200'}`} 
              />
              <Button 
                onClick={() => {
                  navigator.clipboard.writeText(typeof window !== 'undefined' ? window.location.href : '');
                }}
                className="h-10 bg-brand-green hover:bg-[#287854] shrink-0 text-white rounded-xl"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
