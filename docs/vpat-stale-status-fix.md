# Fix: VPAT Submission Status Stale Until Re-entering Bot

## Symptoms
- Submission status stays at "processing" long after backend processing completes.
- Hard refresh or Ctrl+R does **not** update the UI.
- Only going back to the bot dashboard and re-entering the submission shows the correct status.
- Polling and cache-busting attempts did not resolve the issue.

## Root Causes Identified
1. **Route ID mismatch**: Legacy URLs with platform suffixes (`submissionId_platform`) caused the detail page to fetch a stale/shaped response, while the dashboard used canonical IDs.
2. **Stale single-submission endpoint**: The `/api/vpat-submissions/:id` response could lag behind the fresher status in the bot's submissions list.
3. **Backend status update delay**: Even with auto-heal logic, the stored `status` field sometimes lagged behind completion artifacts.

## Applied Fixes

### 1. Canonical Route Normalization
- Added `getCanonicalSubmissionId()` to strip platform suffixes and normalize to the core submission ID.
- Added a `useEffect` that performs `router.replace()` to the canonical URL on page load.
- **File**: `app/dashboard/vpat-submission/[id]/page.tsx#642-658`

### 2. Cross-Check Bot Submissions List
- During `fetchSubmission()`, after fetching the single submission, also fetch `/api/vpat-bots/:botId/submissions`.
- Merge the freshest matching submission by canonical ID, preserving platform-specific fields from the detail endpoint.
- **File**: `app/dashboard/vpat-submission/[id]/page.tsx#684-739`

### 3. Client-Side Status Inference
- Added `inferSubmissionStatus()` that treats a stuck `"processing"` as terminal when completion evidence exists:
  - `generatedScorecard` present
  - `completedAt` present
  - Processing log contains completion steps (`processing_completed`, `evaluation_completed`, `step13_files_saved`, `scorecard_generation_completed`)
- If inferred terminal, UI status is set to `needs_review` (when validation invalid) or `completed`.
- **File**: `app/dashboard/vpat-submission/[id]/page.tsx#660-672` and `#742-748`

### 4. Existing Safeguards (Retained)
- 5-second polling with `no-store` and cache-busting timestamp.
- Tab focus/visibility listeners to trigger refresh.
- Backend auto-heal in `/api/vpat-submissions/[id]/route.ts` to correct stale status.
- ISR disabled on submission fetch endpoint.

## Result
- Submission status now updates promptly without leaving the page.
- Works for both single and multi-platform submissions.
- No more reliance on manual navigation back to the dashboard.

## Notes for Future
- Always use canonical submission IDs in links to avoid stale responses.
- When polling, consider cross-checking list endpoints for fresher state.
- Client-side inference from completion artifacts is a robust fallback for delayed status writes.
