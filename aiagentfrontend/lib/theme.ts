
export type ThemePref = "light" | "dark" | "system";

const STORAGE_KEY = "sf-theme";

export function storedTheme(): ThemePref {
  if (typeof window === "undefined") return "dark";

  const saved = localStorage.getItem(STORAGE_KEY);

  if (saved === "light" || saved === "dark" || saved === "system") {
    return saved;
  }

  return "dark";
}

export function applyTheme(theme: ThemePref): void {
  if (typeof document === "undefined") return;

  localStorage.setItem(STORAGE_KEY, theme);

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.classList.toggle("light", !isDark);

  document.documentElement.dataset.theme = isDark ? "dark" : "light";
}
