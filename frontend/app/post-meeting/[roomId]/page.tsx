"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Star, ArrowLeft, LogIn, LayoutDashboard } from "lucide-react";

export default function PostMeetingPage({ params }: { params: Promise<{ roomId: string }> }) {
  const resolvedParams = React.use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);
  
  const [role, setRole] = useState<string>("guest");
  const [logoutUrl, setLogoutUrl] = useState<string | null>(null);

  useEffect(() => {
    // Read parameters passed from the exit logic
    const roleParam = searchParams.get("role");
    const logoutParam = searchParams.get("logoutUrl");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (roleParam) setRole(roleParam);
    if (logoutParam) setLogoutUrl(logoutParam);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
      const response = await fetch(`${apiUrl}/rooms/${resolvedParams.roomId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, feedback })
      });

      if (!response.ok) {
        console.error("Failed to submit feedback:", await response.text());
      }
    } catch (error) {
      console.error("Error submitting feedback:", error);
    } finally {
      setSubmitted(true);
    }
  };

  const handleReturnToDashboard = () => {
    if (logoutUrl) {
      window.location.href = logoutUrl;
    } else {
      router.push("/dashboard");
    }
  };

  const isGuest = role === "guest" || role === "attendee";

  return (
    <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center p-4 text-white font-sans">
      <div className="max-w-xl w-full bg-[#1a1a2e] rounded-3xl p-8 shadow-2xl border border-white/5 relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-brand-green/20 blur-[100px] pointer-events-none rounded-full" />
        
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-center mb-2">Meeting Ended</h1>
          <p className="text-center text-white/60 mb-8">
            Thank you for participating! How was your experience?
          </p>

          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className="p-1 transition-transform hover:scale-110 focus:outline-none"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(star)}
                    >
                      <Star
                        className={`w-10 h-10 ${
                          star <= (hoverRating || rating)
                            ? "fill-yellow-400 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]"
                            : "text-white/20"
                        } transition-colors`}
                      />
                    </button>
                  ))}
                </div>
                <p className="text-sm text-white/50 h-5">
                  {rating > 0 ? ["Poor", "Fair", "Good", "Very Good", "Excellent"][rating - 1] : "Select a rating"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Additional Feedback (Optional)
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-brand-green/50 resize-none"
                  rows={4}
                  placeholder="Tell us what you liked or how we can improve..."
                />
              </div>

              <button
                type="submit"
                disabled={rating === 0}
                className="w-full py-3.5 bg-brand-green text-white font-medium rounded-xl hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-green/20"
              >
                Submit Feedback
              </button>
            </form>
          ) : (
            <div className="text-center py-8 space-y-4 bg-white/5 rounded-2xl border border-white/10">
              <div className="w-16 h-16 bg-brand-green/20 text-brand-green rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 fill-brand-green" />
              </div>
              <h2 className="text-xl font-bold">Feedback Received!</h2>
              <p className="text-white/60">Your insights help us make {process.env.NEXT_PUBLIC_APP_NAME || 'Konn3ct'} better.</p>
            </div>
          )}

          <div className="mt-10 pt-8 border-t border-white/10 flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push(`/meeting/${resolvedParams.roomId}`)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-medium bg-white/5 hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Rejoin Session
            </button>

            {isGuest ? (
              process.env.NEXT_PUBLIC_HIDE_SIGNUP_BUTTON === 'true' ? null : (
                <button
                  onClick={() => router.push('/register')}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-medium bg-blue-600 hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20"
                >
                  <LogIn className="w-4 h-4" /> Sign Up Free
                </button>
              )
            ) : (
              <button
                onClick={handleReturnToDashboard}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-medium bg-white/5 hover:bg-white/10 transition-colors"
              >
                <LayoutDashboard className="w-4 h-4" /> Return to Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
