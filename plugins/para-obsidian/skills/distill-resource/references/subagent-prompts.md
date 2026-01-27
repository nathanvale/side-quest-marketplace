# Subagent Prompts

Detailed prompts for the prep and content subagents used in distill-resource.

## Phase 0: Prep Subagent

Finds undistilled resources and returns a selection list.

```typescript
Task({
  subagent_type: "general-purpose",
  description: "Prep distillation: find undistilled resources",
  model: "haiku",
  prompt: `
You are preparing resources for progressive summarization.

## Your Task

1. **Find undistilled resources:**
   para_list({ path: "03 Resources", response_format: "json" })

   For each file, check frontmatter:
   para_frontmatter_get({ file: "03 Resources/[filename]", response_format: "json" })

   Filter for: distilled === false (or distilled field missing)

2. **Sort by recency** (most recent first by 'created' date)

3. **Return JSON:**
   {
     "undistilled_count": N,
     "resources": [
       {
         "file": "03 Resources/📚 Title.md",
         "title": "Title",
         "created": "2024-01-25",
         "age": "2 days ago",
         "summary": "Brief summary from frontmatter",
         "resource_type": "article",
         "source": "https://..."
       }
     ]
   }

Return ONLY the JSON, no other text.
  `
})
```

---

## Phase 1: Content Subagent

Fetches full source content and prepares analysis for collaboration.

```typescript
Task({
  subagent_type: "general-purpose",
  description: "Fetch and analyze: [resource title]",
  model: "sonnet",
  prompt: `
You are preparing content for progressive summarization.

## Resource
File: [selected file path]
Source: [source URL from frontmatter]

## Content Sourcing

For tool selection based on URL domain, see:
@plugins/para-obsidian/references/content-sourcing/url-routing.md

## Your Task

1. **Read the resource note:**
   para_read({ file: "[path]", response_format: "json" })

2. **Fetch full source content** (if Layer 1 is sparse):
   - YouTube: @plugins/para-obsidian/references/content-sourcing/youtube.md
   - X/Twitter: @plugins/para-obsidian/references/content-sourcing/x-twitter.md
   - Other URLs: @plugins/para-obsidian/references/content-sourcing/firecrawl.md

3. **Analyze the content and return JSON:**
   {
     "title": "Resource title",
     "source": "URL",
     "existing_summary": "From frontmatter",
     "content_overview": "2-3 sentence overview of what this content covers",
     "key_topics": ["Topic 1", "Topic 2", "Topic 3"],
     "suggested_bold_passages": [
       {
         "passage": "The actual text to potentially bold",
         "why": "Why this is important"
       }
     ],
     "suggested_highlights": [
       "The absolute essence - 1-2 sentences"
     ],
     "questions_for_user": [
       "What drew you to save this?",
       "How does this connect to your current work?"
     ],
     "needs_user_help": false  // true if Twitter URL couldn't be fetched
   }

Keep suggested_bold_passages to 5-7 items max.
Return ONLY the JSON, no other text.
  `
})
```

---

## Response Schema

### Prep Subagent Response

```typescript
interface PrepResponse {
  undistilled_count: number;
  resources: Array<{
    file: string;        // Full path: "03 Resources/📚 Title.md"
    title: string;       // Display title without emoji
    created: string;     // ISO date: "2024-01-25"
    age: string;         // Human readable: "2 days ago"
    summary: string;     // From frontmatter
    resource_type: string; // article, video, thread, etc.
    source: string;      // Original URL
  }>;
}
```

### Content Subagent Response

```typescript
interface ContentResponse {
  title: string;
  source: string;
  existing_summary: string;
  content_overview: string;
  key_topics: string[];
  suggested_bold_passages: Array<{
    passage: string;     // Actual text to potentially bold
    why: string;         // Why this is important
  }>;
  suggested_highlights: string[];
  questions_for_user: string[];
  needs_user_help: boolean;
}
```
