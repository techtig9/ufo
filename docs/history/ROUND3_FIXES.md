# UFO Round 3 fixes

Core generation/workspace reliability fixes:
- `/api/generate` now verifies that generated screens and the share record were actually created.
- If screen/share initialization fails, partially-created project data is cleaned up and credits are not charged.
- `/api/screens/[id]` now treats version-snapshot failure as a hard save failure instead of silently saving without history.
- Existing Round 2 Tailwind, free-credit, billing-history, export-gating, and Figma-coming-soon fixes are retained.

Required Supabase migration:
- Apply `supabase/migrations/002_launch_fixes.sql` before testing version history.
