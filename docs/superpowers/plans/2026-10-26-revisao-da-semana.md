# Weekly review — plan

Spec: `docs/superpowers/specs/2026-10-26-revisao-da-semana-design.md`. Issue #106, branch `feature/106-revisao-semana`.

1. **Schema.** `WeekReview` model + `weekReviews` on `User`; hand-written migration `week_review` (create table, unique index, FK cascade). Apply to the test DB (`npm run test:migrate`), add the table to the test cleanup.
2. **Dates.** `formatWeekRange(weekStart)` in `dates.ts` ("19 a 25 de out.", "27 de out. a 2 de nov."), with tests.
3. **Goal copying.** Move `goalKey`, `SourceGoal`, `findMissingGoals`, `cloneGoalsInto` to `src/lib/goal-copy.ts`; `weeklyGoals.ts` imports them. Existing tests must stay green untouched.
4. **Pure logic** `src/lib/week-review.ts` (TDD): `pickReviewWeek`, `isInviteDue`, `buildWeekReview`.
5. **Actions** `src/lib/actions/weekReview.ts` (TDD against the test DB): `getWeekReview`, `getWeekReviewInvite`, `finishWeekReview`. `getMissingGoalsPreview` returns null when the source week was reviewed. Guest link moves reviews.
6. **UI** (TDD with Testing Library): `WeekReview` client component, `WeekReviewInvite`, `/revisao` page, Hoje wiring.
7. **Verify:** `npm run lint`, `npx tsc --noEmit`, `npm run test:tz`, look at the page in the browser (desktop and 390 px, both themes) with seeded data.
8. **Independent review**, fixes, push, PR to develop (`Closes #106`), board.
