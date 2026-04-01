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
import { Separator } from "../components/ui/separator";
import {
  Tabs,
  TabsTrigger,
  TabsList,
  TabsContent,
} from "../components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  getLanguageOption,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
} from "../constants/languages";
import useTheme from "../hooks/useTheme";
import { capitalize, cn } from "../lib/utils";

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
  const { t, i18n } = useTranslation();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const systemModeLabel = capitalize(resolvedTheme);
  const currentLanguage = getLanguageOption(i18n.resolvedLanguage || i18n.language);

  const themeOptions = [
    {
      value: "light",
      label: t("themes.light.label"),
      icon: SunMedium,
      description: t("themes.light.description"),
    },
    {
      value: "dark",
      label: t("themes.dark.label"),
      icon: Moon,
      description: t("themes.dark.description"),
    },
    {
      value: "system",
      label: t("themes.system.label"),
      icon: Monitor,
      description: t("themes.system.description"),
    },
  ];

  const handleLanguageChange = (language) => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    i18n.changeLanguage(language);
  };

  // Keep the language selector logic wired for later while its UI stays commented out.
  void Select;
  void SelectContent;
  void SelectItem;
  void SelectTrigger;
  void SelectValue;
  void SUPPORTED_LANGUAGES;
  void currentLanguage;
  void handleLanguageChange;

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
              <TabsTrigger
                className="w-full rounded-xl px-4 py-2 text-sm md:w-full lg:w-auto"
                value="meeting"
              >
                {t("settings.tabs.meeting")}
              </TabsTrigger>
              <TabsTrigger
                className="w-full rounded-xl px-4 py-2 text-sm md:w-full lg:w-auto"
                value="recording"
              >
                {t("settings.tabs.recording")}
              </TabsTrigger>
              <TabsTrigger
                className="w-full rounded-xl px-4 py-2 text-sm md:w-full lg:w-auto"
                value="audio"
              >
                {t("settings.tabs.audioConference")}
              </TabsTrigger>
              <TabsTrigger
                className="w-full rounded-xl px-4 py-2 text-sm md:w-full lg:w-auto"
                value="whiteBoard"
              >
                {t("settings.tabs.whiteBoard")}
              </TabsTrigger>
              <TabsTrigger
                className="w-full rounded-xl px-4 py-2 text-sm md:w-full lg:w-auto"
                value="scheduling"
              >
                {t("settings.tabs.scheduling")}
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
                          ? t("settings.appearance.systemTheme", {
                              mode: systemModeLabel,
                            })
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
                            {t("settings.appearance.currentlyFollowing", {
                              mode: systemModeLabel.toLowerCase(),
                            })}
                          </p>
                        )}
                      </label>
                    );
                  })}
                </CardContent>
              </Card>

              {/*
                <Card className="border-border/70 bg-card shadow-sm">
                  <CardHeader className="gap-4 p-5 sm:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <CardTitle className="text-xl">
                          {t("settings.language.title")}
                        </CardTitle>
                        <CardDescription className="max-w-2xl text-sm leading-6">
                          {t("settings.language.description")}
                        </CardDescription>
                      </div>
                      <div className="inline-flex items-center rounded-full border border-border bg-muted/60 px-4 py-2 text-sm text-muted-foreground">
                        {t("settings.language.current")}
                        :&nbsp;
                        <span className="font-medium text-foreground">
                          {currentLanguage.nativeLabel}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-4 p-5 pt-0 sm:p-6 sm:pt-0 lg:grid-cols-[minmax(0,320px)_1fr]">
                    <div className="space-y-3">
                      <Select
                        value={currentLanguage.nativeLabel}
                        onValueChange={handleLanguageChange}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t("settings.language.placeholder")}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {SUPPORTED_LANGUAGES.map((language) => (
                            <SelectItem
                              key={language.code}
                              value={language.code}
                            >
                              {language.nativeLabel}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs leading-5 text-muted-foreground">
                        {t("settings.language.helper")}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              */}

              <Card className="border-dashed border-border/70 bg-muted/20 shadow-none">
                <CardContent className="p-5 sm:p-6">
                  <p className="text-sm text-muted-foreground">
                    {t("settings.additionalSettings")}
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
              description={t("settings.placeholders.meeting")}
              title={t("settings.tabs.meeting")}
            />
          </TabsContent>
          <TabsContent
            value="recording"
            className="m-0 px-4 py-6 lg:px-8 lg:py-8"
          >
            <SettingsPlaceholder
              description={t("settings.placeholders.recording")}
              title={t("settings.tabs.recording")}
            />
          </TabsContent>
          <TabsContent
            value="audio"
            className="m-0 px-4 py-6 lg:px-8 lg:py-8"
          >
            <SettingsPlaceholder
              description={t("settings.placeholders.audioConference")}
              title={t("settings.tabs.audioConference")}
            />
          </TabsContent>
          <TabsContent
            value="whiteBoard"
            className="m-0 px-4 py-6 lg:px-8 lg:py-8"
          >
            <SettingsPlaceholder
              description={t("settings.placeholders.whiteBoard")}
              title={t("settings.tabs.whiteBoard")}
            />
          </TabsContent>
          <TabsContent
            value="scheduling"
            className="m-0 px-4 py-6 lg:px-8 lg:py-8"
          >
            <SettingsPlaceholder
              description={t("settings.placeholders.scheduling")}
              title={t("settings.tabs.scheduling")}
            />
          </TabsContent>
        </Tabs>
      </Card>
    </section>
  );
};

export default Settings;
