import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { OwnSubmission } from './data';
import { ZoomableImage } from './zoomable-image';
import { wibTime } from './wib';

/**
 * What the member sent, read only. Once `closes_at` has passed there is nothing
 * left to edit (M-3, M-4), and the final answer was locked after the first
 * submit anyway.
 */
export function SubmissionSummary({ submission }: { submission: OwnSubmission }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Jawabanmu</CardTitle>
        <CardDescription>
          Terkirim {wibTime(submission.firstSubmittedAtIso)} WIB. Soal sudah ditutup, jadi isinya tidak bisa
          diubah lagi.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Jawaban akhir</p>
          <p className="font-mono text-base break-words text-foreground">{submission.finalAnswer}</p>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Langkah pengerjaan
          </p>
          {submission.stepsText ? (
            <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground">
              {submission.stepsText}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Kamu hanya mengirim foto langkah pengerjaan.</p>
          )}
        </div>

        {submission.photoPaths.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Foto langkah pengerjaan
            </p>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {submission.photoPaths.map((path, index) => {
                const url = submission.photoUrls[index];
                return (
                  <li key={path}>
                    {url ? (
                      <ZoomableImage
                        src={url}
                        alt={`Foto langkah pengerjaan ${index + 1}`}
                        className="max-h-56"
                      />
                    ) : (
                      <div className="grid aspect-square w-full place-items-center rounded-lg bg-muted px-2 text-center text-xs text-muted-foreground ring-1 ring-foreground/10">
                        Foto tidak bisa dimuat
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Fallback when the member skipped a question (no submission, question closed). */
export function NoSubmissionNote() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kamu tidak mengirim jawaban</CardTitle>
        <CardDescription>
          Tidak ada kiriman dari akunmu untuk soal ini. Poin hanya dihitung dari soal yang kamu kerjakan,
          jadi tidak ada pengurangan.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
