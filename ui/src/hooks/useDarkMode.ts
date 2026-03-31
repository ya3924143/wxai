import { useCallback, useEffect, useState } from "react";

export function useDarkMode(): {
  isDark: boolean;
  toggle: () => void;
} {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem("wxai-dark-mode");
    if (stored !== null) return stored === "true";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("wxai-dark-mode", String(isDark));
  }, [isDark]);

  const toggle = useCallback(() => setIsDark((prev) => !prev), []);

  return { isDark, toggle };
}
