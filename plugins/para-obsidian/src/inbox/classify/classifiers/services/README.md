# Classifier Domain Services

Domain services for classifier generation following Single Responsibility Principle.
Each service handles one aspect of classifier configuration.

## Services

### scoring-calculator.ts

Calculates confidence scoring thresholds for classifiers.

**Responsibilities:**
- Provide default scoring configuration (30% heuristic, 70% LLM)
- Validate scoring weights sum to 1.0
- Validate threshold ordering (high > medium)
- Support custom scoring configurations

**Usage:**
```typescript
import { calculateScoringConfig, DEFAULT_SCORING_CONFIG } from './scoring-calculator';

// Use defaults
const scoring = calculateScoringConfig();

// Custom weights
const scoring = calculateScoringConfig({
  heuristicWeight: 0.6,  // Heuristic-heavy for well-structured docs
  llmWeight: 0.4
});
```

### pattern-builder.ts

Builds weighted heuristic patterns for filename and content matching.

**Responsibilities:**
- Assign sensible weight defaults based on pattern specificity
- Normalize pattern weights to valid ranges (0.0-1.0)
- Support both string patterns and explicit weight objects

**Usage:**
```typescript
import { buildFilenamePatterns, buildContentMarkers } from './pattern-builder';

const filenamePatterns = buildFilenamePatterns([
  'invoice',  // Gets default weight 1.0
  { pattern: 'bill', weight: 0.8 }
]);

const contentMarkers = buildContentMarkers([
  'total amount',  // Gets default weight 0.8
  { pattern: 'tax invoice', weight: 1.0 }
]);
```

### field-mapper.ts

Maps LLM extraction field names to Templater prompt text.

**Responsibilities:**
- Generate user-friendly Templater prompts from field definitions
- Add type hints (e.g., "YYYY-MM-DD" for dates)
- Create field mapping objects
- Add common field aliases (e.g., 'date' → 'statementDate')
- Validate field mappings for completeness

**Usage:**
```typescript
import { buildFieldMappings, validateFieldMappings } from './field-mapper';

const fields = [
  { name: 'statementDate', type: 'date', description: 'Statement date', requirement: 'required' },
  { name: 'amount', type: 'currency', description: 'Total amount', requirement: 'required' }
];

const mappings = buildFieldMappings(fields);
// => {
//   statementDate: 'Statement date (YYYY-MM-DD)',
//   amount: 'Total amount',
//   date: 'Statement date (YYYY-MM-DD)',  // Auto-generated alias
// }

const warnings = validateFieldMappings(fields, mappings);
if (warnings.length > 0) {
  console.warn('Field mapping warnings:', warnings);
}
```

## Design Principles

**Single Responsibility:**
- Each service handles one aspect of classifier configuration
- Services are <100 lines of code
- Clear separation of concerns

**Pure Functions:**
- No side effects
- Deterministic outputs
- Easy to test and reason about

**Type Safety:**
- Full TypeScript strict mode compliance
- Readonly types prevent accidental mutation
- Validation functions throw descriptive errors

**Composability:**
- Services can be used independently or together
- Output of one service can feed into another
- No hidden dependencies between services
