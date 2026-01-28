# Stakeholder Bootstrap Wizard

> **Tip:** For ongoing stakeholder management outside of triage, use
> `/para-obsidian:stakeholder` (add, remove, lookup, list).

When `config.stakeholders` is empty or missing AND inbox contains voice memos/transcriptions, offer to add stakeholders.

**Skip bootstrap if:** No voice memos in inbox (stakeholders mainly help with transcription speaker matching).

---

## Prompt

```
No stakeholders configured. Stakeholders help match speakers in transcriptions
to projects and improve meeting classification.

Would you like to add stakeholders now?
(1) Paste a list (table, CSV, or JSON)
(2) Add one at a time
(3) Skip for now
```

---

## Option 1: Bulk Paste (recommended)

Accept any of these formats:

**Table format:**
```
Name            | Role          | Email                  | Company  | Squad
June Xu         | Developer     | JXu3@bunnings.com.au   | Bunnings | GMS (POS Yellow)
Mustafa Jalil   | Backend Dev   | MJalil@bunnings.com.au | Bunnings | GMS (POS Yellow)
```

**CSV format:**
```
name,role,email,company,squad,project,alias
June Xu,Developer,JXu3@bunnings.com.au,Bunnings,GMS (POS Yellow),[[🎯 GMS]],
Mustafa Jalil,Backend Dev,MJalil@bunnings.com.au,Bunnings,GMS (POS Yellow),[[🎯 GMS]],MJ
```

**JSON format:**
```json
[
  { "name": "June Xu", "role": "Developer", "email": "JXu3@bunnings.com.au" },
  { "name": "Mustafa Jalil", "alias": "MJ", "role": "Backend Dev" }
]
```

Parse the input, show confirmation:
```
Parsed 13 stakeholders:
- June Xu (Developer) - Bunnings/GMS
- Mustafa Jalil aka MJ (Backend Dev) - Bunnings/GMS
- ...

Save to config? (y/n)
```

---

## Option 2: One at a Time

```
Add a stakeholder (or press Enter to finish):

Name: June Xu
Email (optional): JXu3@bunnings.com.au
Role (optional): Developer
Company (optional): Bunnings
Squad (optional): GMS (POS Yellow)
Project wikilink (optional): [[🎯 GMS - Gift Card Management System]]
Alias (optional):

Added June Xu. Add another? (y/n)
```

---

## Save to Config

After collecting stakeholders (either method), write to config:

```bash
# Read existing config, merge stakeholders, write back
cat ~/.config/para-obsidian/config.json 2>/dev/null || echo '{}'
# Merge new stakeholders with existing, write back
```
