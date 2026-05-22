import { ChevronLeft, ChevronRight, Globe } from "lucide-react";

import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import {
  availableDates,
  calendarRows,
  sessions,
  timeSlots,
} from "./profileData";

const BRAND_GREEN = "#227451";
const BRAND_GREEN_TINT = "#E7F5EE";

function BookingTab({
  selectedSession,
  setSelectedSession,
  selectedTime,
  setSelectedTime,
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[0.86fr_1.14fr]">
      <section className="rounded-[18px] border border-border/70 bg-background/40 p-4 sm:p-5">
        <h2 className="text-[22px] font-semibold text-foreground">Book a Session</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Choose a session type that works for you.
        </p>

        <div className="mt-5 space-y-3">
          {sessions.map((session) => {
            const isSelected = selectedSession === session.id;

            return (
              <button
                key={session.id}
                type="button"
                onClick={() => setSelectedSession(session.id)}
                className="flex w-full items-start justify-between rounded-[12px] border px-4 py-3 text-left transition-colors"
                style={{
                  borderColor: isSelected ? BRAND_GREEN : "hsl(var(--border))",
                  backgroundColor: isSelected
                    ? BRAND_GREEN_TINT
                    : "hsl(var(--background))",
                }}
              >
                <div className="pr-4">
                  <p
                    className="text-[15px] font-medium"
                    style={{ color: isSelected ? BRAND_GREEN : "#4A4A4A" }}
                  >
                    {session.title}
                  </p>
                  <p className="text-[12px] text-muted-foreground">{session.duration}</p>
                  <p className="mt-2 max-w-[228px] text-[12px] leading-[1.45] text-muted-foreground">
                    {session.description}
                  </p>
                </div>
                <span className="pt-1 text-[13px] font-medium text-foreground/80">
                  {session.price}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-[18px] border border-border/70 bg-background/40 p-4 sm:p-5">
        <h2 className="text-[22px] font-semibold text-foreground">
          Select a Date & Time
        </h2>

        <div className="mt-6 rounded-[14px]">
          <div className="flex items-center justify-between px-2">
            <button type="button" aria-label="Previous month" className="text-muted-foreground">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-[16px] font-medium text-foreground">April 2024</p>
            <button
              type="button"
              aria-label="Next month"
              className="rounded-full p-2 text-white shadow-sm"
              style={{ backgroundColor: "#DDF4E8", color: BRAND_GREEN }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-7 gap-y-4 text-center text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="mt-4 space-y-4">
            {calendarRows.map((week, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-7 place-items-center text-[15px] text-foreground/80">
                {week.map((day, dayIndex) => {
                  const isAvailable = day && availableDates.includes(day);

                  return (
                    <div key={`${rowIndex}-${dayIndex}`} className="flex h-10 w-10 items-center justify-center">
                      {day ? (
                        <span
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-full",
                            isAvailable ? "font-medium" : ""
                          )}
                          style={
                            isAvailable
                              ? {
                                  backgroundColor: "#DDF4E8",
                                  color: BRAND_GREEN,
                                }
                              : undefined
                          }
                        >
                          {day}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <p className="text-[14px] font-semibold text-foreground">Time zone</p>
          <p className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground">
            <Globe className="h-4 w-4" />
            Central European Time (8:11pm)
          </p>
        </div>

        <div className="mt-6">
          <p className="text-[14px] font-semibold text-foreground">April 22, 2024</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {timeSlots.map((slot, index) => {
              const isSelected = selectedTime === index;

              return (
                <button
                  key={`${slot}-${index}`}
                  type="button"
                  onClick={() => setSelectedTime(index)}
                  className="h-10 rounded-[10px] border bg-background text-[12px] font-medium"
                  style={{
                    borderColor: isSelected ? BRAND_GREEN : "hsl(var(--border))",
                    backgroundColor: isSelected
                      ? BRAND_GREEN_TINT
                      : "hsl(var(--background))",
                    color: isSelected ? BRAND_GREEN : "hsl(var(--muted-foreground))",
                  }}
                >
                  {slot}
                </button>
              );
            })}
          </div>
        </div>

        <Button
          className="mt-6 h-11 w-full rounded-[10px] text-[14px] font-medium shadow-none"
          style={{ backgroundColor: BRAND_GREEN }}
        >
          Continue to Book
        </Button>
      </section>
    </div>
  );
}

export default BookingTab;
