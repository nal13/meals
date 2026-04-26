# Meal Planner — Agent Guidelines

## Architecture

Vanilla JS PWA with no build step. Three layers:
- **`utils.js`** — pure functions (`autoAssignIcon`, `esc`, `uid`, `DEFAULT_ICONS`). No DOM, no Firebase. Testable in Node.
- **`script.js`** — all UI logic + Firebase Firestore listeners. Global state vars: `recipes`, `week`, `extras`, `sopa`, `ingredients`, `shoppingExtra`, `shoppingDone`, `generatedFromWeek`, `weekHistory`.
- **Firebase Firestore** — single source of truth. All writes go via `save*()` helpers; reads via `onSnapshot` listeners that call `render*()`.

See [PRD.md](PRD.md) for full data model and module descriptions.

## Build & Test

```bash
npm test          # Jest — runs tests/utils.test.js (32 tests)
```

No build step. Open `index.html` directly in a browser, or:

```bash
py -m http.server 8080   # Python
```

## Conventions

- **Pure functions belong in `utils.js`**, not `script.js`. If a function needs no DOM and no Firebase, put it there and export via `module.exports`.
- **Tests only cover `utils.js`**. DOM-dependent code in `script.js` is not unit-tested; test it manually in the browser.
- **No framework, no transpiler.** Use ES5-compatible syntax (`var`, `function`, no arrow functions in production code) so the file loads directly without a build step.
- **Firebase writes are fire-and-forget.** All `save*()` calls use `.catch(console.error)` — no await, no loading states.
- **Ingredient names are the join key.** Matching across recipes, the dictionary, and the shopping list is done by `name.toLowerCase().trim()`. Never use IDs to link ingredients across collections.
- **`uid()`** generates all IDs client-side (`Date.now().toString(36) + random`).
- **`esc()`** must wrap all user-supplied strings inserted into innerHTML.

## Key files

| File | Role |
|------|------|
| `utils.js` | Pure helpers — edit here when changing icon rules or adding utilities |
| `script.js` | All app logic — single large file, sections delimited by `// ----` comments |
| `tests/utils.test.js` | Jest tests — add a test whenever a rule in `utils.js` changes |
| `sw.js` | Service Worker — bump `CACHE` version (`mp-vN`) whenever a new static file is added |
| `PRD.md` | Product requirements and architecture decisions |
| `ROADMAP.md` | Tiered backlog |

## When making changes

1. **Adding a new static file** → add it to `FILES` in `sw.js` and bump the cache version.
2. **Changing icon rules** → update `ICON_RULES` in `utils.js` and add/update the corresponding test in `tests/utils.test.js`.
3. **New ingredient-level feature** → the ingredient dictionary lives in `data/ingredients` in Firestore; the local mirror is the `ingredients` global object.
4. **Run `npm test` before committing** — never commit with failing tests.
