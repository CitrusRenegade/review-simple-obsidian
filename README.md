# Review Simple

Obsidian plugin for periodic note review. Tracks the last review date in each note's frontmatter and shows which notes are overdue.

<img src="docs/assets/hero.png" alt="Review Simple commands in the palette" width="650">

## Features

- Per-note status bar indicator: `✓ 2025-11-04`, `⚠ due · 2025-09-10`, or `⚠ not reviewed`.
- Folder filter: **excluded** mode or **included**-only mode. Both lists preserved when switching.
- Intervals can be set at three levels: global default, per-folder rules, per-note frontmatter.
- Mark as reviewed via status bar click or command palette.
- Data stored in note frontmatter — no external database.
- Vault-wide counter of notes currently due for review.


<video src="https://github.com/user-attachments/assets/0aa6c179-e7a6-43a1-a914-7f7c487f79d9">


## Quick start

1. Install (see below).
2. Open a note, run `Review Simple: Mark current note as reviewed`.
3. Status bar shows `✓ <today>`. The note is now tracked.

After the interval (45 days by default), the indicator switches to `⚠ due` and the counter increments.

## Intervals

Resolution order:

1. `review_interval` in the note's frontmatter (number of days, or `never` to exclude).
2. Folder rule (longest matching path wins).
3. Global default.

Example per-note frontmatter:

```yaml
---
reviewed: 2025-10-15
review_interval: 14
---
```

## Commands

- `Open random note for review` — opens a random note that's currently due.
- `Mark current note as reviewed` — writes today's date to frontmatter.

Clicking the status bar items triggers the same actions.

## Installation

Via [BRAT](https://github.com/TfTHacker/obsidian42-brat):

1. Install BRAT from Community Plugins.
2. BRAT settings → *Add Beta Plugin* → `CitrusRenegade/review-simple-obsidian`.
3. Enable *Review Simple* in Community Plugins.

Community Plugin directory submission is pending.

## Configuration

Settings → Review Simple:

- Global review interval (days).
- Folder filter mode (excluded / included-only).
- Folder-specific intervals, one `folder/path,days` rule per line.
- Toggles to hide the per-note indicator or the due counter.
- Advanced: customize frontmatter keys (`reviewed`, `review_interval`).

## Notes

- Status bar items are not visible on Obsidian mobile. Commands work everywhere.
- All data is stored in note frontmatter and created after first review.

*Inspired by the "Reviewed by .. on .." field like on WebMD. Saw this more in some knowledge bases, but cant remeber any specific.*
