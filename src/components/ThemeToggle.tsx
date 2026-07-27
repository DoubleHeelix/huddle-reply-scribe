import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { syncNativeTheme } from "@/utils/nativeApp";

type ThemeToggleProps = {
  className?: string;
};

const ThemeToggle = ({ className = "" }: ThemeToggleProps) => {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light"
  );

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(nextTheme);
    localStorage.setItem("theme_preference", nextTheme);
    setTheme(nextTheme);
    void syncNativeTheme(nextTheme);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#826f56]/20 bg-white/80 text-[#4f4438] shadow-sm backdrop-blur-md transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c49b5d] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4efe7] dark:border-white/10 dark:bg-white/[0.06] dark:text-[#e5ddd2] dark:hover:bg-white/[0.10] dark:focus-visible:ring-offset-[#0d0c0b] ${className}`}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
};

export default ThemeToggle;
