import React from "react";
import { Monitor, Moon, SunMedium } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "../components/ui/select";
import { Separator } from "../components/ui/separator";
import { Tabs, TabsTrigger, TabsList, TabsContent } from "../components/ui/tabs";
import { SUPPORTED_LANGUAGES } from "../constants/languages";
import useTheme from "../hooks/useTheme";
import { capitalize, cn } from "../lib/utils";

const Settings = () => {
  const { t, i18n } = useTranslation();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const systemModeLabel = capitalize(resolvedTheme);
  const normalizedResolvedLanguage = (i18n.resolvedLanguage || "").split("-")[0];
  const normalizedLanguage = (i18n.language || "").split("-")[0];
  const activeLanguageCode = SUPPORTED_LANGUAGES.some(
    (language) => language.code === normalizedResolvedLanguage
  )
    ? normalizedResolvedLanguage
    : SUPPORTED_LANGUAGES.some((language) => language.code === normalizedLanguage)
      ? normalizedLanguage
      : "en";
  const activeLanguageLabel =
    SUPPORTED_LANGUAGES.find((language) => language.code === activeLanguageCode)
      ?.name || "English";

  const themeOptions = [
    {
      value: "light",
      labelKey: "settings.appearance.options.light.label",
      icon: SunMedium,
      descriptionKey: "settings.appearance.options.light.description",
    },
    {
      value: "dark",
      labelKey: "settings.appearance.options.dark.label",
      icon: Moon,
      descriptionKey: "settings.appearance.options.dark.description",
    },
    {
      value: "system",
      labelKey: "settings.appearance.options.system.label",
      icon: Monitor,
      descriptionKey: "settings.appearance.options.system.description",
    },
  ];

  return (
    <section className="container mx-auto page">
      <Card className="h-full overflow-hidden border-border/70 bg-card/95 px-0 py-0 shadow-sm transition-colors duration-300">
        <div className="flex items-center gap-20 p-4 pt-8 md:flex-col md:items-start md:gap-4 lg:flex-row lg:items-center lg:gap-20 lg:px-8 lg:pt-10">
          <div>
            <h3 className="text-xl font-semibold">{t("settings.title")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("settings.description")}
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
                {t("settings.tabs.general")}
              </TabsTrigger>
              {/*
              <TabsTrigger
                className="w-full rounded-xl px-4 py-2 text-sm md:w-full lg:w-auto"
                value="meeting"
              >
                Meeting
              </TabsTrigger>
              <TabsTrigger
                className="w-full rounded-xl px-4 py-2 text-sm md:w-full lg:w-auto"
                value="recording"
              >
                Recording
              </TabsTrigger>
              <TabsTrigger
                className="w-full rounded-xl px-4 py-2 text-sm md:w-full lg:w-auto"
                value="audio"
              >
                Audio Conference
              </TabsTrigger>
              <TabsTrigger
                className="w-full rounded-xl px-4 py-2 text-sm md:w-full lg:w-auto"
                value="whiteBoard"
              >
                White Board
              </TabsTrigger>
              <TabsTrigger
                className="w-full rounded-xl px-4 py-2 text-sm md:w-full lg:w-auto"
                value="scheduling"
              >
                Scheduling
              </TabsTrigger>
              */}
            </TabsList>
          </div>
          <Separator />
          <TabsContent value="general" className="m-0">
            <div className="space-y-6 px-4 py-6 lg:px-8 lg:py-8">
              <Card className="border-border/70 bg-card shadow-sm">
                <CardHeader className="gap-4 p-5 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <CardTitle className="text-xl">Language</CardTitle>
                      <CardDescription className="max-w-2xl text-sm leading-6">
                        Choose the language used across your dashboard.
                      </CardDescription>
                    </div>
                    <div className="inline-flex items-center rounded-full border border-border bg-muted/60 px-4 py-2 text-sm text-muted-foreground">
                      Current language:&nbsp;
                      <span className="font-medium text-foreground">
                        {activeLanguageLabel}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-5 pt-0 sm:p-6 sm:pt-0">
                  <div className="max-w-md">
                    <Select
                      value={activeLanguageCode}
                      onValueChange={(languageCode) =>
                        i18n.changeLanguage(languageCode)
                      }
                    >
                      <SelectTrigger className="h-12 rounded-2xl border-border/70 bg-background px-4">
                        <span className="truncate text-foreground">
                          {activeLanguageLabel}
                        </span>
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-border/70 p-2">
                        {SUPPORTED_LANGUAGES.map((language) => (
                          <SelectItem
                            key={language.code}
                            value={language.code}
                            className="rounded-xl px-3 py-2.5"
                          >
                            {language.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/70 bg-card shadow-sm">
                <CardHeader className="gap-4 p-5 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <CardTitle className="text-xl">
                        {t("settings.appearance.title")}
                      </CardTitle>
                      <CardDescription className="max-w-2xl text-sm leading-6">
                        {t("settings.appearance.description")}
                      </CardDescription>
                    </div>
                    <div className="inline-flex items-center rounded-full border border-border bg-muted/60 px-4 py-2 text-sm text-muted-foreground">
                      {t("settings.appearance.activeTheme")}
                      :&nbsp;
                      <span className="font-medium text-foreground">
                        {theme === "system"
                          ? t("settings.appearance.systemActiveTheme", {
                              theme: systemModeLabel,
                            })
                          : capitalize(theme)}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 p-5 pt-0 sm:grid-cols-2 sm:p-6 sm:pt-0 lg:grid-cols-3">
                  {themeOptions.map(
                    ({ value, labelKey, icon: Icon, descriptionKey }) => {
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
                                {t(labelKey)}
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
                              {t(descriptionKey)}
                            </p>
                          </div>
                        </div>
                        {value === "system" && (
                          <p className="mt-4 text-xs leading-5 text-muted-foreground">
                            {t("settings.appearance.systemModeDescription", {
                              theme: systemModeLabel.toLowerCase(),
                            })}
                          </p>
                        )}
                      </label>
                    );
                    }
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          {/*
          <TabsContent
            value="meeting"
            className="m-0 px-4 py-6 lg:px-8 lg:py-8"
          >
            <SettingsPlaceholder
              description="Meeting-related controls will appear here in a future update."
              title="Meeting"
            />
          </TabsContent>
          <TabsContent
            value="recording"
            className="m-0 px-4 py-6 lg:px-8 lg:py-8"
          >
            <SettingsPlaceholder
              description="Recording preferences will appear here in a future update."
              title="Recording"
            />
          </TabsContent>
          <TabsContent
            value="audio"
            className="m-0 px-4 py-6 lg:px-8 lg:py-8"
          >
            <SettingsPlaceholder
              description="Audio conference preferences will appear here in a future update."
              title="Audio Conference"
            />
          </TabsContent>
          <TabsContent
            value="whiteBoard"
            className="m-0 px-4 py-6 lg:px-8 lg:py-8"
          >
            <SettingsPlaceholder
              description="White board preferences will appear here in a future update."
              title="White Board"
            />
          </TabsContent>
          <TabsContent
            value="scheduling"
            className="m-0 px-4 py-6 lg:px-8 lg:py-8"
          >
            <SettingsPlaceholder
              description="Scheduling preferences will appear here in a future update."
              title="Scheduling"
            />
          </TabsContent>
          */}
        </Tabs>
      </Card>
    </section>
  );
};

export default Settings;
