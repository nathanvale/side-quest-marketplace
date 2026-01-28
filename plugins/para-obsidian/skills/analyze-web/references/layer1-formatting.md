# Layer 1 Content Formatting

Format and truncate captured content for Layer 1 of progressive summarization.

## Token Targets

| Source | Target | Strategy |
|--------|--------|----------|
| Article | 2-3k tokens (~1500-2000 words) | First 3 paragraphs + headings + conclusion |
| YouTube | 2-3k tokens (~10% of transcript) | Sample every Nth segment with timestamps |
| Thread | Full content | Usually short enough to keep all |
| Voice (as resource) | 2-3k tokens | Full if short, otherwise sample key segments |

**Goal:** Scannable, not exhaustive. Enough for progressive summarization to work with.

---

## Article Truncation

Extract structure and key content:

```markdown
## Layer 1: Captured Notes

### Overview
[First 2-3 paragraphs - the hook and context]

### Key Sections
- **[H2 Heading 1]**: [First sentence or key point]
- **[H2 Heading 2]**: [First sentence or key point]
- **[H2 Heading 3]**: [First sentence or key point]

### Conclusion
[Final 1-2 paragraphs - the takeaway]

---
*Truncated from full article. Use /distill-resource for deeper analysis.*
```

**Example:**

Input: 5000-word article on TypeScript generics

Output:
```markdown
## Layer 1: Captured Notes

### Overview
TypeScript generics enable writing reusable, type-safe code that works with multiple types. Instead of using `any` and losing type information, generics let you capture and propagate types through your functions.

This guide covers practical patterns from simple identity functions to advanced conditional types.

### Key Sections
- **Basic Generic Functions**: The identity function `<T>(x: T): T` demonstrates how generics capture input types
- **Generic Constraints**: Use `extends` to restrict what types T can be
- **Generic Classes**: Create reusable data structures like `Stack<T>` or `Queue<T>`
- **Conditional Types**: Build types that adapt based on input: `T extends Array<infer U> ? U : T`

### Conclusion
Start with simple generic functions, then progress to constraints and conditional types as needed. The key insight: generics are about preserving type information across boundaries.

---
*Truncated from full article. Use /distill-resource for deeper analysis.*
```

---

## YouTube Sampling

Sample ~10% of transcript segments with timestamps:

```markdown
## Layer 1: Captured Notes

### Transcript Samples

**[0:00]** [Opening - what the video is about]

**[2:30]** [Key point or demonstration]

**[5:15]** [Important concept explained]

**[8:45]** [Notable example or insight]

**[12:00]** [Another key segment]

**[15:30]** [Conclusion or summary]

---
*Sampled from full transcript. Use /distill-resource for deeper analysis.*
```

**Sampling Algorithm:**

1. Calculate total segments in transcript
2. Target ~10% coverage (e.g., 100 segments → 10 samples)
3. Select evenly distributed segments
4. Always include: first segment (intro), last segment (conclusion)
5. Prefer segments with transition words: "importantly", "key point", "in summary"

**Example:**

Input: 20-minute video, 120 transcript segments

Output:
```markdown
## Layer 1: Captured Notes

### Transcript Samples

**[0:00]** Today we're going to build a complete authentication system using Bun and Hono. By the end, you'll have JWT auth, refresh tokens, and secure password hashing.

**[3:20]** The key thing to understand about JWTs is they're stateless. The server doesn't need to store session data - the token itself contains the claims.

**[7:45]** For password hashing, we're using Bun's native crypto. Never store plain text passwords, and always use a unique salt per user.

**[11:30]** Refresh tokens solve the "too short vs too long" dilemma. Short-lived access tokens for security, long-lived refresh tokens for convenience.

**[15:15]** Here's where most tutorials get it wrong - you need to invalidate refresh tokens on logout. Store a token version in your database.

**[19:00]** To recap: JWTs for access, refresh tokens for persistence, bcrypt for passwords, and always validate on the server side.

---
*Sampled from full transcript. Use /distill-resource for deeper analysis.*
```

---

## Thread Preservation

Twitter/X threads are usually short enough to keep in full:

```markdown
## Layer 1: Captured Notes

### Thread

**1/** [First tweet - the hook]

**2/** [Explanation or context]

**3/** [Key point]

**4/** [Example or evidence]

**5/** [Conclusion or CTA]

---
*Full thread captured.*
```

If thread exceeds 3k tokens (rare), apply article truncation strategy.

---

## Voice Memo (as Resource)

When a voice memo becomes a resource (idea, reflection) rather than a meeting:

```markdown
## Layer 1: Captured Notes

### Transcription

[Full transcription if <2k tokens]

OR

[Sampled segments with timestamps if >2k tokens]

---
*Transcription captured. Use /distill-resource to extract key insights.*
```

**Note:** Meetings don't use Layer 1 - they have structured sections (attendees, decisions, action items).

---

## Formatting Rules

1. **Use H2 for "Layer 1: Captured Notes"** - matches resource template structure
2. **Use H3 for subsections** - consistent visual hierarchy
3. **Include source indicator** - truncation note tells user original is longer
4. **Preserve code blocks** - critical for technical content
5. **Keep bullet points** - scannable format
6. **Bold key terms** - aids progressive summarization later

---

## Error Cases

If content cannot be properly truncated:

1. **Empty content**: Skip Layer 1 injection, set `layer1_injected: false`
2. **Parse error**: Include raw first 2000 chars with warning
3. **Binary/non-text**: Skip Layer 1, note in `notes` field

Always prefer partial content over no content - the user can enhance during distillation.
