import type { ReactNode } from "react";
import { useDarkMode } from "../hooks/useDarkMode";

interface LayoutProps {
  readonly children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { isDark, toggle } = useDarkMode();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      {children}
      <button
        onClick={toggle}
        className="fixed bottom-4 right-4 w-10 h-10 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg flex items-center justify-center text-sm hover:scale-110 hover:border-emerald-300 dark:hover:border-emerald-600 transition-all z-50"
        title={isDark ? "切换亮色" : "切换暗色"}
      >
        {isDark ? "\u2600" : "\u263E"}
      </button>
    </div>
  );
}
