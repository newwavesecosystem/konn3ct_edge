import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Facebook,
  Github,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  Mic,
  Music2,
  Twitter,
  UserRound,
  Youtube,
} from "lucide-react";

import logo from "../../assets/konn3ct_logo.png";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { cn } from "../../lib/utils";
import { podcasts, profileData, sessions, socialLinks } from "./profileData";
import AboutTab from "./AboutTab";
import BookingTab from "./BookingTab";
import PodcastTab from "./PodcastTab";

const BRAND_GREEN = "#227451";

const socialIconMap = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  music: Music2,
  youtube: Youtube,
  twitter: Twitter,
  github: Github,
  globe: Globe,
};

const tabs = [
  { id: "booking", label: "Booking", icon: CalendarDays },
  { id: "podcast", label: "Podcast", icon: Mic },
  { id: "about", label: "About", icon: UserRound },
];

function ViewProfile() {
  const [activeTab, setActiveTab] = useState("about");
  const [selectedSession, setSelectedSession] = useState(sessions[0].id);
  const [selectedTime, setSelectedTime] = useState(1);

  const currentPodcast = useMemo(
    () => podcasts.find((podcast) => podcast.active) ?? podcasts[0],
    []
  );

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <header className="border-b border-border/80 bg-background/95 px-4 py-5 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            aria-label="Back to dashboard home"
            title="Back to dashboard home"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </Link>
          <Link to="/" aria-label="Go to dashboard" className="shrink-0">
            <img src={logo} alt="Konn3ct logo" className="h-8 w-auto" />
          </Link>
          <div className="w-[136px]" aria-hidden="true" />
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-74px)] w-full max-w-[1120px] flex-col px-3 pb-10 pt-6 sm:px-5 md:pt-7">
        <Card className="rounded-[24px] border-border/70 bg-card px-5 py-6 shadow-[0_8px_24px_hsl(var(--foreground)/0.06)] sm:px-8 md:px-9">
          <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col items-center gap-4 text-center lg:flex-row lg:items-center lg:text-left">
              <Avatar className="h-[82px] w-[82px] border border-border/70">
                <AvatarImage
                  src={profileData.avatar}
                  alt={`${profileData.name} profile`}
                  className="object-cover"
                />
                <AvatarFallback>{profileData.initials}</AvatarFallback>
              </Avatar>

              <div className="max-w-[560px]">
                <div className="flex items-center justify-center gap-2 lg:justify-start">
                  <h1 className="text-[24px] font-semibold leading-none text-foreground">
                    {profileData.name}
                  </h1>
                  <BadgeCheck
                    className="h-5 w-5 fill-current"
                    style={{ color: BRAND_GREEN }}
                    aria-label="Verified"
                  />
                </div>
                <p className="mt-3 max-w-[520px] text-[15px] leading-[1.45] text-muted-foreground">
                  {profileData.bio}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                  {socialLinks.map(({ id, label, href }) => {
                    const Icon = socialIconMap[id];

                    return (
                      <a
                        key={id}
                        href={href}
                        aria-label={label}
                        title={label}
                        className="text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Icon className="h-[17px] w-[17px]" strokeWidth={2} />
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 sm:max-w-[260px] lg:w-[245px]">
              <Button
                className="h-12 w-full rounded-full text-[16px] font-medium shadow-none"
                style={{ backgroundColor: BRAND_GREEN }}
              >
                {profileData.primaryActionLabel}
              </Button>
              <Button
                variant="outline"
                className="h-12 w-full rounded-full border-border/80 bg-background text-[16px] font-medium text-foreground shadow-none hover:bg-accent/40 hover:text-foreground"
              >
                <Mail className="h-4 w-4" />
                {profileData.emailLabel}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="mt-4 flex flex-1 flex-col rounded-[24px] border-border/70 bg-card px-3 py-3 shadow-[0_8px_24px_hsl(var(--foreground)/0.05)] sm:mt-5 sm:px-4 sm:py-4 md:px-5 md:py-5">
          <div className="border-b border-border/70 px-1">
            <div className="grid grid-cols-3">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center justify-center gap-2 border-b-2 px-2 py-3 text-sm font-medium transition-colors",
                      isActive
                        ? "border-current"
                        : "border-transparent text-muted-foreground"
                    )}
                    style={isActive ? { color: BRAND_GREEN } : undefined}
                    aria-pressed={isActive}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 px-1 pb-1 pt-4 sm:px-2 sm:pt-5">
            {activeTab === "about" && <AboutTab />}
            {activeTab === "booking" && (
              <BookingTab
                selectedSession={selectedSession}
                setSelectedSession={setSelectedSession}
                selectedTime={selectedTime}
                setSelectedTime={setSelectedTime}
              />
            )}
            {activeTab === "podcast" && <PodcastTab currentPodcast={currentPodcast} />}
          </div>
        </Card>
      </main>

      <footer className="border-t border-border/80 px-4 py-5 text-center text-[13px] text-muted-foreground">
        <p>&copy; 2025 Newwaves ecosystem. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default ViewProfile;
