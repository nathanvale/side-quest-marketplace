# Writing Techniques for Technical Explanations

## The Hook

Every document needs a first paragraph that earns the second paragraph.

**Patterns that work:**

1. **The Frustration Hook**
   > "Here's the thing about distributed systems: they lie to you. Not maliciously—they just can't help it."

2. **The Story Hook**
   > "Three months ago, this codebase was 47 files. Today it's 340. This document explains why that growth was intentional, not accidental."

3. **The Contrarian Hook**
   > "Most authentication systems are designed by people who've never had their account hacked. This one was designed by someone who has."

4. **The Question Hook**
   > "Why would anyone build another task manager? There are 10,000 of them. The answer reveals something about how software serves—or fails—neurodivergent brains."

---

## The Rule of Three Analogies

Every major concept should have at least one analogy. Complex systems need three.

**Analogy Levels:**

1. **Surface Analogy** — Gets them oriented
   > "The message queue is like a post office..."

2. **Structural Analogy** — Shows how parts relate
   > "...where each department has its own mailbox, and clerks (workers) process letters in order..."

3. **Failure Analogy** — Explains edge cases
   > "...but if the mailroom floods (queue overflow), we start stuffing letters in filing cabinets (disk-backed overflow)."

---

## Show, Don't Just Tell

**Weak:**
> "The validation is strict about input formats."

**Strong:**
> "The validator will reject `2024-1-5` (wants `2024-01-05`), will reject `$100` (wants `100.00`), and will absolutely lose its mind if you pass `null` instead of an empty string. Ask me how I know."

---

## The Confession Pattern

Admitting mistakes builds trust and teaches lessons.

**Structure:**
1. What we tried
2. Why it seemed smart
3. How it failed
4. What we learned
5. What we do now

**Example:**
> "Our first caching layer was Redis. Seemed obvious—everyone uses Redis for caching. Then we discovered our access patterns were write-heavy with low read reuse. We were paying for Redis's read optimization while suffering from its write overhead. Now we use a simple in-process LRU cache for hot data and PostgreSQL for warm data. Boring, but right."

---

## The Aside Pattern

Parenthetical wisdom that rewards careful readers.

**Examples:**
> "The function returns early on error (a pattern so common we stopped commenting it—if you're confused by early returns, this codebase will hurt)."

> "We use snake_case for database columns (yes, even though TypeScript uses camelCase—the ORM handles translation, and DBAs shouldn't have to squint at `createdAtTimestamp`)."

---

## The "Actually" Pattern

Correct common assumptions.

**Structure:**
> "[Common belief]. Actually, [surprising truth]. Here's why: [explanation]."

**Example:**
> "You'd think the bottleneck would be the database. Actually, it's JSON serialization. We're moving 50MB payloads through `JSON.stringify()` on every request. The database query takes 20ms; serialization takes 200ms. We're fixing this with streaming serialization, but for now, the irony stands."

---

## The Future Self Pattern

Write as if explaining to yourself in 6 months.

**Questions future-you will have:**
- Why didn't we just use [obvious alternative]?
- What happens if [edge case]?
- Is it safe to change [this thing]?
- Why is this code so weird?

**Answer them preemptively:**
> "You might wonder why we don't just use `Promise.all()` here. We tried. It works until you hit 100+ concurrent requests, then Node's event loop starts dropping connections. The manual batching (ugly as it is) keeps us under the threshold."

---

## Code Examples That Teach

Don't just show code—show the journey.

**Pattern:**
```typescript
// What you'd write first (and why it's wrong)
function bad() {
  return data.filter(x => x.active)  // Seems fine...
}

// What actually works (and why)
function good() {
  // .active can be undefined, null, 0, or false
  // Only `=== true` means what you think it means
  return data.filter(x => x.active === true)
}
```

---

## Signposting

Help readers navigate long documents.

**Techniques:**

1. **Section Previews**
   > "This section covers three things: how we got here, why we stayed, and why you might want to leave."

2. **Explicit Skip Permissions**
   > "If you already understand event sourcing, skip to 'Our Implementation.' If not, the next section is for you."

3. **Dependency Callouts**
   > "This section assumes you've read 'The Data Model.' If that section didn't make sense, this one won't either."

---

## Ending Strong

The conclusion should resonate, not just summarize.

**Patterns:**

1. **The Callback**
   > Return to an image or phrase from the introduction.

2. **The Zoom Out**
   > Connect the technical details to a larger principle.

3. **The Invitation**
   > Encourage the reader to take a specific next step.

4. **The Honest Admission**
   > Acknowledge what's still imperfect.

**Example:**
> "This codebase isn't perfect. There are TODOs we'll never TODO, abstractions that leak, and at least one function that's held together by hope and a hash collision. But it works. It ships. And when it breaks, we know why. That's more than most software can claim."
