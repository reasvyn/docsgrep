# 💡 Useful New Features for AI Agents

### 1. **`fathom_meaning`** 🧠 - Semantic Search
**Description:** Searches documentation based on meaning (semantic search), not just keyword matching. Uses embeddings to understand context and intent behind queries.

**Why it matters:** Instead of matching exact keywords, AI can ask "how does internship registration work?" and get relevant docs even if the docs use different wording like "onboarding process" or "trainee enrollment."

**Use case:** AI agent exploring a large codebase can find relevant documentation without knowing exact terminology.

**Arguments:**
- `dirPath` (string, required): Absolute path to the local directory to search
- `query` (string, required): Natural language query about what you're looking for
- `topK` (number, optional): Number of top results to return (default: 5)

---

### 2. **`tldr_docs`** 📝 - Summarize Documentation
**Description:** Automatically summarizes specific documentation files into concise, digestible chunks. Uses intelligent truncation that preserves key information.

**Why it matters:** AI shouldn't need to read 500 lines of `architecture.md` when it only needs the gist. Gets the essence without the noise.

**Use case:** Before diving deep, get a quick overview of what a doc contains. Perfect for deciding which files are worth a full `peek_file`.

**Arguments:**
- `filePath` (string, required): Absolute path to the documentation file to summarize
- `maxLength` (number, optional): Maximum summary length in characters (default: 500)

---

### 3. **`hunt_related`** 🔗 - Find Related Documentation
**Description:** Hunts for documentation related to a specific topic, pattern, or concept. Uses similarity matching to find docs that cover the same domain.

**Why it matters:** When working on "Action patterns", you'll want all related docs (architecture, standards, examples) in one go. No more scavenger hunting.

**Use case:** "Find all docs related to authentication" returns docs on login, sessions, JWT, OAuth, etc.

**Arguments:**
- `dirPath` (string, required): Absolute path to the local directory to search
- `topic` (string, required): Topic or concept to find related docs for
- `threshold` (number, optional): Similarity threshold 0-1 (default: 0.7)

---

### 4. **`smell_stale`** 🦨 - Detect Outdated Documentation
**Description:** Sniffs out documentation that has gone stale - not updated in 30+ days or out of sync with the actual code. Flags potential zombies.

**Why it matters:** Docs that haven't been touched since the Jurassic period are worse than no docs. They give false confidence.

**Use case:** Before trusting a doc, check if it's been updated recently or if the code it references still exists in its documented form.

**Arguments:**
- `dirPath` (string, required): Absolute path to the local directory to check
- `maxAgeDays` (number, optional): Maximum age in days before considered stale (default: 30)
- `compareWithCode` (boolean, optional): Also check if docs match current code (default: true)

---

### 5. **`sync_docs`** 🔄 - Create and Update Documentation
**Description:** Automatically creates or updates documentation based on code changes. Detects new methods, changed signatures, and generates doc stubs.

**Why it matters:** After changing `CreateInternshipAction`, the docs should reflect the new method signature. No more "I'll update the docs later" (spoiler: you won't).

**Use case:** Post-refactor, automatically update `docs/architecture.md` with new method signatures, parameters, and return types.

**Arguments:**
- `dirPath` (string, required): Absolute path to the local project
- `filePaths` (array of strings, optional): Specific files that changed (default: auto-detect)
- `updateMode` (string, optional): 'create', 'update', or 'both' (default: 'update')

---

### 6. **`verify_truth`** ✅ - Validate Documentation Consistency
**Description:** Checks consistency between code and documentation. Verifies that all documented methods actually exist and that parameters match reality.

**Why it matters:** Nothing's more embarrassing than documenting a `deleteUser()` method that hasn't existed since v1.2. Catch these lies before someone believes them.

**Use case:** "Do all methods in `docs/api.md` still exist in the codebase? Are the parameters documented correctly?"

**Arguments:**
- `dirPath` (string, required): Absolute path to the local project
- `docPath` (string, required): Path to the documentation file to validate
- `strictMode` (boolean, optional): Fail on warnings too (default: false)

---

### 7. **`sense_surroundings`** 🌐 - Smart Context Provider
**Description:** Automatically provides relevant documentation context based on what code you're currently working on. No need to ask - it just knows.

**Why it matters:** If you're editing files in `app/Actions/Internship/`, you probably need `architecture.md`, `standards.md`, and related docs. Gets them before you realize you need them.

**Use case:** AI agent editing a file gets instant context about relevant docs, coding standards, and architectural patterns for that module.

**Arguments:**
- `dirPath` (string, required): Absolute path to the local project
- `currentFilePath` (string, required): Path to the file currently being worked on
- `contextDepth` (string, optional): 'minimal', 'standard', or 'deep' (default: 'standard')

---

### 8. **`spot_delta`** ⚖️ - Documentation vs Implementation Diff
**Description:** Compares what's documented versus what's actually in the code. Shows the delta between documentation claims and implementation reality.

**Why it matters:** "The docs say this function returns a User object, but the code returns Promise<User>." Spots these discrepancies before they confuse someone.

**Use case:** Generate a diff report showing exactly what's documented vs what exists in code - method signatures, parameters, return types, behavior descriptions.

**Arguments:**
- `dirPath` (string, required): Absolute path to the local project
- `docPath` (string, required): Path to the documentation file
- `includeCodeSnippets` (boolean, optional): Include actual code in diff (default: true)

---

### 9. **`doc_the_tools`** 📚 - Extended Tool Help
**Description:** Provides comprehensive help for all docsgrep tools with detailed examples, common patterns, and pro tips. Because even developers need a manual sometimes.

**Why it matters:** Sure, you can read the README, but this gives you interactive, contextual help with examples tailored to your current project.

**Use case:** "How exactly do I use `catch_bugs` with custom file patterns?" Gets you a detailed guide with copy-pasteable examples.

**Arguments:**
- `toolName` (string, optional): Specific tool to get help for (default: all tools)
- `includeExamples` (boolean, optional): Include usage examples (default: true)

---

### 10. **`catch_fossils`** 🦴 - Detect Artifacts Needing Updates
**Description:** Analyzes which documentation artifacts need updates based on recent codebase changes. Uses git diff and file modification times to prioritize.

**Why it matters:** After a big refactor, you need to know which docs are now lying to people. This prioritizes your doc update backlog.

**Use case:** "I just refactored the auth system - which documentation files are now outdated and need my attention?"

**Arguments:**
- `dirPath` (string, required): Absolute path to the local project
- `sinceCommit` (string, optional): Check changes since this commit (default: last commit)
- `priorityMode` (string, optional): 'impact' or 'recency' (default: 'impact')

---

## 🔧 Optimizations Needed

### 1. **Fix `grep_docs` Path Resolution Bug** 🐛
**Problem:** During testing, searching in `/docs` always returned 0 matches even though files exist. However, searching in the root directory succeeded (148 matches).

**Root Cause:** Likely a bug in path resolution logic when traversing `docs/` directories. The glob pattern or recursive search might be failing silently.

**Impact:** Makes `grep_docs` unreliable for documentation-heavy projects where docs live in `docs/` folders.

**Fix Needed:** Debug the path resolution in `src/index.ts` where `grep_docs` handles the `dirPath` argument. Ensure it properly recurses into `docs/` subdirectories.

---

### 2. **Add Result Ranking to `grep_docs`** 📊
**Problem:** 148 matches for "Internship" is way too many. AI agents need ranked results based on relevance, not just all occurrences dumped in a list.

**Current Behavior:** Returns all matches with equal weight - file path, line number, content. No notion of "this match is more important than that one."

**Desired Behavior:**
- **Title/Heading matches** rank higher than body text matches
- **README.md** matches rank higher than deep `docs/subfolder/old.md` matches
- **Exact word boundary matches** rank higher than partial/substring matches
- **Recent file matches** could get slight boost (optional)

**Implementation Idea:** Score each match 0-100 based on:
- Location weight (title=50, heading=30, body=10)
- File importance (README=20, docs/=15, other=5)
- Match precision (exact word=20, partial=5)
- Recency bonus (optional, 0-10)

**Arguments to Add:**
- `rankResults` (boolean, optional): Enable ranking (default: true)
- `rankingMode` (string, optional): 'relevance' or 'recency' (default: 'relevance')
