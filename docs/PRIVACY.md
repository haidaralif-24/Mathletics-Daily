# Privacy and student data

Not legal advice. Confirm with the school before launch. Students are minors, and Indonesia's personal data protection law (UU PDP, No. 27/2022) treats children's data specially and generally expects parent or guardian consent; ask the school what it requires.

## What is collected
| Data | Why | Who can see it |
| --- | --- | --- |
| School email, full name, class | Account and leaderboard | Admins; name and class also on the leaderboard for logged-in members |
| Final answers, typed steps, handwriting photos | Grading | The member who sent them, and admins |
| Grades and private feedback | Feedback and points | The member and admins |
| Login metadata kept by Supabase | Authentication | Admins with project access |

Guests: nothing is stored. Their answers are checked and discarded.

## Principles
- Collect only what the app needs. No tracking pixels, no ad scripts.
- Photos and answers are never visible to other members.
- Admins are a small named group of club officers.
- Temporary passwords are shown once and never stored.

## Before go-live
- [ ] Teacher or school sign-off on collecting names, school emails and handwriting photos
- [ ] Parent/guardian consent handled the way the school requires
- [ ] Short notice shown to students (draft below)
- [ ] Admin list agreed
- [ ] Until sign-off is confirmed, use dummy accounts only (no real student data)

## Deletion plan (fill in dates with the school)
- Exam date: ______ . Delete or export by: ______ .
- Export the leaderboard if the club wants a record; remove personal data otherwise.
- Delete: all rows in `submissions`, `grades` and `profiles` for members, files in `submission-media`, and the auth users.
- Confirm deletion to the teacher in writing.

## Student notice (draft, Bahasa Indonesia)
> Mathletics Daily menyimpan nama, kelas, email sekolah, jawaban, dan foto langkah pengerjaanmu. Data ini hanya dilihat olehmu dan pengurus klub, dan hanya dipakai untuk penilaian dan papan peringkat. Data akan dihapus setelah seleksi OSN selesai.
