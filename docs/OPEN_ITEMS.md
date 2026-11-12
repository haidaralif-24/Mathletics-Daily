# Open items

None of these block the first week of build, but each has a default so work does not stall. Update this file as answers arrive and mirror the outcome in `SPEC.md` or `docs/DECISIONS.md`.

| Item | Needed from | Needed by | Default if unanswered |
| --- | --- | --- | --- |
| Roster CSV: email, full name and class for every member | Client | Before go-live | Seed 5 dummy accounts only; no real student data |
| How temporary passwords reach students (in person, teacher, WhatsApp) | Client | Before go-live | Printed slips handed out by a teacher |
| 5-10 real past OSN-style final answers | Client | Before the first real question is entered | Integer answers only in v1 |
| OSN selection date (admin setting; the brief says 4 Dec 2026) | Client / admin | Before launch | Header countdown hidden until set |
| Teacher or school sign-off on student data, and a deletion date after the exam | School | Before go-live | Do not collect real student data until confirmed |
| Who the 2-3 admins are | Client | Before seeding | None |
| Mark-scheme total (5 points) suits every question type | Client | Before first grading | 5, set in `lib/config.ts` |
| Supabase plan (free vs one month of Pro) | Client | Before go-live | Free for staging, Pro for production |
| Move beyond seeded accounts: school domain, school IT contact, SMTP or Google sign-in | Client | After launch | Stay on seeded accounts |

## Brief inconsistencies to confirm
The scaffold follows the choice in the right-hand column until someone says otherwise.

| Brief says | And also | Scaffold follows |
| --- | --- | --- |
| Acceptance: "Only school-domain emails can create an account" | Accounts are seeded by admins; a student without a school email can use any unique address | Nobody can create an account; there is no domain check. Only admins create users |
| Profiles table: members may edit `display_name` and `class_name` through a column grant | Profile screen: "name and class are set by admins" | Admin-managed only; members have no write on `profiles` |
| "Cut from v1" lists password reset | Section 4 has an admin-issued reset with a one-time temporary password | Admin reset is in v1 (A-4); self-service email reset stays out |
| "No rate limit for now" | "Login goes through a server action so the rate limit applies" | Login via server action; only Supabase Auth's built-in limits, nothing added |
