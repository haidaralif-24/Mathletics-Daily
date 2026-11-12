import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Placeholder netral. Halaman soal hari ini dibangun di fase berikutnya;
 * jangan menambah form atau logika di sini.
 */
export default function Home() {
  return (
    <section className="flex flex-col gap-4" aria-labelledby="judul-hari-ini">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1
          id="judul-hari-ini"
          className="font-heading text-2xl font-semibold tracking-tight"
        >
          Hari Ini
        </h1>
        <Badge variant="secondary">Belum ada soal</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Soal hari ini segera hadir</CardTitle>
          <CardDescription>
            Soal baru muncul otomatis setiap hari pukul 04.00 WIB dan terbuka
            selama 24 jam.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-4">
          <p className="text-sm text-muted-foreground">
            Kembali lagi nanti. Kalau kamu anggota, masuk dulu supaya jawabanmu
            bisa dinilai.
          </p>
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "outline" }), "min-h-11 px-4")}
          >
            Masuk
          </Link>
        </CardContent>
      </Card>
    </section>
  );
}