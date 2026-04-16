import React from "react";
import { Monitor, Moon, SunMedium } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import {
  Tabs,
  TabsTrigger,
  TabsList,
  TabsContent,
} from "../components/ui/tabs";
import useTheme from "../hooks/useTheme";
import { capitalize, cn } from "../lib/utils";

const SETTINGS_TEXT = {
  title: "Settings",
  description:
    "Manage your dashboard preferences and keep your workspace comfortable.",
  tabs: {
    general: "General",
    meeting: "Meeting",
    recording: "Recording",
    audioConference: "Audio Conference",
    whiteBoard: "White Board",
    scheduling: "Scheduling",
  },
  appearance: {
    title: "Appearance",
    description:
      "Choose how the dashboard looks. Select light mode, dark mode, or sync with your system.",
    activeTheme: "Active theme",
    systemTheme: (mode) => `System (${mode})`,
    currentlyFollowing: (mode) =>
      `Currently following your device and resolving to ${mode} mode.`,
  },
  additionalSettings:
    "Additional dashboard settings can expand here later without changing how theme state is stored or applied.",
  placeholders: {
    meeting: "Meeting-related controls will appear here in a future update.",
    recording: "Recording preferences will appear here in a future update.",
    audioConference:
      "Audio conference preferences will appear here in a future update.",
    whiteBoard: "White board preferences will appear here in a future update.",
    scheduling: "Scheduling preferences will appear here in a future update.",
  },
  themes: {
    light: {
      label: "Light",
      description:
        "Use a brighter interface with crisp surfaces and higher daylight visibility.",
    },
    dark: {
      label: "Dark",
      description:
        "Reduce glare with deeper surfaces that are easier on the eyes at night.",
    },
    system: {
      label: "System",
      description:
        "Sync automatically with your device preference and react to system changes.",
    },
  },
};

const SettingsPlaceholder = ({ title, description }) => {
  return (
    <Card className="border-dashed border-border/70 bg-muted/20 shadow-none">
      <CardContent className="space-y-2 p-5 sm:p-6">
        <h4 className="text-base font-semibold">{title}</h4>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
};

const Settings = () => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const systemModeLabel = capitalize(resolvedTheme);

  const themeOptions = [
    {
      value: "light",
      label: SETTINGS_TEXT.themes.light.label,
      icon: SunMedium,
      description: SETTINGS_TEXT.themes.light.description,
    },
    {
      value: "dark",
      label: SETTINGS_TEXT.themes.dark.label,
      icon: Moon,
      description: SETTINGS_TEXT.themes.dark.description,
    },
    {
      value: "system",
      label: SETTINGS_TEXT.themes.system.label,
      icon: Monitor,
      description: SETTINGS_TEXT.themes.system.description,
    },
  ];

  return (
    <section className="container mx-auto page">
      <Card className="h-full overflow-hidden border-border/70 bg-card/95 px-0 py-0 shadow-sm transition-colors duration-300">
        <div className="flex items-center gap-20 p-4 pt-8 md:flex-col md:items-start md:gap-4 lg:flex-row lg:items-center lg:gap-20 lg:px-8 lg:pt-10">
          <div>
            <h3 className="text-xl font-semibold">{SETTINGS_TEXT.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {SETTINGS_TEXT.description}
            </p>
          </div>
        </div>
        <Tabs defaultValue="general" className="w-full">
          <Separator />
          <div className="px-4 py-4 lg:px-8">
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 rounded-2xl bg-muted/50 p-2 md:grid md:grid-cols-2 lg:flex lg:justify-between">
              <TabsTrigger
                className="w-full rounded-xl px-4 py-2 text-sm md:w-full lg:w-auto"
                value="general"
              >
                {SETTINGS_TEXT.tabs.general}
              </TabsTrigger>
              <TabsTrigger
                className="w-full rounded-xl px-4 py-2 text-sm md:w-full lg:w-auto"
                value="meeting"
              >
                {SETTINGS_TEXT.tabs.meeting}
              </TabsTrigger>
              <TabsTrigger
                className="w-full rounded-xl px-4 py-2 text-sm md:w-full lg:w-auto"
                value="recording"
              >
                {SETTINGS_TEXT.tabs.recording}
              </TabsTrigger>
              <TabsTrigger
                className="w-full rounded-xl px-4 py-2 text-sm md:w-full lg:w-auto"
                value="audio"
              >
                {SETTINGS_TEXT.tabs.audioConference}
              </TabsTrigger>
              <TabsTrigger
                className="w-full rounded-xl px-4 py-2 text-sm md:w-full lg:w-auto"
                value="whiteBoard"
              >
                {SETTINGS_TEXT.tabs.whiteBoard}
              </TabsTrigger>
              <TabsTrigger
                className="w-full rounded-xl px-4 py-2 text-sm md:w-full lg:w-auto"
                value="scheduling"
              >
                {SETTINGS_TEXT.tabs.scheduling}
              </TabsTrigger>
            </TabsList>
          </div>
          <Separator />
          <TabsContent value="general" className="m-0">
            <div className="space-y-6 px-4 py-6 lg:px-8 lg:py-8">
              <Card className="border-border/70 bg-card shadow-sm">
                <CardHeader className="gap-4 p-5 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <CardTitle className="text-xl">
                        {SETTINGS_TEXT.appearance.title}
                      </CardTitle>
                      <CardDescription className="max-w-2xl text-sm leading-6">
                        {SETTINGS_TEXT.appearance.description}
                      </CardDescription>
                    </div>
                    <div className="inline-flex items-center rounded-full border border-border bg-muted/60 px-4 py-2 text-sm text-muted-foreground">
                      {SETTINGS_TEXT.appearance.activeTheme}
                      :&nbsp;
                      <span className="font-medium text-foreground">
                        {theme === "system"
                          ? SETTINGS_TEXT.appearance.systemTheme(
                              systemModeLabel
                            )
                          : capitalize(theme)}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 p-5 pt-0 sm:grid-cols-2 sm:p-6 sm:pt-0 lg:grid-cols-3">
                  {themeOptions.map(({ value, label, icon: Icon, description }) => {
                    const isSelected = theme === value;

                    return (
                      <label
                        key={value}
                        className={cn(
                          "group relative flex cursor-pointer flex-col rounded-2xl border p-5 shadow-sm transition-colors duration-300 focus-within:ring-2 focus-within:ring-ring",
                          isSelected
                            ? "border-primary/40 bg-primary/5 shadow"
                            : "border-border/70 bg-background hover:bg-muted/50"
                        )}
                      >
                        <input
                          checked={isSelected}
                          className="sr-only"
                          name="theme"
                          onChange={() => setTheme(value)}
                          type="radio"
                          value={value}
                        />
                        <div className="flex items-start gap-4">
                          <div
                            className={cn(
                              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
                              isSelected
                                ? "border-primary/30 bg-primary text-primary-foreground"
                                : "border-border bg-muted/60 text-muted-foreground group-hover:text-foreground"
                            )}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-base font-semibold text-foreground">
                                {label}
                              </span>
                              <span
                                className={cn(
                                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
                                  isSelected
                                    ? "border-primary bg-primary"
                                    : "border-border bg-background"
                                )}
                              >
                                <span
                                  className={cn(
                                    "h-2.5 w-2.5 rounded-full transition-colors duration-300",
                                    isSelected
                                      ? "bg-primary-foreground"
                                      : "bg-transparent"
                                  )}
                                />
                              </span>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                              {description}
                            </p>
                          </div>
                        </div>
                        {value === "system" && (
                          <p className="mt-4 text-xs leading-5 text-muted-foreground">
                            {SETTINGS_TEXT.appearance.currentlyFollowing(
                              systemModeLabel.toLowerCase()
                            )}
                          </p>
                        )}
                      </label>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="border-dashed border-border/70 bg-muted/20 shadow-none">
                <CardContent className="space-y-2 p-5 sm:p-6">
                  <p className="text-sm text-muted-foreground">
                    {SETTINGS_TEXT.additionalSettings}
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent
            value="meeting"
            className="m-0 px-4 py-6 lg:px-8 lg:py-8"
          >
            <SettingsPlaceholder
              description={SETTINGS_TEXT.placeholders.meeting}
              title={SETTINGS_TEXT.tabs.meeting}
            />
          </TabsContent>
          <TabsContent
            value="recording"
            className="m-0 px-4 py-6 lg:px-8 lg:py-8"
          >
            <SettingsPlaceholder
              description={SETTINGS_TEXT.placeholders.recording}
              title={SETTINGS_TEXT.tabs.recording}
            />
          </TabsContent>
          <TabsContent
            value="audio"
            className="m-0 px-4 py-6 lg:px-8 lg:py-8"
          >
            <SettingsPlaceholder
              description={SETTINGS_TEXT.placeholders.audioConference}
              title={SETTINGS_TEXT.tabs.audioConference}
            />
          </TabsContent>
          <TabsContent
            value="whiteBoard"
            className="m-0 px-4 py-6 lg:px-8 lg:py-8"
          >
            <SettingsPlaceholder
              description={SETTINGS_TEXT.placeholders.whiteBoard}
              title={SETTINGS_TEXT.tabs.whiteBoard}
            />
          </TabsContent>
          <TabsContent
            value="scheduling"
            className="m-0 px-4 py-6 lg:px-8 lg:py-8"
          >
            <SettingsPlaceholder
              description={SETTINGS_TEXT.placeholders.scheduling}
              title={SETTINGS_TEXT.tabs.scheduling}
            />
          </TabsContent>
        </Tabs>
      </Card>
    </section>
  );
};

export default Settings;
