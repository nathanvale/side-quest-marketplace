#!/usr/bin/env bash
set -e

cd /Users/nathanvale/code/side-quest-marketplace/plugins/para-obsidian

echo "Converting daily..."
bun src/cli.ts convert "_Sort/Test Daily Note.md" --template daily
cd $PARA_VAULT && git add -A && git commit --no-verify -m "feat: convert daily note" && cd -

echo "Converting weekly-review..."
bun src/cli.ts convert "_Sort/Test Weekly Review Note.md" --template weekly-review
cd $PARA_VAULT && git add -A && git commit --no-verify -m "feat: convert weekly-review note" && cd -

echo "Converting capture..."
bun src/cli.ts convert "_Sort/Test Capture Note.md" --template capture
cd $PARA_VAULT && git add -A && git commit --no-verify -m "feat: convert capture note" && cd -

echo "Converting checklist..."
bun src/cli.ts convert "_Sort/Test Checklist Note.md" --template checklist
cd $PARA_VAULT && git add -A && git commit --no-verify -m "feat: convert checklist note" && cd -

echo "Converting booking..."
bun src/cli.ts convert "_Sort/Test Booking Note.md" --template booking
cd $PARA_VAULT && git add -A && git commit --no-verify -m "feat: convert booking note" && cd -

echo "Converting itinerary-day..."
bun src/cli.ts convert "_Sort/Test Itinerary Note.md" --template itinerary-day
cd $PARA_VAULT && git add -A && git commit --no-verify -m "feat: convert itinerary-day note" && cd -

echo "Converting trip-research..."
bun src/cli.ts convert "_Sort/Test Research Note.md" --template trip-research
cd $PARA_VAULT && git add -A && git commit --no-verify -m "feat: convert trip-research note" && cd -

echo "All conversions complete!"
