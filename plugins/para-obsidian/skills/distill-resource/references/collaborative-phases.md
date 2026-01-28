# Collaborative Phases

Detailed guidance for the user-interactive phases (2-4) of progressive summarization.

---

## Phase 2: Layer 2 - Bold Passages

### Your Role as Tiago Forte

Act as a learning partner, not just a summarizer:

1. **Teach** - Explain key concepts as you encounter them
2. **Question** - Ask what resonates with the user
3. **Guide** - Help identify what's truly important vs. just interesting

### Present Suggestions One at a Time

```
Here's a passage that stood out:

> [passage from suggested_bold_passages]

**Why it matters:** [why from subagent]

Would you **bold** this? (yes / no / your pick for something else)
```

### Build the Bold Layer

As user approves/modifies:

```
Great. Here's Layer 2 so far:

**[Bolded passage 1]**

**[Bolded passage 2]**

[Continue, or move to Layer 3?]
```

See [layer-definitions.md](layer-definitions.md) for compression targets.

---

## Phase 3: Layer 3 - Highlighted Core

### Review Bold Passages

```
Here's everything we bolded:

**[Passage 1]**
**[Passage 2]**
**[Passage 3]**

Now for Layer 3: What's the ==absolute essence==?

The subagent suggested: "[suggested_highlights from earlier]"

Does that resonate, or would you highlight something different?
```

### Capture Highlights

```
Perfect. Layer 3 (Highlighted Core):

==The key insight is [highlighted passage]==

Ready for the final layer - your Executive Summary?
```

---

## Phase 4: Layer 4 - Executive Summary

### The User's Words

**This is the most important layer.** It must be in the user's own words, not yours.

```
## Layer 4: Executive Summary

This is where you capture what YOU learned - in your own words.

Based on our conversation, what are the 3-5 things you want to remember?

Don't just repeat what the article said. What does this mean for YOU?
```

### Guide Without Dictating

If user struggles, offer prompts:

```
Some questions to spark your thinking:

- What surprised you most?
- What will you do differently because of this?
- How does this connect to something you're working on?
- What's the one thing you'd tell a friend about this?
```

### Capture Their Summary

```
Great summary! Here's what we'll save:

**Executive Summary:**
1. [User's takeaway 1]
2. [User's takeaway 2]
3. [User's takeaway 3]

Does this capture it? (yes / adjust)
```

---

## Phase 5: Update Note & Mark Distilled

### Update the Resource Content

**CRITICAL:** Use `para_replace_section` to REPLACE template content, not `para_insert` which appends.

```typescript
// Replace Key Insights section (remove template placeholders)
para_replace_section({
  file: "03 Resources/[filename]",
  heading: "Key Insights",
  content: "[Formatted key insights from Phase 2]",
  response_format: "json"
})

// Replace Notable Quotes section
para_replace_section({
  file: "03 Resources/[filename]",
  heading: "Notable Quotes",
  content: "[Bold passages as blockquotes]",
  response_format: "json"
})

// Replace Layer 2 section (inside Progressive Summary)
para_replace_section({
  file: "03 Resources/[filename]",
  heading: "Layer 2: Bold Passages",
  content: "[Bolded passages from Phase 2]",
  response_format: "json"
})

// Replace Layer 3 section
para_replace_section({
  file: "03 Resources/[filename]",
  heading: "Layer 3: Highlighted Core",
  content: "[Highlighted content from Phase 3]",
  response_format: "json"
})

// Replace Layer 4 section
para_replace_section({
  file: "03 Resources/[filename]",
  heading: "Layer 4: Executive Summary",
  content: "[User's summary from Phase 4]",
  response_format: "json"
})

// Replace Action Items with research tasks identified
para_replace_section({
  file: "03 Resources/[filename]",
  heading: "Action Items",
  content: "[Action items from discussion, or remove placeholder]",
  response_format: "json"
})
```

**Why `para_replace_section` instead of `para_insert`:**
- `para_insert` appends/prepends, leaving template placeholders behind
- `para_replace_section` completely replaces content under a heading
- This removes `<!-- comments -->` and placeholder bullets like `- / - / -`

### Mark as Distilled

```typescript
para_fm_set({
  file: "03 Resources/[filename]",
  set: { "distilled": "true" },
  response_format: "json"
})
```

### Completion Message

```
✅ Distillation complete!

**📚 [Resource Title]** is now fully processed.

You've transformed raw information into personal knowledge:
- Layer 2: Bolded the important parts
- Layer 3: Highlighted the essence
- Layer 4: Captured YOUR takeaways

---

[N] undistilled resources remaining. Distill another? (yes / done)
```
