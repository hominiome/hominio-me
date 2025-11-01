<!-- dcfaf9b5-4f79-47ad-b7a0-34f7ee99e68e b0a4973a-82f7-40e4-a029-9cd948cf587b -->
# Add Date/Time Selection and Manual Round Start

## Schema Updates

1. **Update `zero-schema.ts`:**

- Add `endDate: string()` to `cup` table (ISO timestamp for cup end date/time)
- Add `endDate: string()` to `cupMatch` table (ISO timestamp for match/round end date/time)

2. **Update migration script `scripts/zero-migrate.js`:**

- Add `ALTER TABLE cup ADD COLUMN IF NOT EXISTS "endDate" TEXT DEFAULT ''`
- Add `ALTER TABLE "cupMatch" ADD COLUMN IF NOT EXISTS "endDate" TEXT DEFAULT ''`
- Update publication to include new columns

## UI Components

3. **Create `src/lib/DatePicker.svelte`:**

- Native date input styled to match app theme
- Props: `value` (string ISO date), `onChange` callback, `minDate`, `maxDate`
- Styled with brand colors, rounded corners, proper spacing

4. **Create `src/lib/TimePicker.svelte`:**

- Native time input styled to match app theme
- Props: `value` (string HH:mm format), `onChange` callback
- Styled consistently with DatePicker

## API Changes

5. **Modify `src/routes/alpha/api/end-round/+server.js`:**

- Remove matchmaking logic (lines 166-197)
- Remove cup.currentRound update (lines 199-207)
- Remove status update for next round matches (lines 209-218)
- Keep only: determine winners, mark matches as completed
- Return success without creating next round

6. **Create `src/routes/alpha/api/start-next-round/+server.js`:**

- Require admin access
- Accept `cupId` and `endDate` (ISO timestamp string)
- Get cup and current round
- Calculate next round name
- Collect winners from current round matches
- Create next round matches (matchmaking logic from old end-round)
- Set `endDate` on all new matches
- Update cup `currentRound` and cup `endDate` (if applicable)
- Set all new matches to "voting" status
- Return success with next round info

## Admin UI Updates

7. **Update `src/routes/alpha/cups/[cupId]/admin/+page.svelte`:**

- Change "End Round & Advance Winners" button text to "End Round & Determine Winners"
- Remove auto-advance messaging
- Add new "Start Next Round" button (only show if cup is active and next round doesn't exist yet)
- Add modal/dialog for date/time selection when starting next round:
- DatePicker for end date
- TimePicker for end time
- Combine into ISO timestamp
- Call new start-next-round API
- Update UI messaging to reflect manual round progression

## Frontend Logic

8. **Add date/time utilities:**

- Helper function to combine date + time into ISO timestamp
- Helper function to parse ISO timestamp into date/time components
- Validation for future dates/times

## Testing Considerations

9. **Verify:**

- End round no longer creates next round matches
- Start next round requires date/time selection
- Matchmaking only happens when starting next round
- End dates are properly stored and displayed
- Schema migration runs successfully

### To-dos

- [ ] Add userVotingPackage and vote tables to zero-schema.ts with proper permissions
- [ ] Create database migration script to add new tables and indexes
- [ ] Create purchase-package API endpoint with upgrade-only logic
- [ ] Modify vote-match API to check for existing votes and use package weight
- [ ] Create purchase page UI with 3 package options and upgrade logic
- [ ] Update cup page to query voting package, check existing votes, and disable buttons
- [ ] Update MatchDetail and MatchListItem components to show voting weight and vote status
- [ ] Test all voting scenarios: purchase, upgrade, voting, duplicate prevention