# PRD: Mathletics Daily

Why and what, by phase. Behaviour, requirement IDs and acceptance criteria are in `SPEC.md`. Source: "Mathletics Daily: Revised Build Brief" (10 Nov 2026), which replaced the original brief.

## Purpose
SMA students get one math problem per day, submit a final answer plus handwritten steps, and are graded by admins against a mark scheme. The goal is a daily practice habit before the OSN selection on 4 Dec 2026 (the admin sets the exact date). Go-live target: 16-17 Nov 2026, which gives members about two weeks of daily use.

## Users
- **Guest** (no login): reads released questions, enters a final answer; sees correct/incorrect (and the key) only after the question closes. Nothing is stored.
- **Member** (seeded account): submits final answer + steps (photos first, optional text), sees own history, grades, feedback, and the leaderboard.
- **Admin** (2-3 people): authors questions (LaTeX), sets answer key and mark scheme, grades, manages members. Admins do not compete and never appear on the leaderboard.

## Core flow
1. Question releases daily at 04:00 WIB and stays open 24 h.
2. Member submits. The final answer locks on first submit; steps stay editable until close. Steps are mandatory (photo or text).
3. After close, the system auto-checks the final answer against the key (pre-fills Correct/Wrong, or "needs review").
4. Admin confirms, ticks mark-scheme criteria (steps bonus 0-5), adds private feedback, saves.
5. Points appear on the leaderboard and in the member's history. No grading deadline.

## Authentication
Seeded accounts only: school email (or any unique address) plus password, no signup, no email sent. Admin imports a roster CSV (email, name, class) or runs the seed script; each member gets a temporary password shown once and must change it at first login. Admin resets forgotten passwords.
Later options (when more students join): email OTP (needs custom SMTP with SPF/DKIM and an allowlisted sender) or Google sign-in restricted to the school domain and verified server-side. Profiles stay keyed to the auth user, so switching sign-in methods does not touch grading data.

## Scope by phase
Only P0 blocks launch. The habit forms only if members get about two weeks of daily use, so P1 items arrive while the site is already live, and the last ten days are fixes only.
**P0 (10-16 Nov):** login + member import, today's question, submit with steps, admin question editor (LaTeX toolbar + live preview), grading screen with mark scheme, basic leaderboard, RLS tests.
**P1 (17-23 Nov, while live):** history + feedback, weekly leaderboard, streak, CSV export, OSN countdown, published solutions.
**Stabilise (24 Nov - 3 Dec):** fixes only.
**Later (if wanted):** heatmap, badges, Google sign-in, email OTP, guest instant feedback (cap 3 attempts per question per IP, accepting the incognito weakness).

## Non-goals (v1)
Realtime (use 30-60 s polling), configurable-weights UI, a separate explanation page, in-app notifications, PWA push. A reminder in the club WhatsApp group does the job of push.

## Acceptance criteria
See `SPEC.md` section 8 (single source of truth).

## Open items
See `docs/OPEN_ITEMS.md`: each item has an owner, a deadline and a default so work does not stall.
