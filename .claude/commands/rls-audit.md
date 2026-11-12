---
description: Audit RLS coverage end to end before go-live.
---
1. Run `rls-tester` to confirm every item in the docs/SECURITY.md checklist has a passing test; it should add missing tests.
2. In parallel, run `security-reviewer` on supabase/migrations and the server actions.
3. Report: tests passing, gaps, and a go / no-go for the P0 gate in docs/TASKS.md.
