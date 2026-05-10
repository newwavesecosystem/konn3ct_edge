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

// Mock data for the recording
const recordingData = {
  title: "Q3 Planning Session & Strategy Sync",
  date: "October 15, 2026",
  duration: "1h 15m",
  host: "Alex Reynolds",
  views: 245,
  description: "Quarterly planning session covering our product roadmap, marketing strategy, and resource allocation for the upcoming quarter.",
  chapters: [
    { title: "Introduction & Welcome", time: "0:00" },
    { title: "Review of Q2 Metrics", time: "5:30" },
    { title: "Product Roadmap Q3", time: "22:15" },
    { title: "Marketing Strategy", time: "45:00" },
    { title: "Q&A Session", time: "1:05:00" }
  ]
};

const mockChat = [
  { user: "Alex Reynolds", time: "11:05 AM", message: "Hey everyone, thanks for joining! We'll start in a minute." },
  { user: "Sarah Chen", time: "11:06 AM", message: "Hi Alex! Looking forward to the Q3 update." },
  { user: "Marcus Johnson", time: "11:15 AM", message: "Can you share the slides after the call?" },
  { user: "Alex Reynolds", time: "11:16 AM", message: "Yes, I'll drop the link in the #general channel." },
  { user: "Elena Rodriguez", time: "11:45 AM", message: "The marketing numbers look fantastic." }
];

export default function RecordingViewerPage({ params }: { params: Promise<{ recordingId: string }> }) {
  const { recordingId } = use(params);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  useEffect(() => {
    // Simulate loading state
    const timer = setTimeout(() => setIsLoaded(true), 800);
    return () => clearTimeout(timer);
  }, []);

  // Simulate progress when playing
  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        setProgress(p => (p >= 100 ? 0 : p + 0.1));
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isPlaying]);

  let timeout: NodeJS.Timeout;
  const handleMouseMove = () => {
    setShowControls(true);
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 2500);
  };

  if (!isLoaded) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-[#0A0A0A]' : 'bg-[#F8FAFC]'} flex items-center justify-center transition-colors duration-500`}>
        <div className="w-12 h-12 border-4 border-brand-green/30 border-t-brand-green rounded-full animate-spin" />
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
            onMouseMove={handleMouseMove}
            onMouseLeave={() => isPlaying && setShowControls(false)}
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {/* Mock Video Content (Poster/Gradient) */}
            <div className="absolute inset-0 bg-gradient-to-br from-brand-green/20 via-[#0A0A0A] to-emerald-500/20" />
            
            {/* Play overlay animation */}
            <AnimatePresence>
              {!isPlaying && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.2 }}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10"
                >
                  <div className="w-20 h-20 rounded-full bg-brand-green/90 flex items-center justify-center pl-2 shadow-[0_0_40px_rgba(32,116,80,0.5)] cursor-pointer hover:scale-110 transition-transform">
                    <Play className="w-10 h-10 text-white" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Custom Controls */}
            <AnimatePresence>
              {showControls && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute bottom-0 w-full px-6 pb-6 pt-24 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-20"
                  onClick={e => e.stopPropagation()}
                >
                  {/* Progress Bar */}
                  <div className="relative h-1.5 w-full bg-white/20 rounded-full mb-4 overflow-hidden cursor-pointer group/progress">
                    <div 
                      className="absolute h-full bg-brand-green rounded-full" 
                      style={{ width: `${progress}%` }} 
                    />
                    {/* Hover state for progress bar could go here */}
                  </div>

                  {/* Controls Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button onClick={() => setIsPlaying(!isPlaying)} className="text-white hover:text-brand-green transition-colors">
                        {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                      </button>
                      <button onClick={() => setIsMuted(!isMuted)} className="text-white hover:text-brand-green transition-colors">
                        {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                      </button>
                      <span className="text-sm font-medium text-white/80 tabular-nums">
                        {Math.floor(progress * 45 / 100)}:{(Math.floor(progress * 45 % 60)).toString().padStart(2, '0')} / 45:00
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <button className="text-white/80 hover:text-white transition-colors">
                        <Settings className="w-5 h-5" />
                      </button>
                      <button className="text-white/80 hover:text-white transition-colors">
                        <Maximize className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Details Section */}
          <div className="space-y-6">
            <div>
              <h1 className={`text-3xl sm:text-4xl font-extrabold ${theme.text} tracking-tight mb-4`}>
                {recordingData.title}
              </h1>
              
              <div className={`flex flex-wrap items-center gap-4 text-sm ${theme.textMuted} font-medium`}>
                <div className={`flex items-center gap-1.5 ${theme.iconBg} px-3 py-1.5 rounded-lg border ${theme.border}`}>
                  <Calendar className="w-4 h-4" /> {recordingData.date}
                </div>
                <div className={`flex items-center gap-1.5 ${theme.iconBg} px-3 py-1.5 rounded-lg border ${theme.border}`}>
                  <Clock className="w-4 h-4" /> {recordingData.duration}
                </div>
                <div className={`flex items-center gap-1.5 ${theme.iconBg} px-3 py-1.5 rounded-lg border ${theme.border}`}>
                  <Users className="w-4 h-4" /> {recordingData.views} views
                </div>
                <div className={`flex items-center gap-1.5 ${theme.iconBg} px-3 py-1.5 rounded-lg border ${theme.border}`}>
                  <span className="w-2 h-2 rounded-full bg-brand-green animate-pulse" />
                  Hosted by {recordingData.host}
                </div>
              </div>
            </div>

            <div className={`p-6 rounded-2xl ${theme.cardBg} border ${theme.border} ${theme.cardShadow}`}>
              <h3 className={`text-lg font-semibold mb-2 flex items-center gap-2 ${theme.text}`}>
                <Info className="w-5 h-5 text-brand-green" /> Description
              </h3>
              <p className={`${theme.textMuted} leading-relaxed`}>
                {recordingData.description}
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
              <Button className={`w-full h-12 ${theme.iconBg} ${theme.hoverIconBg} ${theme.text} justify-start px-4 border ${theme.border} rounded-xl transition-all shadow-none`}>
                <Download className="w-4 h-4 mr-3 text-brand-green" /> Download Recording (840 MB)
              </Button>
              <Button 
                onClick={() => setIsChatOpen(true)}
                className={`w-full h-12 ${theme.iconBg} ${theme.hoverIconBg} ${theme.text} justify-start px-4 border ${theme.border} rounded-xl transition-all shadow-none`}
              >
                <MessageSquare className="w-4 h-4 mr-3 text-brand-green" /> View Meeting Chat
              </Button>
            </div>
          </div>

          {/* Chapters */}
          <div className={`p-6 rounded-3xl ${theme.cardBg} border ${theme.border} backdrop-blur-md ${theme.cardShadow}`}>
            <h3 className={`text-lg font-semibold mb-4 ${theme.text}`}>Chapters</h3>
            <div className="space-y-1">
              {recordingData.chapters.map((chapter, i) => (
                <div 
                  key={i} 
                  className={`group flex items-center justify-between p-3 rounded-xl ${theme.hoverIconBg} cursor-pointer transition-colors`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-6 text-xs font-mono text-brand-green/80 group-hover:text-brand-green transition-colors`}>
                      {i + 1}.
                    </span>
                    <span className={`text-sm ${theme.textMuted} group-hover:${isDarkMode ? 'text-white' : 'text-slate-900'} truncate transition-colors`}>
                      {chapter.title}
                    </span>
                  </div>
                  <span className={`text-xs font-mono ${theme.textSubtle} ${isDarkMode ? 'bg-black/50 group-hover:text-white/80' : 'bg-slate-200 group-hover:text-slate-700'} px-2 py-1 rounded-md transition-colors`}>
                    {chapter.time}
                  </span>
                </div>
              ))}
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
                {mockChat.map((msg, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-brand-green/20 flex items-center justify-center font-bold text-brand-green shrink-0">
                      {msg.user.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between mb-1">
                        <span className={`font-semibold text-sm ${theme.text}`}>{msg.user}</span>
                        <span className={`text-xs ${theme.textSubtle}`}>{msg.time}</span>
                      </div>
                      <p className={`text-sm ${theme.textMuted} leading-relaxed ${isDarkMode ? 'bg-white/5' : 'bg-black/5'} p-3 rounded-xl rounded-tl-none`}>
                        {msg.message}
                      </p>
                    </div>
                  </div>
                ))}
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
              <Input 
                value={typeof window !== 'undefined' ? window.location.href : ''} 
                readOnly 
                className={`h-10 ${isDarkMode ? 'bg-black/20 text-white border-white/10' : 'bg-white text-slate-900 border-slate-200'}`} 
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
