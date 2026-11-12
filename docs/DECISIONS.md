# Decisions

| # | Decision | Why |
| --- | --- | --- |
| 1 | Seeded accounts with email + password, no signup, no SMTP | Internal first; avoids email deliverability work; admin controls who joins |
| 2 | Members cannot write tables directly; writes via server actions / `submit_answer` | RLS cannot restrict columns; keeps time and locks server-side |
| 3 | Final answer locked after first submit; steps editable until close | Stops gaming speed points and brute-forcing the auto-check |
| 4 | Speed measured from first submit | Safe because the final answer is locked |
| 5 | Grading after close, no deadline | Removes edit-after-grade races |
| 6 | Mark scheme as structured criteria; steps bonus = ticked criteria sum | Consistent grading across 2-3 admins, faster |
| 7 | Guests see results only after close | Stops members guessing logged out before submitting |
| 8 | Guests store nothing | Less student-data risk |
| 9 | Polling instead of Realtime | Realtime does not stream views; grade RLS would block events |
| 10 | No Redis / rate-limit store for now | About 40 members; Supabase Auth limits cover login; the guest check reveals the answer after close anyway. In-memory counters do not work on serverless, so add Upstash or a Postgres counter table only if abuse appears |
| 11 | Admins excluded from the leaderboard | They see answer keys |
| 12 | LaTeX authoring with placeholder toolbar + live preview | Admins type formulas; students use photos for steps |
| 13 | Two Supabase projects (staging, prod) | Previews must never touch production data |
| 14 | `release_at`/`closes_at` generated from `release_date` | Windows cannot overlap; warn about gaps instead |
| 15 | Any unique email works as the login identifier | Supabase needs an email-format identifier but never delivers mail to it; students without a school email can still join |
| 16 | Login goes through a server action | Supabase Auth's built-in rate limit then applies to every attempt |
| 17 | `must_change_password` mirrored in `app_metadata` | Middleware reads it from the JWT with no DB query; users cannot edit `app_metadata`; `changePassword` clears it |
| 18 | Name and class are admin-managed; members have no write on `profiles` | Keeps leaderboard names trustworthy and the RLS surface smaller |
| 19 | No attempt cap for guests | The key is revealed after close anyway. If instant feedback is wanted later: 3 attempts per question per IP, accepting that incognito bypasses it |
| 20 | Reminders go through the club WhatsApp group, not push | PWA push and in-app notifications are out of scope for v1 |
| 21 | Brand accent colour is deep navy `#0B1F4D` | The client's colour theme; palette and contrast checks in `docs/UI_GUIDE.md` |
| 22 | No client write policies at all: `anon` and `authenticated` are read-only on every table, admins included. Admin writes use the service role inside server actions | RLS cannot restrict columns; an UPDATE also needs a SELECT policy, and `question_keys`/`question_markschemes` deliberately have no client SELECT, so an admin write policy there could never work. One write path per table is easier to audit than a policy per role |
| 23 | `submit_answer` takes `p_auto_verdict` from the server action, which computes it with `lib/answers.ts` | Keeps one answer normaliser instead of duplicating the matching rules in SQL (docs/DATA_MODEL.md: "Normaliser: lib/answers.ts"). The verdict is only a pre-fill for the admin (R-2) and never affects points, so a forged value buys nothing; `user_id`, the window and `first_submitted_at` all still come from `auth.uid()` and `now()` inside the function |
| 24 | `proxy.ts` (Next 16's renamed middleware) is an optimistic gate only — guests out of private routes, `must_change_password` to `/ganti-sandi`. The role check lives in `requireAdmin()`, a database read through RLS | A JWT claim can be up to an hour stale, so it must never be the only thing guarding the answer keys. Reading `must_change_password` from `app_metadata` still avoids a query on the common path (decision 17) |
| 25 | `enable_signup = false` and `minimum_password_length = 8` in `supabase/config.toml` | Local must behave like the hosted projects, otherwise the "public signups are rejected" RLS test passes locally for the wrong reason and A-3's 8-character floor is not actually enforced |
| 26 | The four UI bundles share one working tree under strictly disjoint file ownership, instead of one git worktree each | A fresh worktree has no `node_modules` and no generated `.next/types`, so every agent would need a full install plus a typegen before `pnpm typecheck` could run — real cost on a one-day deadline. The file sets do not overlap, so same-tree parallel work is safe. Trade-off accepted: an agent that strays outside its list could disturb another, which the briefs forbid explicitly |
| 27 | The guest answer check ships in bundle C (the Today page), not bundle D | It lives on `/`, which bundle C owns. Splitting it out would have forced a cross-bundle import and left both agents with a failing typecheck for the whole phase |
