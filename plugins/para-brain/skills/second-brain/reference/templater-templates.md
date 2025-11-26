# Templater-Compatible PARA Templates

All para-brain templates use [Templater](https://silentvoid13.github.io/Templater/) syntax for dynamic content generation in Obsidian.

## Prerequisites

1. Install [Templater plugin](https://obsidian.md/plugins?id=templater-obsidian) in Obsidian
2. Configure template folder path: Settings → Templater → Template folder location → `06_Metadata/Templates`
3. Enable templates on file creation: Settings → Templater → Trigger Templater on new file creation

## Template Syntax Reference

### Date Functions

```markdown
<% tp.date.now("YYYY-MM-DD") %>           # Current date: 2025-11-26
<% tp.date.now("dddd, MMMM D, YYYY") %>   # Long format: Tuesday, November 26, 2025
<% tp.date.now("YYYY-MM-DD", -1) %>       # Yesterday
<% tp.date.now("YYYY-MM-DD", 1) %>        # Tomorrow
<% tp.date.now("YYYY-[W]ww") %>           # Week number: 2025-W48
```

### User Input Prompts

```markdown
<% tp.system.prompt("Title") %>                    # Simple prompt
<% tp.system.prompt("Priority (low/medium/high)", "medium") %>  # With default
<% tp.system.prompt("Source URL (optional)", "") %>             # Optional field
```

## Available Templates

### Core PARA Templates

#### 1. Project Template (`project.md`)
**Purpose**: Time-bound goals with end dates

**Prompts**:
- Project title
- Target completion date (YYYY-MM-DD)
- Area (parent area this project belongs to)

**Use for**:
- Client work with deadlines
- Personal projects (e.g., "Learn TypeScript", "Plan vacation")
- Any goal that can be "finished"

**Example**: Create "Build portfolio site" with target date 2025-12-15

---

#### 2. Area Template (`area.md`)
**Purpose**: Ongoing responsibilities without end dates

**Prompts**:
- Area title

**Use for**:
- Career/professional development
- Health & fitness
- Parenting (e.g., "Levi & Parenting")
- Household maintenance
- Relationships

**Example**: Create "Health & Fitness" area to track ongoing wellness

---

#### 3. Resource Template (`resource.md`)
**Purpose**: Reference material and learnings

**Prompts**:
- Resource title
- Source type (book/article/video/course/podcast/etc.)
- Source URL (optional)
- Author (optional)
- Primary area (required - links resource to an area)
- Main topic (for tagging)

**Frontmatter**:
```yaml
areas:
  - "[[Primary Area]]"    # Required - at least one area
  - "[[Secondary Area]]"  # Optional - add more as needed
reviewed: 2025-11-26      # For review tracking
```

**Features**:
- **Area linkage** - Resources link to one or more areas (required)
- Progressive summarization layers (4 levels)
- Connection mapping to other notes
- Action items extraction
- Review date tracking

**Use for**:
- Book notes
- Course materials
- Technical documentation
- Articles worth saving

**Querying resources by area**:
```dataview
TABLE source, author
FROM "03_Resources"
WHERE contains(areas, this.file.link)
```

**Example**: Create resource from conference talk, link to "Software Development" and "Learning" areas

---

#### 4. Capture Template (`capture.md`)
**Purpose**: Zero-friction inbox capture

**Prompts**:
- Title (what is this?)
- Content (the raw capture)
- Captured from (thought/article/conversation/email/meeting)
- Resonance (inspiring/useful/personal/surprising)
- Urgency (high/medium/low)

**Timestamps**: Includes HH:mm for precise capture time

**Use for**:
- Quick thoughts
- Voice memo transcriptions
- Email excerpts
- Meeting notes to process later

**Example**: Capture idea from conversation, tag as "inspiring", process within 48h

---

### Workflow Templates

#### 5. Daily Note Template (`daily.md`)
**Purpose**: Daily planning and reflection

**Auto-fills**:
- Today's date in title and frontmatter
- Day of week header (e.g., "Tuesday, November 26, 2025")
- Links to yesterday and tomorrow's notes

**Sections**:
- Morning: Focus, priorities, energy/mood
- Daily Log: Captures, meetings, progress, blockers
- Evening: Wins, improvements, gratitude, tomorrow's setup
- Links: Related notes, active projects, areas maintained

**Use for**:
- Morning intention setting
- Throughout-day capture
- Evening reflection
- Weekly review reference

**Example**: Auto-created each morning when opening Obsidian

---

#### 6. Weekly Review Template (`weekly-review.md`)
**Purpose**: GTD-style weekly planning ritual

**Auto-fills**:
- Week number (e.g., "2025-W48")
- Week date range
- Next review date (+7 days)

**Phases**:
1. Clear the Mind - Brain dump, inbox status
2. Review Calendar - Past and upcoming week
3. Review Projects - Active project status, stale projects
4. Review Areas - Check-in on ongoing responsibilities
5. Review Goals - Wins, challenges, lessons
6. Express - Ideas ready to create, patterns noticed
7. Plan Next Week - Top 3 priorities, focus projects

**Includes**: Dataview query for active projects

**Use for**:
- End of week reflection
- Planning next week's priorities
- Identifying stale projects
- Capturing emerging patterns

**Example**: Run every Friday afternoon to close the week

---

### Task Management Templates

#### 7. Task Template (`task.md`)
**Purpose**: Granular task tracking with dependencies

**Prompts**:
- Task title
- Task type (task/reminder/habit/chore)
- Due date (YYYY-MM-DD)
- Priority (low/medium/high/urgent) - defaults to "medium"
- Effort (small/medium/large) - defaults to "medium"
- Project (optional)
- Area (optional)

**Fields**:
- Status: not-started, in-progress, blocked, done, cancelled
- Dependencies: Depends on, blocks, dependency type
- Success criteria checklist

**Special sections by type**:
- **Tasks**: Effort estimate, next action
- **Reminders**: Alert time, recurrence
- **Habits**: Frequency, streak, best time
- **Chores**: Seasonal, approximate duration

**Use for**:
- Project breakdown (large → small tasks)
- Recurring habits (gym 3x/week)
- Seasonal chores (clean gutters)
- Time-sensitive reminders

**Example**: Create "Review PR #123" task, medium priority, blocks "Deploy v2.0"

---

### Travel/Event Templates

#### 8. Booking Template (`booking.md`)
**Purpose**: Track reservations and confirmations

**Prompts**:
- Booking title
- Booking type (accommodation/flight/activity/transport/dining)
- Project (parent trip/event)
- Booking date (YYYY-MM-DD)

**Fields**:
- Booking reference number
- Provider details
- Cost and payment status
- Cancellation deadline
- Contact information (phone, email, website)

**Use for**:
- Travel accommodations
- Restaurant reservations
- Activity bookings
- Transport tickets

**Example**: Create booking for "Cradle Mountain Lodge" with confirmation number

---

#### 9. Checklist Template (`checklist.md`)
**Purpose**: Reusable checklists for recurring workflows

**Prompts**:
- Checklist title
- Checklist type (packing/groceries/snacks/tasks)
- Project (parent project)

**Features**:
- Multiple categorized sections
- Timeline with milestone dates (2 weeks before, 1 week before, day before, day of)
- Dependency tracking

**Use for**:
- Packing lists for trips
- Grocery shopping lists
- Pre-departure checklists
- Event preparation

**Example**: Create "Hiking Gear Checklist" for Tasmania trip

---

#### 10. Itinerary Day Template (`itinerary-day.md`)
**Purpose**: Detailed daily travel plans

**Prompts**:
- Day title (e.g., "Day 1 - Cradle Mountain")
- Project (parent trip)
- Trip date (YYYY-MM-DD)
- Day number (1, 2, 3...)

**Sections**:
- Overview: Location, accommodation, energy level
- Time blocks: Morning, afternoon, evening
- Meals: Breakfast, lunch, dinner with booking status
- Transport: Driving times, logistics
- What to bring: Day-specific items
- Bookings: Links to relevant booking notes
- Navigation: Previous day | Project | Next day

**Use for**:
- Multi-day trips
- Conference schedules
- Event itineraries

**Example**: Create "Day 3 - Strahan" with Gordon River Cruise booking linked

---

#### 11. Trip Research Template (`trip-research.md`)
**Purpose**: Research notes for travel planning

**Prompts**:
- Research title (e.g., "Hiking Boots Research")
- Research type (activities/dining/hike/gear/transport)
- Project (parent trip)

**Sections**:
- Options comparison (multiple options with cost, pros/cons)
- Practical information (timing, getting there, what to bring)
- Sources (where info came from)
- Decision (what was chosen, link to booking)

**Use for**:
- Activity research
- Restaurant options
- Gear comparisons
- Route planning

**Example**: Research "Best hikes in Cradle Mountain" with difficulty ratings

---

## Template Usage Patterns

### New Project Workflow

1. Create project note from `project.md`
   - Set title and target date
   - Link to parent area
2. Break down into tasks using `task.md`
   - Set dependencies
   - Estimate effort
3. Create weekly review entry to track progress
4. Archive to `04_Archive/YYYY/` when complete

### Travel Planning Workflow

1. Create project note for trip
2. Research activities/dining using `trip-research.md`
3. Book reservations, create `booking.md` for each
4. Create day-by-day itinerary with `itinerary-day.md`
5. Build checklists (packing, groceries) with `checklist.md`
6. Link everything back to project note

### Daily Capture & Processing

1. Morning: Open `daily.md` auto-created note
   - Set top 3 priorities
   - Check #urgent items
2. Throughout day: Quick captures to `00_Inbox/`
   - Use `capture.md` if structured
   - Or just create plain note for processing later
3. Evening: Reflect in daily note
   - What went well?
   - Link to projects touched
4. Weekly: Process inbox using PARA decision tree

## Best Practices

### Templater Tips

1. **Set default folder**: Configure Templater to auto-create daily notes in `00_Inbox/`
2. **Hotkeys**: Assign keyboard shortcuts for frequent templates (e.g., ⌘+D for daily note)
3. **Template testing**: Test changes in a separate note before updating main templates

### Frontmatter Consistency

All templates include standard frontmatter:
- `title`: Note title
- `created`: Creation date (YYYY-MM-DD)
- `type`: Template type (project/area/resource/etc.)
- `tags`: Array of relevant tags

### Linking Strategy

- **Projects** → Link to parent Area (single `area:` field)
- **Tasks** → Link to parent Project and/or Area (single `area:` field)
- **Resources** → Link to related Areas (required `areas:` array - can have multiple)
- **Daily notes** → Link to Projects touched and Areas maintained

### Dataview Queries

Several templates include embedded Dataview queries:
- **Area template**: Shows all projects in this area
- **Weekly review**: Lists active projects sorted by due date

Requires [Dataview plugin](https://obsidian.md/plugins?id=dataview) to be installed.

## Customization

### Adding New Templates

1. Create new `.md` file in `06_Metadata/Templates/`
2. Use Templater syntax for dynamic content
3. Include standard frontmatter
4. Add reference to this document

### Modifying Existing Templates

1. Edit template file directly
2. Test with new note creation
3. Existing notes remain unchanged (templates are blueprints)
4. Update this reference document if changing prompts

### Template Snippets

Common patterns for custom templates:

```markdown
# File creation date
created: <% tp.date.now("YYYY-MM-DD") %>

# Title with prompt
title: "<% tp.system.prompt("Title") %>"

# Optional field with default
priority: <% tp.system.prompt("Priority", "medium") %>

# Calculated date (7 days from now)
due_date: <% tp.date.now("YYYY-MM-DD", 7) %>

# Current file title
# <% tp.file.title %>

# Link to another note
related: [[<% tp.system.prompt("Related note") %>]]
```

## Troubleshooting

### Template not working

1. Check Templater plugin is installed and enabled
2. Verify template folder path in settings
3. Ensure template file has `.md` extension
4. Look for syntax errors in template code

### Prompts not appearing

1. Check Templater is set to run on new file creation
2. Verify you're creating from template (not just new note)
3. Try manual template insertion: Cmd+P → "Templater: Open Insert Template modal"

### Dates showing as code

1. Templater syntax should be `<% %>` not `{{ }}`
2. Check date format string matches moment.js patterns
3. Ensure no typos in function names (`tp.date.now` not `tp.date.new`)

## Further Reading

- [Templater Documentation](https://silentvoid13.github.io/Templater/)
- [PARA Method](para-method.md)
- [CODE Method](code-method.md)
- [Obsidian Best Practices](obsidian-best-practices.md)
