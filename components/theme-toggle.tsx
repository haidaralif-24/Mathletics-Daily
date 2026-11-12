"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

type ThemeName = "light" | "dark" | "system";

const THEME_LABEL: Record<ThemeName, string> = {
  light: "Terang",
  dark: "Gelap",
  system: "Sistem",
};

/** light -> dark -> system -> light */
const NEXT_THEME: Record<ThemeName, ThemeName> = {
  light: "dark",
  dark: "system",
  system: "light",
};

const THEME_ICON = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

// Hydration-safe "mounted" flag without a setState-in-effect round trip.
const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * Tombol ganti tema: Terang, Gelap atau Sistem (docs/UI_GUIDE.md).
 * Sebelum hidrasi ikon dan label memakai "Sistem" agar markup server dan klien sama
 * (tidak ada flicker atau hydration mismatch); setelah itu nilai asli dari
 * next-themes dipakai.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  const current: ThemeName = mounted && theme ? (theme as ThemeName) : "system";
  const next = NEXT_THEME[current];
  const Icon = THEME_ICON[current];
  const description = `Tema saat ini: ${THEME_LABEL[current]}. Ganti ke tema ${THEME_LABEL[next]}.`;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-11 shrink-0 gap-2 text-muted-foreground hover:text-foreground sm:w-auto sm:px-3"
      aria-label={description}
      title={description}
      onClick={() => setTheme(next)}
    >
      <Icon className="size-5" aria-hidden="true" />
      <span className="hidden text-sm font-medium sm:inline">
        {THEME_LABEL[current]}
      </span>
    </Button>
  );
}
