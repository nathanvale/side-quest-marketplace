---
name: stakeholder-manage
description: Manage stakeholders for voice memo speaker matching. Add, list, lookup, or remove stakeholders used by triage and meeting skills. Use when team members change, to verify current configuration, or to look up "who is [alias]?"
user-invocable: true
allowed-tools: AskUserQuestion, mcp__plugin_para-obsidian_para-obsidian__para_stakeholder_list, mcp__plugin_para-obsidian_para-obsidian__para_stakeholder_add, mcp__plugin_para-obsidian_para-obsidian__para_stakeholder_remove, mcp__plugin_para-obsidian_para-obsidian__para_stakeholder_lookup, mcp__plugin_para-obsidian_para-obsidian__para_config
---

# Stakeholder Management

Manage the stakeholder list used for voice memo speaker matching, meeting note classification, and project inference.

## What Are Stakeholders?

Stakeholders are people you interact with regularly. They are stored in `~/.config/para-obsidian/config.json` under the `stakeholders` key. Other skills use them to:

- **Match speakers** in voice memo transcriptions (analyze-voice, triage)
- **Infer projects** from who was in a meeting (create-meeting)
- **Auto-classify** meeting notes by squad/company context

### Stakeholder Schema

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| `name` | Yes | Full name as it appears in transcriptions | "June Xu" |
| `email` | No | Email address for contact lookup | "JXu3@bunnings.com.au" |
| `role` | No | Job title or role | "Developer" |
| `company` | No | Company or organization | "Bunnings" |
| `squad` | No | Squad or team name | "GMS (POS Yellow)" |
| `project` | No | Related project wikilink | "[[GMS]]" |
| `alias` | No | Nickname used in transcriptions | "MJ" |

---

## Operations

### List Stakeholders

Show all currently configured stakeholders:

```
para_stakeholder_list({ response_format: "json" })
```

If no stakeholders exist, offer to add some.

### Add Stakeholders

Accept stakeholders via bulk paste or one-at-a-time entry.

#### Bulk Input (Recommended)

Accept any of these formats and parse into stakeholder objects:

**Table format:**
```
Name            | Role          | Email                  | Company  | Squad
June Xu         | Developer     | JXu3@bunnings.com.au   | Bunnings | GMS (POS Yellow)
Mustafa Jalil   | Backend Dev   | MJalil@bunnings.com.au | Bunnings | GMS (POS Yellow)
```

**CSV format:**
```
name,role,email,company,squad,project,alias
June Xu,Developer,JXu3@bunnings.com.au,Bunnings,GMS (POS Yellow),[[GMS]],
Mustafa Jalil,Backend Dev,MJalil@bunnings.com.au,Bunnings,GMS (POS Yellow),[[GMS]],MJ
```

**JSON format:**
```json
[
  { "name": "June Xu", "role": "Developer", "email": "JXu3@bunnings.com.au" },
  { "name": "Mustafa Jalil", "alias": "MJ", "role": "Backend Dev" }
]
```

#### Flow

1. Parse the input into stakeholder objects
2. Show confirmation with parsed data:
   ```
   Parsed N stakeholders:
   - June Xu (Developer) - Bunnings/GMS
   - Mustafa Jalil aka MJ (Backend Dev) - Bunnings/GMS
   ```
3. Ask user to confirm via AskUserQuestion
4. Save:
   ```
   para_stakeholder_add({ stakeholders: [...], response_format: "json" })
   ```

#### One-at-a-Time

Ask for each field interactively:
1. Name (required)
2. Email (optional)
3. Role (optional)
4. Company (optional)
5. Squad (optional)
6. Project wikilink (optional)
7. Alias (optional)

After each stakeholder, ask if they want to add another.

### Remove Stakeholder

Remove by name or alias:

```
para_stakeholder_remove({ name: "MJ", response_format: "json" })
```

If the user provides a name that doesn't match, show the error and suggest using `para_stakeholder_list` to find the correct name.

### Lookup Stakeholder

Search by name, alias, or email prefix:

```
para_stakeholder_lookup({ query: "MJ", response_format: "json" })
```

Useful for:
- "Who is MJ?"
- "Find June"
- "Look up JXu3"

---

## Detecting Intent

When the user invokes the skill without specifying an operation, check their input:

| User Says | Operation |
|-----------|-----------|
| (no argument) | List all stakeholders |
| "add" or pastes data | Add flow |
| "remove [name]" or "delete [name]" | Remove flow |
| A name/alias/question like "who is MJ?" | Lookup flow |

---

## Error Handling

| Error | Recovery |
|-------|----------|
| No stakeholders configured | Offer to add some |
| Name not found on remove | Show current list, suggest correct name |
| No matches on lookup | Suggest checking spelling or listing all |
| Config file missing | saveStakeholders creates it automatically |
