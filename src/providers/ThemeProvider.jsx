import React from "react";

const VALID_THEMES = ["light", "dark", "system"];
const STORAGE_KEY = "theme";
const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export const ThemeContext = React.createContext(undefined);

const isValidTheme = (theme) => VALID_THEMES.includes(theme);

const getStoredTheme = (storageKey) => {
  if (typeof window === "undefined") {
    return "system";
  }

  try {
    const storedTheme = window.localStorage.getItem(storageKey);
    return isValidTheme(storedTheme) ? storedTheme : "system";
  } catch (error) {
    return "system";
  }
};

const getSystemTheme = (mediaQueryList) => {
  return mediaQueryList.matches ? "dark" : "light";
};

const applyResolvedTheme = (resolvedTheme) => {
  const root = document.documentElement;
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');

  root.classList.toggle("dark", resolvedTheme === "dark");
  root.style.colorScheme = resolvedTheme;

  if (metaThemeColor) {
    metaThemeColor.setAttribute(
      "content",
      resolvedTheme === "dark" ? "#020617" : "#042c69"
    );
  }
};

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = STORAGE_KEY,
}) {
  const [theme, setThemeState] = React.useState(() => {
    const storedTheme = getStoredTheme(storageKey);
    return isValidTheme(storedTheme) ? storedTheme : defaultTheme;
  });
  const [resolvedTheme, setResolvedTheme] = React.useState(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    const mediaQuery = window.matchMedia(DARK_MEDIA_QUERY);
    const currentTheme = getStoredTheme(storageKey);
    return currentTheme === "system" ? getSystemTheme(mediaQuery) : currentTheme;
  });

  React.useEffect(() => {
    const mediaQuery = window.matchMedia(DARK_MEDIA_QUERY);

    const updateTheme = () => {
      const nextResolvedTheme =
        theme === "system" ? getSystemTheme(mediaQuery) : theme;

      setResolvedTheme(nextResolvedTheme);
      applyResolvedTheme(nextResolvedTheme);
    };

    updateTheme();

    try {
      window.localStorage.setItem(storageKey, theme);
    } catch (error) {
      // Ignore localStorage write failures so theming still works in-session.
    }

    if (theme !== "system") {
      return undefined;
    }

    const handleChange = () => updateTheme();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [storageKey, theme]);

  const setTheme = React.useCallback((nextTheme) => {
    if (!isValidTheme(nextTheme)) {
      return;
    }

    setThemeState(nextTheme);
  }, []);

  const value = React.useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [resolvedTheme, setTheme, theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
