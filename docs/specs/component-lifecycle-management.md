# Component Lifecycle Management Specification

**Version**: 1.0
**Date**: 2025-12-04
**Status**: Draft - Pending Review

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Design Goals](#design-goals)
3. [Design Decisions](#design-decisions)
4. [Data Structures](#data-structures)
5. [Functional Specifications](#functional-specifications)
6. [Migration Strategy](#migration-strategy)
7. [User Experience](#user-experience)
8. [Implementation Phases](#implementation-phases)
9. [Testing Requirements](#testing-requirements)
10. [Future Considerations](#future-considerations)

---

## Problem Statement

### Current Behavior

When a user saves a custom component and uses it in a board, the system **embeds the full component definition** into each instance. This creates several issues:

1. **Deletion inconsistency**: Deleting a component from the library leaves orphaned instances on boards that continue to function with stale definitions.

2. **Edit divergence**: Editing a component doesn't update existing instances. The same component name can have different behaviors across different boards.

3. **No change detection**: Users have no way to know if a component has been modified since it was placed on a board.

4. **Data redundancy**: Each board saves the entire component library, leading to data duplication and potential resurrection of deleted components.

### Example Scenario

1. User creates "HalfAdder" component and saves it
2. User places "HalfAdder" on Board A and saves
3. User discovers a bug in "HalfAdder" and fixes it
4. User places fixed "HalfAdder" on Board B
5. **Problem**: Board A still uses buggy version, Board B uses fixed version
6. User has no visibility into this divergence

---

## Design Goals

1. **Single source of truth**: Component definitions live only in the library, not embedded in instances
2. **Referential integrity**: Prevent deletion of components that are in use
3. **Interface stability**: Allow internal edits but prevent breaking changes to ports
4. **Change visibility**: Users know when a component has changed since board was saved
5. **Clean failure**: When incompatibility detected, fail clearly rather than silently misbehave
6. **Future-ready**: Data structures support future features (edit history, collaboration, rollback)

---

## Design Decisions

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **Storage model** | Reference by name + version hash | Eliminates duplication, enables change detection |
| **Deletion** | Prevent if component is used anywhere | Avoids orphan handling complexity |
| **Editing** | Allow only interface-compatible changes | Prevents breaking existing circuits |
| **Incompatible boards** | Remove outdated instances on load + warn | Clean break over silent divergence |
| **Version tracking** | Version record with number, hash, timestamp | Supports future edit history |
| **Usage tracking** | `usedIn` lists with board/component IDs | O(1) deletion check, shows where used |
| **Board identification** | Unique session ID per board | Distinguishes multiple unsaved boards |
| **Hash algorithm** | Fast synchronous hash (cyrb53 or similar) | Performance over cryptographic strength |

---

## Data Structures

### Component Definition (Library)

```javascript
{
  // Existing fields
  name: "HalfAdder",
  description: "A half adder circuit",
  components: [
    { id: 1, type: "INPUT", label: "A", ... },
    { id: 2, type: "INPUT", label: "B", ... },
    { id: 3, type: "XOR", ... },
    { id: 4, type: "AND", ... },
    { id: 5, type: "OUTPUT", label: "Sum", ... },
    { id: 6, type: "OUTPUT", label: "Carry", ... }
  ],
  connections: [
    { from: { componentId: 1, port: 0 }, to: { componentId: 3, port: 0 } },
    // ... more connections
  ],
  inputPorts: [
    { label: "A", id: 1 },
    { label: "B", id: 2 }
  ],
  outputPorts: [
    { label: "Sum", id: 5 },
    { label: "Carry", id: 6 }
  ],
  truthTableState: { ... },

  // NEW: Version tracking
  version: {
    number: 1,                              // Incrementing integer
    hash: "a1b2c3d4e5f6",                   // Hash of component content
    editedAt: "2025-12-04T10:30:00.000Z",   // ISO 8601 timestamp
    editedBy: null                          // Reserved for future multi-user
  },

  // NEW: Usage tracking
  usedIn: {
    boards: [
      { id: "session-1701234567890-abc", name: "My Circuit" },
      { id: "session-1701234599999-xyz", name: "Untitled" }
    ],
    components: [
      { name: "FullAdder" }   // Components that use this internally
    ]
  },

  // NEW: Warning suppression (per-component global)
  suppressEditWarning: false
}
```

### Component Instance (On Board)

```javascript
{
  // Existing fields
  id: 5,
  type: "CUSTOM",
  x: 100,
  y: 200,
  inputs: [
    { componentId: 5, port: 0, value: false },
    { componentId: 5, port: 1, value: false }
  ],
  outputs: [
    { componentId: 5, port: 0 },
    { componentId: 5, port: 1 }
  ],
  label: "HalfAdder",
  customName: "HalfAdder",

  // NEW: Version reference (REPLACES customDefinition)
  placedWithVersion: {
    number: 1,
    hash: "a1b2c3d4e5f6"
  }

  // REMOVED: customDefinition (no longer embedded)
}
```

### Board Data (Saved)

```javascript
{
  // Board identification
  id: "session-1701234567890-abc",    // NEW: Unique board identifier
  name: "My Circuit",                  // User-visible name (or "Untitled")

  // Circuit data
  components: [ ... ],                 // Instances with placedWithVersion
  connections: [ ... ],
  nextId: 15,
  truthTableState: { ... },

  // REMOVED: customComponents (no longer saved with board)
}
```

### Warning Suppression State (Global)

```javascript
// Stored separately in localStorage
{
  "componentWarningsSuppressed": {
    "HalfAdder": {
      suppressedAtVersion: 3,           // Version when user clicked "don't show"
      suppressedAt: "2025-12-04T..."
    }
  }
}
```

---

## Functional Specifications

### 5.1 Component Placement

**Trigger**: User selects a custom component from toolbar and places on board

**Process**:
1. Get component definition from library by name
2. Create instance with `placedWithVersion` containing current version number and hash
3. Add board to component's `usedIn.boards` list (if not already present)
4. Render component on canvas

**Code location**: `src/core/CircuitOperations.js` - `addComponent()`

### 5.2 Component Removal from Board

**Trigger**: User deletes a custom component instance from board

**Process**:
1. Remove instance from board's component list
2. Remove associated connections
3. Check if any other instances of same component remain on board
4. If no instances remain, remove board from component's `usedIn.boards` list

**Code location**: `src/core/CircuitOperations.js` - `removeComponent()`

### 5.3 Component Editing

**Trigger**: User opens component for editing and saves changes

**Process**:
1. User loads component for editing (opens internal structure)
2. User makes changes to internal components/connections
3. User clicks "Save Component"
4. **Validation**: Compare interface with library version
   - Count input ports (INPUT components)
   - Count output ports (OUTPUT components)
   - Compare port labels
5. If interface changed → **Reject save** with error message
6. If interface unchanged → Proceed with save:
   - Increment `version.number`
   - Recompute `version.hash`
   - Update `version.editedAt` to current timestamp
   - Reset `suppressEditWarning` to `false`
   - Save to library

**Error message for rejected save**:
```
Cannot save changes to "HalfAdder".

The component interface has changed:
- Input port count: 2 → 3
- Output port "Carry" renamed to "CarryOut"

Existing circuits using this component would break.
To make interface changes, create a new component instead.
```

**Code location**: `src/core/CircuitOperations.js` - `saveComponent()`

### 5.4 Component Deletion

**Trigger**: User clicks delete in Manage Components dialog

**Process**:
1. Check `usedIn.boards` and `usedIn.components`
2. If either is non-empty → **Block deletion**
3. If both empty → Proceed with deletion

**Blocked deletion message**:
```
Cannot delete "HalfAdder".

This component is currently used in:
• Boards: My Circuit, ALU Design
• Components: FullAdder

Remove all usages before deleting.
```

**Code location**:
- `src/storage/ComponentLibrary.js` - `canDelete()`, `deleteComponent()`
- `src/ui/DialogManager.js` - delete confirmation flow

### 5.5 Board Loading

**Trigger**: User loads a saved board

**Process**:
1. Load board data from storage
2. For each custom component instance:
   a. Get `customName` and `placedWithVersion`
   b. Look up current definition in library
   c. If component not in library → Mark for removal (shouldn't happen with deletion prevention, but defensive)
   d. Compare `placedWithVersion.hash` with `library.version.hash`
   e. If hashes differ → Mark for removal
3. Collect all instances marked for removal
4. Check warning suppression:
   - For each component, check if `suppressEditWarning` is true AND `suppressedAtVersion` matches current version
   - If all marked components have warnings suppressed → Skip dialog
5. If dialog needed, show warning (see 5.6)
6. Remove marked instances from board
7. Remove orphaned connections (connections to/from removed instances)
8. Update `usedIn` for removed components
9. Render remaining circuit

**Code location**: `src/core/CircuitOperations.js` - `loadBoard()`

### 5.6 Load Warning Dialog

**Trigger**: Board contains instances with version mismatch

**Dialog content**:
```
Some components have been modified

The following components have been updated since this board
was saved. Their instances have been removed:

  • HalfAdder (2 instances removed)
  • FullAdder (1 instance removed)

You can re-add these components from the library.

[ ] Don't show this warning for these components

                                    [OK]
```

**Checkbox behavior**:
- When checked and OK clicked:
  - For each listed component, set `suppressEditWarning = true`
  - Store `suppressedAtVersion = current version number`
- Warning suppression resets when component is edited again (new version)

**Code location**: `src/ui/DialogManager.js` - new method `showComponentMismatchWarning()`

### 5.7 Circuit Simulation

**Trigger**: User runs simulation or evaluates circuit

**Process**:
1. For each custom component instance:
   a. Get `customName` from instance
   b. Look up definition from library (NOT from embedded definition)
   c. Evaluate internal circuit using definition's components and connections
   d. Return output values

**Change from current**: Currently uses `component.customDefinition`.
Must change to `componentLibrary.getComponent(component.customName)`.

**Code location**: `src/core/circuitEvaluator.js` - `evaluateCustomComponent()`

### 5.8 Board Saving

**Trigger**: User saves board (or auto-save triggers)

**Process**:
1. Collect all components (instances reference library, not embed)
2. Collect all connections
3. Ensure all custom components have board in their `usedIn.boards`
4. Save board data (WITHOUT `customComponents` field)

**Code location**:
- `src/core/CircuitOperations.js` - `saveBoard()`
- `src/storage/BoardManager.js` - `saveBoard()`

### 5.9 Board Clear

**Trigger**: User clears the current board

**Process**:
1. Get list of custom components used in current board
2. For each component, remove this board from `usedIn.boards`
3. Clear all components and connections from board
4. (Board session ID may be retained or regenerated based on implementation)

**Note**: There is no "delete board" feature currently. If added in future, it should follow similar logic to update `usedIn`.

**Code location**: `src/core/CircuitOperations.js` - `clearBoard()` or equivalent

### 5.10 Nested Component Handling

**Scenario**: ComponentA uses ComponentB internally. ComponentB is edited.

**Process**:
1. When loading ComponentA for editing or using on board:
   a. Recursively check all internal custom components
   b. For each internal custom component, compare version hashes
   c. If any mismatch found → Propagate warning to user

**Warning message**:
```
Component dependency updated

"FullAdder" contains "HalfAdder" which has been modified.
The instance of "FullAdder" has been removed.

You may need to update "FullAdder" to use the new version
of "HalfAdder", then re-add it to your board.
```

---

## Migration Strategy

### 6.1 Detecting Legacy Data

**Component Library**:
- Legacy: No `version` field, no `usedIn` field
- New: Has both fields

**Board Data**:
- Legacy: Has `customComponents` field, instances have `customDefinition`
- New: No `customComponents`, instances have `placedWithVersion`

### 6.2 Library Migration (One-time, on app load)

```javascript
function migrateLibrary(components) {
  for (const [name, def] of Object.entries(components)) {
    // Add version if missing
    if (!def.version) {
      def.version = {
        number: 1,
        hash: computeHash(def),
        editedAt: new Date().toISOString(),
        editedBy: null
      };
    }

    // Add usedIn if missing
    if (!def.usedIn) {
      def.usedIn = {
        boards: [],
        components: []
      };
    }

    // Add suppressEditWarning if missing
    if (def.suppressEditWarning === undefined) {
      def.suppressEditWarning = false;
    }
  }
  return components;
}
```

### 6.3 Board Migration (On load of each board)

```javascript
function migrateBoard(boardData, library) {
  // Add board ID if missing
  if (!boardData.id) {
    boardData.id = generateBoardId();
  }

  const removedInstances = [];

  for (const component of boardData.components) {
    if (component.type === 'CUSTOM' && component.customDefinition) {
      // Legacy instance with embedded definition
      const libraryDef = library[component.customName];

      if (!libraryDef) {
        // Component no longer in library
        removedInstances.push(component);
        continue;
      }

      // Compare embedded hash with library hash
      const embeddedHash = computeHash(component.customDefinition);

      if (embeddedHash === libraryDef.version.hash) {
        // Definition unchanged - safe to convert
        component.placedWithVersion = {
          number: libraryDef.version.number,
          hash: libraryDef.version.hash
        };
        delete component.customDefinition;
      } else {
        // Definition changed - remove instance
        removedInstances.push(component);
      }
    }
  }

  // Remove legacy customComponents field
  delete boardData.customComponents;

  return { boardData, removedInstances };
}
```

### 6.4 Usage Tracking Population (One-time)

After library migration, scan all saved boards to populate `usedIn`:

```javascript
async function populateUsageTracking(library, boardManager) {
  const boards = await boardManager.getAllBoards();

  for (const board of boards) {
    const customInstances = board.components.filter(c => c.type === 'CUSTOM');

    for (const instance of customInstances) {
      const componentDef = library[instance.customName];
      if (componentDef) {
        addUsage(componentDef, board.id, board.name, 'board');
      }
    }
  }

  // Also scan components for nested usage
  for (const [name, def] of Object.entries(library)) {
    const nestedCustom = def.components.filter(c => c.type === 'CUSTOM');
    for (const nested of nestedCustom) {
      const nestedDef = library[nested.customName];
      if (nestedDef) {
        addUsage(nestedDef, name, name, 'component');
      }
    }
  }
}
```

---

## User Experience

### 7.1 Deletion Attempt on Used Component

**Before** (current): Component deleted, orphans remain on board

**After**:
1. User clicks delete on "HalfAdder"
2. Dialog appears: "Cannot delete - used in 2 boards and 1 component"
3. User must remove usages first, then delete

### 7.2 Editing Component with Interface Change

**Before** (current): Any edit allowed, instances diverge silently

**After**:
1. User edits "HalfAdder", adds third input port
2. User clicks "Save Component"
3. Error: "Cannot save - interface changed. Create new component instead."
4. User can: (a) undo interface change, or (b) save as "HalfAdder_v2"

### 7.3 Loading Outdated Board

**Before** (current): Old embedded definition used, different behavior than library

**After**:
1. User loads "Old Board"
2. Warning dialog: "HalfAdder was modified. 2 instances removed."
3. Board loads with gaps where instances were
4. User can re-add from library to get new version

### 7.4 Workflow for Updating Existing Boards

When user wants all boards to use new component version:
1. Edit component, save (interface-compatible changes only)
2. Open each board → instances auto-removed with warning
3. Re-add instances from library
4. Save board

---

## Implementation Phases

### Phase 1: Infrastructure (Foundation)
- Create `src/utils/hashUtils.js` with fast hash function
- Add version management functions to ComponentLibrary
- Add `usedIn` structure and management functions
- Run library migration on load

### Phase 2: Usage Tracking
- Hook component placement to add usage
- Hook component removal to remove usage
- Hook board save/delete to update usage
- Implement legacy usage population scan

### Phase 3: Deletion Prevention
- Add `canDelete()` check
- Update delete UI to show blocker message
- Prevent delete button when component in use

### Phase 4: Edit Validation
- Implement interface comparison function
- Add validation to save component flow
- Update version on successful edit
- Reset warning suppression on edit

### Phase 5: Reference-Based Instances
- Remove `customDefinition` from placement
- Add `placedWithVersion` to instances
- Update evaluator to use library lookup
- Remove `customComponents` from board save

### Phase 6: Load-Time Validation
- Add version hash comparison on board load
- Implement instance removal for mismatches
- Implement connection cleanup
- Create warning dialog

### Phase 7: Migration & Testing
- Implement board migration on load
- Test all scenarios
- Handle edge cases

---

## Testing Requirements

### Unit Tests

1. **Hash computation**: Same definition → same hash; different definition → different hash
2. **Interface comparison**: Detect port count changes, label changes
3. **Usage tracking**: Add/remove usage correctly updates `usedIn`
4. **Version increment**: Number increments, hash updates, timestamp updates

### Integration Tests

1. **Deletion prevention**:
   - Create component → use in board → delete blocked
   - Remove from board → delete allowed

2. **Edit validation**:
   - Edit internals only → save succeeds
   - Add input port → save rejected
   - Rename output port → save rejected

3. **Load outdated board**:
   - Save board → edit component → load board → instances removed, warning shown

4. **Warning suppression**:
   - Suppress warning → reload → no warning
   - Edit component → reload → warning shows again

5. **Nested components**:
   - ComponentA uses ComponentB → edit ComponentB → load board with ComponentA → warning propagates

### Edge Cases

1. Multiple instances of same component on one board
2. Same component used in multiple boards
3. Deeply nested components (A uses B uses C)
4. Circular dependencies (if possible to create)
5. Empty board load
6. Component with no usages

---

## Future Considerations

### Edit History
The `version` structure supports adding a `history` array:
```javascript
history: [
  { number: 1, hash: "...", editedAt: "...", snapshot: {...} },
  { number: 2, hash: "...", editedAt: "...", snapshot: {...} }
]
```

### Rollback
With history snapshots, users could revert to previous versions.

### Collaboration
The `editedBy` field reserves space for user identification in multi-user scenarios.

### Component Forking
When interface changes are needed:
```javascript
forkedFrom: {
  name: "HalfAdder",
  version: 2
}
```

### Conflict Detection
In sync scenarios, hash comparison enables conflict detection across clients.

---

## Clarifications

1. **Board identification for `usedIn`**: Use the auto-save identifier (session ID generated on board creation). This uniquely identifies each board regardless of saved name.

2. **Hash algorithm**: Simple fast hash function (cyrb53) - decided for performance over cryptographic strength.

3. **Board deletion**: There is no "delete board" feature currently, only "clear board". This simplifies `usedIn` management:
   - On **clear board**: Remove all usages for that board's session ID from all components' `usedIn.boards`
   - No need to handle board deletion from storage
   - Future: If board deletion is added, hook into that flow to update `usedIn`

---

## Appendix: Hash Function

Using cyrb53 - fast, good distribution, synchronous

```javascript
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

function computeDefinitionHash(componentDef) {
  // Normalize: only include content fields, sorted keys
  const normalized = {
    components: componentDef.components,
    connections: componentDef.connections,
    inputPorts: componentDef.inputPorts,
    outputPorts: componentDef.outputPorts
  };
  const str = JSON.stringify(normalized, Object.keys(normalized).sort());
  return cyrb53(str).toString(16);
}
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-04 | Claude + Ankit | Initial draft |
