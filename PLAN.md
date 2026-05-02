# Plan: Implement Repeated Mistakes Feature

## Context
Users want to identify patterns in their gameplay by viewing "repeated mistakes". A mistake is defined as a significant drop in evaluation after a move. The feature should group these mistakes by position (FEN) and show positions that occur at least twice.

## Approach

### 1. Engine Service Update
Modify `calculateErrors` in `src/main/services/engine/engineService.ts` to return the indices of moves that resulted in errors, instead of just a count.
- New return type: `{ whitePlayer: number[]; blackPlayer: number[]; }`

### 2. Game Analysis Update
Update `analyseGame` in `src/renderer/GameList/GameList.tsx` to handle the new return type from `calculateErrors`. The `analysis` object in the `Game` interface will now store the indices of moves that were mistakes.

### 3. New Component: `RepeatedMistakes`
Create a new component `RepeatedMistakes.tsx` in `src/renderer/GameStatistics/`.
- This component will:
    - Accept all `games` as a prop.
    - Iterate through all games to collect all mistake move indices.
    - For each mistake index, reconstruct the FEN of the position *before* that move using `chess.js` and the game's moves.
    - Count the occurrences of each FEN.
    - Filter for FENs that appear $\ge 2$ times.
    - Display the repeated FENs, potentially with a link to view them.

### 4. Integrate into Statistics
Update `src/renderer/GameStatistics/GameStatistics.tsx` to include a way to navigate to and display the `RepeatedMistakes` view.

## Files to modify
- `src/main/services/engine/engineService.ts`
- `src/renderer/GameList/GameList.tsx`
- `src/renderer/GameStatistics/GameStatistics.tsx`
- `src/renderer/GameStatistics/RepeatedMistakes.tsx` (New file)

## Reuse
- `chess.js` for reconstructing FENs from moves.
- `calculateErrors` logic from `engineService.ts`.
- Existing `Game` and `GameDecorator` interfaces.

## Steps
- [ ] Modify `calculateErrors` to return move indices.
- [ ] Update `analyseGame` in `GameList.tsx` to store these indices in the analysis object.
- [ ] Create `RepeatedMistakes.tsx` component.
- [ ] Integrate `RepeatedMistakes` component into `GameStatistics.tsx`.
- [ ] Verify the feature works by analyzing multiple games with known repeated mistakes.

## Verification
- Run the application.
- Analyze several games where certain positions are intentionally mistreated.
- Check if the "Repeated Mistakes" section correctly identifies and displays the recurring FENs.
