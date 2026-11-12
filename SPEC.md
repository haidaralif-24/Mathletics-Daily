# SPEC: Mathletics Daily

Status: v1 (MVP), derived from the Revised Build Brief (10 Nov 2026). **This file is the source of truth for behaviour.** If code and this file disagree, fix one of them in the same PR.
Related: schema `docs/DATA_MODEL.md` · points `docs/SCORING.md` · RLS `docs/SECURITY.md` · UI `docs/UI_GUIDE.md` · tests `docs/TESTING.md` · rationale `docs/DECISIONS.md` · open questions `docs/OPEN_ITEMS.md`.
Requirement IDs (A-1, M-2, ...) are stable. Cite them in commits, PRs and tests. `[P0]` = needed to go live (16-17 Nov), `[P1]` = built while live.

## 1. Summary
A school-only web app for a math club. One problem per day, released 04:00 WIB, open 24 hours. Members (accounts seeded by admins) submit a final answer plus handwritten steps. Admins grade against a mark scheme. A leaderboard ranks members. Guests (no login) can try problems and see the result after the question closes. UI language: Bahasa Indonesia. Mobile-first.

## 2. Glossary
- **Question**: one daily problem, identified by `release_date` (a WIB calendar date).
- **Window**: `[release_at, closes_at)`, 24 h, from 04:00 WIB.
- **Final answer**: short text/number; locked after the first submit.
- **Steps**: working shown as photos (main path) and/or typed text; editable until close.
- **Key**: accepted final answers for a question (admin only). **Verdict**: `correct`, `wrong` or `needs_review`.
- **Mark scheme**: criteria rows (points sum to 5) used to award steps points.
- **Member / Admin / Guest**: see section 3.

## 3. Roles and access
| Capability | Guest | Member | Admin |
| --- | --- | --- | --- |
| Read released questions | Yes | Yes | Yes (all) |
| Check a final answer | After close | Submits for points | n/a |
| Submit steps and photos | No | Yes | No |
| Own history, grades, feedback | No | Yes | n/a |
| Leaderboard | No | Yes | Yes |
| On the leaderboard | No | Yes, if active | No |
| Author questions, keys, mark schemes | No | No | Yes |
| Grade; manage members; OSN date | No | No | Yes |

## 4. Functional requirements

### Authentication
- **A-1 [P0]** Login at `/login` with email and password. There is no signup page and no public signup. Login goes through a server action so Supabase Auth's built-in rate limit applies.
- **A-2 [P0]** Accounts are created by admins (CSV import or seed script) through the admin API. Each gets a random temporary password, shown once. Supabase needs an email-format identifier but never delivers mail to it, so a student without a school email can use any unique address.
- **A-3 [P0]** A member with `must_change_password` is redirected to change it before reaching anything else (minimum 8 characters). The flag lives in `app_metadata`, so middleware needs no database query.
- **A-4 [P0]** Admin can reset a member's password: a new temporary password is shown once and the flag is set again.
- **A-5 [P0]** Deactivated members cannot log in or submit and do not appear on the leaderboard. Deactivation also bans the auth user.
- **A-6 [P0]** Login errors are generic: "Email atau kata sandi salah".
- **A-7 [P0]** Members can change their own password from Profil. Name and class are set by admins; members cannot edit them.

### Schedule and question display
- **S-1 [P0]** A question releases at 04:00 WIB on its `release_date` and is open for 24 h. Nothing manual is needed to open or close it.
- **S-2 [P0]** All times are shown in `Asia/Jakarta`, whatever the device timezone.
- **S-3 [P0]** With no active question, say **"Tidak ada soal untuk hari ini"**, then "Soal berikutnya rilis {tanggal} pukul {jam} WIB" when one is scheduled, or a friendly empty state when nothing is scheduled.
- **S-4 [P0]** Today's page shows title, release time, a countdown to close (corrected against server time on load) and the rendered question (LaTeX via KaTeX) with an optional diagram (zoomable).
- **S-5 [P0]** An unreleased question cannot be fetched through the API, even from DevTools.
- **S-6 [P1]** Header shows "H-xx" to the OSN selection date (admin setting). Hidden until the date is set.

### Question authoring (admin)
- **Q-1 [P0]** LaTeX editor with a placeholder toolbar (fraction, root, power, subscript, sum, binomial, angle, Greek letters, inline and block math) and a live preview. Saving is blocked if KaTeX cannot parse the text.
- **Q-2 [P0]** `release_date` is unique. The dashboard warns about gaps ("Belum ada soal untuk besok"). `release_at` and `closes_at` are derived, so windows cannot overlap.
- **Q-3 [P0]** Each question needs an answer key and a mark scheme. Saving without them shows a warning.
- **Q-4 [P0]** A question that has submissions cannot be deleted, only edited, with a warning.
- **Q-5 [P1]** Optional worked solution, readable only after close. A per-question toggle publishes the mark scheme with it.

### Member submission
- **M-1 [P0]** Final answer: required, up to 500 characters. Plain text such as `3/4` or `sqrt(2)` is fine.
- **M-2 [P0]** Steps are required: at least one photo or some typed text. Photos: jpeg, png or webp, up to 5, up to 8 MB each, compressed on the device (about 1600 px, about 250 KB).
- **M-3 [P0]** First submit sets `first_submitted_at` on the server and locks the final answer, after a confirmation: "Jawaban akhir tidak bisa diubah setelah dikirim. Lanjutkan?". Steps stay editable until close.
- **M-4 [P0]** Submissions outside the window are rejected by the database with a clear message ("Soal ini sudah ditutup").
- **M-5 [P0]** Atomic save: if a photo upload fails, no half-saved submission exists; the member can retry.
- **M-6 [P0]** Status chip: Belum dijawab, Terkirim (HH.MM WIB), Sudah dinilai.
- **M-7 [P0]** Verdict, points and feedback stay hidden until the question has closed and been graded.
- **M-8 [P0]** Leaving the page with unsaved changes asks for confirmation. The submit button is disabled while processing; photo upload shows progress.

### Guest
- **G-1 [P0]** Guests read released questions and type a final answer. No attachments, no account, nothing stored.
- **G-2 [P0]** While the question is open: "Hasil tersedia setelah soal ditutup". After close: correct or incorrect, plus the correct answer and the solution if published.
- **G-3 [P0]** The key is read only on the server and never sent to the client before close.

### Grading (admin)
- **R-1 [P0]** Admin picks a question and sees every active member as Belum kirim, Belum dinilai or Sudah dinilai, filterable and sortable by submit time. Grading is expected after close; admins may preview during the window.
- **R-2 [P0]** Per submission: final answer with the auto-verdict pre-filled (`needs_review` is highlighted), steps text, photos (zoom and rotate), submit time and the gap from release, plus the answer key and the mark scheme on the same screen.
- **R-3 [P0]** Admin confirms or overrides Correct/Wrong, ticks mark-scheme criteria (the sum is the steps points, 0-5), writes private feedback, and sees the total before saving. Saving computes points with `lib/scoring.ts`.
- **R-4 [P0]** Keyboard: `C` correct, `X` wrong, `Enter` saves and jumps to the next ungraded. Progress shows "12/20 dinilai".
- **R-5 [P0]** Two admins on one submission: last write wins and the screen shows who graded last.
- **R-6 [P0]** If a member edits steps after grading, the grade is flagged `needs_regrade` on the admin dashboard.
- **R-7 [P0]** Admin can change a saved grade; the total is recomputed and `graded_at` updated.

### Leaderboard
- **L-1 [P0]** Overall tab. **[P1]** This Week tab (Mon-Sun WIB, by question `release_date`).
- **L-2 [P0]** Columns: rank, name, class, total points, correct count, questions attempted. Tie-break: total points, correct count, earliest average submit time.
- **L-3 [P0]** The member's own row is highlighted and sticky, even outside the top 10.
- **L-4 [P0]** Polls every 30-60 s and on window focus (no Realtime). Label: "Poin diperbarui setelah soal dinilai".
- **L-5 [P0]** Admins and deactivated members never appear. No other member's answers, photos or feedback are ever visible.

### History and streak
- **H-1 [P1]** Riwayat lists answered questions with verdict, points breakdown (base, speed, steps), mark-scheme ticks, private feedback, and the member's own answer and steps.
- **H-2 [P1]** Closed questions can be opened as an archive (read only), with the key and solution after close. No points for late answers.
- **H-3 [P1]** Streak = consecutive question days (by `release_date`) with a submission, regardless of correctness.

### Member management and settings (admin)
- **U-1 [P0]** Import a roster CSV (email, full name, class). Show temporary passwords once, as a downloadable CSV. Report malformed or duplicate rows without aborting the whole import.
- **U-2 [P0]** Edit name and class, activate or deactivate, promote to admin, reset password, search by email.
- **U-3 [P1]** Set the OSN date.
- **U-4 [P1]** Export CSV: leaderboard and per-question results.

## 5. Non-functional requirements
- **Performance:** Today's page opens in under 2 s on ordinary mobile data (Server Components, `next/image`, minimal client JS). Lighthouse mobile: Performance >= 85.
- **Accessibility:** WCAG AA contrast; Lighthouse Accessibility >= 90; visible focus; usable with a keyboard; respects reduced motion.
- **Responsive:** mobile first (360 px and up), works to desktop. Dark mode follows the system with a manual toggle.
- **Security:** see `docs/SECURITY.md`. Time-critical decisions come from the database.
- **Copy:** Bahasa Indonesia, friendly but polite. Clear errors, never raw database messages.

## 6. Edge cases
| Case | Behaviour |
| --- | --- |
| Submit at the exact close instant | The database decides (`now() < closes_at`). Rejected with "Soal ini sudah ditutup" |
| Photo upload fails mid-way | Nothing is saved; error toast; retry. Orphan files are harmless |
| Member edits steps after grading | Grade flagged `needs_regrade`; final answer never changes |
| Two admins grade one submission | Last write wins; last grader shown |
| New member joins mid-period | Only earned points count; no penalty for missed days |
| Device timezone differs | All times still shown in WIB |
| Member deactivated mid-window | Cannot submit; existing data kept; hidden from leaderboard |
| Auto-check cannot parse an answer | `needs_review`, never `wrong`; admin decides |
| CSV has a duplicate or invalid email | Row skipped and reported; others imported |
| Wrong key published | Fix the key; re-run the auto-check; admin re-confirms affected grades |
| Admin forgets to schedule tomorrow | Dashboard gap warning (Q-2) |

## 7. Out of scope for v1
Realtime, email or OTP login, OAuth, push or email reminders (a reminder in the club WhatsApp group replaces push), badges and heatmap, configurable-weights UI, a separate explanation page, in-app notifications, auto-grading of steps.

## 8. Acceptance criteria
- Only seeded accounts can log in; nobody can create an account.
- An unreleased question cannot be fetched through the API.
- A question opens at 04:00 WIB and locks 24 h later with no manual step.
- Submit time and the locked final answer cannot be changed from the client.
- Member A cannot read member B's answers, photos or feedback (two-account test).
- A guest never receives a key or a verdict before the question closes.
- An admin can grade 20 submissions in under 10 minutes without leaving the page.
- Leaderboard points match `docs/SCORING.md` after an admin saves a grade.
- Lighthouse mobile on Today's question: Performance >= 85, Accessibility >= 90.
