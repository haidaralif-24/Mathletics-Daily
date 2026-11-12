import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

/**
 * Membaca sesi lewat cookie (lib/auth.ts) lalu merender kerangka aplikasi.
 * Dipanggil di dalam <Suspense> dari app/layout.tsx karena membaca cookie
 * membuat komponen ini dinamis (Partial Prerendering aktif): shell statis
 * dirender lebih dulu, barulah navigasi per peran menyusul.
 */
export async function AppShellUser({ children }: { children: ReactNode }) {
  const user = await getSessionUser();

  return <AppShell user={user}>{children}</AppShell>;
}