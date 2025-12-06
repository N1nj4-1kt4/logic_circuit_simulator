# Auto-Save Implementation Evaluation

## Executive Summary

This document evaluates the current 1-second debounced auto-save implementation and analyzes a proposed hybrid approach: **instant save for discrete actions** and **debounced save for continuous actions**.

**Recommendation**: The hybrid approach is architecturally sound and provides a better foundation for future collaboration features (Figma/Miro-style multi-user editing).

---

## Current Implementation

### Architecture

| File | Purpose |
|------|---------|
| [src/core/CircuitOperations.js](../../src/core/CircuitOperations.js) | Auto-save setup, debounce logic, `saveBoardState()` |
| [src/core/CircuitState.js](../../src/core/CircuitState.js) | Emits `BOARD_CHANGED` and other events |
| [src/ui/TruthTablePanel.js](../../src/ui/TruthTablePanel.js) | Emits `TRUTH_TABLE_STATE_CHANGED` |
| [src/interaction/ComponentDragger.js](../../src/interaction/ComponentDragger.js) | Component movement on canvas |

### Debounce Implementation

Location: `CircuitOperations.js` (lines 889-914)

```javascript
this.autoSaveDelay = 1000; // 1 second debounce delay
this.debouncedSave = () => {
    if (this.autoSaveTimer) {
        clearTimeout(this.autoSaveTimer);
    }
    this.autoSaveTimer = setTimeout(async () => {
        await this.saveBoardState();
    }, this.autoSaveDelay);
};
```

### Events That Trigger Auto-Save

All events currently use the same 1-second debounce:

| Event | Trigger Source |
|-------|----------------|
| `BOARD_CHANGED` | Component/connection add/remove/update |
| `BOARD_LOADED` | After board is loaded |
| `TRUTH_TABLE_STATE_CHANGED` | Table position, size, column order changes |
| `THEME_CHANGED` | Theme preference changes |

### BOARD_CHANGED Emission Points

Location: `CircuitState.js`

| Line | Method | Action |
|------|--------|--------|
| 62 | `addComponent()` | Component added |
| 81 | `removeComponent()` | Component removed |
| 102 | `updateComponent()` | Component updated (position, properties) |
| 131 | `clearComponents()` | All components cleared |
| 161 | `addConnection()` | Connection added |
| 174 | `removeConnection()` | Connection removed |

---

## Proposed Hybrid Approach

### Save Behavior by Action Type

| Category | Actions | Proposed Save Behavior |
|----------|---------|------------------------|
| **Discrete structural** | Add/delete component, add/delete connection, rename | **Instant** |
| **Continuous positional** | Move component, drag/resize truth table | **Debounced (1s)** |
| **Rapid UI adjustments** | Column reorder | **Debounced (300-500ms)** |

### Pros

1. **Better data safety** - Discrete actions saved immediately, reducing crash/close data loss risk
2. **Semantic correctness** - Discrete actions are "complete" instantly; no reason to delay
3. **Reduced cognitive load** - Users don't wonder "did it save?" after important actions
4. **Efficient for continuous actions** - Dragging/resizing generates many events; debouncing makes sense
5. **Collaboration-ready** - Maps cleanly to OT/CRDT operations for future multi-user support

### Cons

1. **More frequent writes** - Each discrete action = 1 write (mitigated: localStorage writes are ~1-5ms)
2. **Implementation complexity** - Need to differentiate event types
3. **Race conditions** - Instant save during pending debounce needs careful handling

---

## Collaboration Mode Implications

For future Figma/Miro-style collaboration, the hybrid approach is **optimal**:

### Why Hybrid Works for Collaboration

```
┌─────────────────────────────────────────────────────────────┐
│                    COLLABORATION LAYER                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Discrete Operations          Continuous Operations         │
│   (Add, Delete, Connect)       (Move, Resize, Drag)         │
│          │                            │                      │
│          ▼                            ▼                      │
│   ┌─────────────┐             ┌─────────────┐               │
│   │   Instant   │             │  Debounced  │               │
│   │    Sync     │             │    Sync     │               │
│   └──────┬──────┘             └──────┬──────┘               │
│          │                           │                       │
│          ▼                           ▼                       │
│   ┌─────────────┐             ┌─────────────┐               │
│   │  OT / CRDT  │             │ Last-Write  │               │
│   │  Conflict   │             │    Wins     │               │
│   │ Resolution  │             │             │               │
│   └─────────────┘             └─────────────┘               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

| Aspect | Instant (Discrete) | Debounced (Continuous) |
|--------|-------------------|------------------------|
| **Conflict detection** | Excellent - server sees changes immediately | N/A - position is last-write-wins |
| **OT compatibility** | Excellent - each operation maps to OT op | Good - batched position updates |
| **CRDT compatibility** | Excellent - add/delete are commutative | Good - position vectors merge easily |
| **Network efficiency** | Moderate - frequent small payloads | Excellent - batched updates |

### Future Operation Format

Each instant save maps to a collaboration operation:

```javascript
{
  type: 'ADD_COMPONENT',
  payload: { id: 'comp_123', type: 'AND', position: {x: 100, y: 200} },
  timestamp: 1701705600000,
  userId: 'user_abc'
}
```

---

## Risk Assessment

### Existing Issues (Pre-Refactor)

| Risk | Severity | Description |
|------|----------|-------------|
| **Data loss on close** | CRITICAL | User closes app during 1s debounce window = lost work |
| **Concurrent saves** | HIGH | No `saveInProgress` flag; overlapping async saves possible |
| **No retry logic** | HIGH | Failed saves silently dropped |
| **Timer cleanup** | MEDIUM | `setupAutoSave()` called twice = memory leak |
| **State mutation during save** | MEDIUM | Arrays passed by reference; mutation during JSON.stringify |

### Refactoring Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Timer/instant interaction bugs | HIGH | Instant save must cancel pending debounce timer |
| Event listener leaks | MEDIUM | Proper cleanup in `clearAutoSave()` |
| Regression in save behavior | MEDIUM | Comprehensive test suite first |

---

## Test Coverage Analysis

### Current State: ZERO AUTO-SAVE TESTS

**Examined test files:**
- `tests/unit/storage/BoardManager.test.js` - 343 lines, ~40 tests (save/load/delete)
- `tests/integration/full-workflow.test.js` - 529 lines, ~35 tests (workflows)
- `tests/unit/core/CircuitState.test.js` - 417 lines, ~35 tests (state ops)

**Missing test coverage:**
- `setupAutoSave()` method
- `saveBoardState()` method
- Debounce timing behavior
- Timer management
- Concurrent save scenarios
- Error recovery
- `clearAutoSave()` cleanup

---

## Recommended Test Suite

### File Structure

```
tests/
├── unit/
│   └── core/
│       └── autoSave.test.js          # Unit tests for auto-save
└── integration/
    └── autoSave.integration.test.js  # Integration tests
```

### Unit Tests: `tests/unit/core/autoSave.test.js`

#### 1. Basic Debounce Behavior

```javascript
describe('Debounced Auto-Save', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Setup CircuitOperations with mock storage
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should not save immediately on BOARD_CHANGED', () => {
    eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
    expect(mockStorage.setItem).not.toHaveBeenCalled();
  });

  test('should save after 1 second of inactivity', () => {
    eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
    jest.advanceTimersByTime(1000);
    expect(mockStorage.setItem).toHaveBeenCalledTimes(1);
  });

  test('should reset timer on subsequent events', () => {
    eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
    jest.advanceTimersByTime(500);
    eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
    jest.advanceTimersByTime(500);
    expect(mockStorage.setItem).not.toHaveBeenCalled();
    jest.advanceTimersByTime(500);
    expect(mockStorage.setItem).toHaveBeenCalledTimes(1);
  });

  test('should batch rapid events into single save', () => {
    for (let i = 0; i < 10; i++) {
      eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
      jest.advanceTimersByTime(100);
    }
    jest.advanceTimersByTime(1000);
    expect(mockStorage.setItem).toHaveBeenCalledTimes(1);
  });
});
```

#### 2. Event Triggers

```javascript
describe('Auto-Save Event Triggers', () => {
  test('should trigger on BOARD_CHANGED', () => {
    eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
    jest.advanceTimersByTime(1000);
    expect(mockStorage.setItem).toHaveBeenCalled();
  });

  test('should trigger on BOARD_LOADED', () => {
    eventBus.emit(EVENT_TYPES.BOARD_LOADED);
    jest.advanceTimersByTime(1000);
    expect(mockStorage.setItem).toHaveBeenCalled();
  });

  test('should trigger on TRUTH_TABLE_STATE_CHANGED', () => {
    eventBus.emit(EVENT_TYPES.TRUTH_TABLE_STATE_CHANGED);
    jest.advanceTimersByTime(1000);
    expect(mockStorage.setItem).toHaveBeenCalled();
  });

  test('should NOT trigger on unrelated events', () => {
    eventBus.emit(EVENT_TYPES.COMPONENT_SELECTED);
    jest.advanceTimersByTime(1000);
    expect(mockStorage.setItem).not.toHaveBeenCalled();
  });
});
```

#### 3. Data Integrity

```javascript
describe('Save Data Integrity', () => {
  test('should save all components', async () => {
    state.addComponent({ id: 1, type: 'AND' });
    state.addComponent({ id: 2, type: 'OR' });
    jest.advanceTimersByTime(1000);

    const savedData = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
    expect(savedData.components).toHaveLength(2);
  });

  test('should save all connections', async () => {
    state.addConnection({ from: 'a', to: 'b' });
    jest.advanceTimersByTime(1000);

    const savedData = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
    expect(savedData.connections).toHaveLength(1);
  });

  test('should save truth table state', async () => {
    state.setTruthTableState({ x: 100, y: 200, visible: true });
    eventBus.emit(EVENT_TYPES.TRUTH_TABLE_STATE_CHANGED);
    jest.advanceTimersByTime(1000);

    const savedData = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
    expect(savedData.truthTableState).toEqual({ x: 100, y: 200, visible: true });
  });

  test('should capture state at save time, not event time', () => {
    state.addComponent({ id: 1, type: 'AND' });
    eventBus.emit(EVENT_TYPES.BOARD_CHANGED);

    jest.advanceTimersByTime(500);
    state.addComponent({ id: 2, type: 'OR' }); // Added after event, before save

    jest.advanceTimersByTime(500);
    const savedData = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
    expect(savedData.components).toHaveLength(2); // Should include both
  });
});
```

#### 4. Error Handling

```javascript
describe('Auto-Save Error Handling', () => {
  test('should handle storage write failure gracefully', async () => {
    mockStorage.setItem.mockRejectedValueOnce(new Error('QuotaExceeded'));

    eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
    jest.advanceTimersByTime(1000);

    // Should not throw, should log error
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Error auto-saving'),
      expect.any(Error)
    );
  });

  test('should handle JSON serialization errors', async () => {
    const circular = { a: 1 };
    circular.self = circular;
    state.addComponent(circular);

    eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
    jest.advanceTimersByTime(1000);

    expect(console.error).toHaveBeenCalled();
  });

  test('should continue accepting events after failure', async () => {
    mockStorage.setItem
      .mockRejectedValueOnce(new Error('Failure'))
      .mockResolvedValueOnce();

    eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
    jest.advanceTimersByTime(1000);

    eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
    jest.advanceTimersByTime(1000);

    expect(mockStorage.setItem).toHaveBeenCalledTimes(2);
  });
});
```

#### 5. Cleanup

```javascript
describe('Auto-Save Cleanup', () => {
  test('should clear pending timer on clearAutoSave()', () => {
    eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
    operations.clearAutoSave();
    jest.advanceTimersByTime(1000);

    expect(mockStorage.setItem).not.toHaveBeenCalled();
  });

  test('should remove event listeners on clearAutoSave()', () => {
    operations.clearAutoSave();
    eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
    jest.advanceTimersByTime(1000);

    expect(mockStorage.setItem).not.toHaveBeenCalled();
  });

  test('should handle multiple clearAutoSave() calls', () => {
    expect(() => {
      operations.clearAutoSave();
      operations.clearAutoSave();
    }).not.toThrow();
  });

  test('should not leak listeners on repeated setup', () => {
    const initialListenerCount = eventBus.listenerCount(EVENT_TYPES.BOARD_CHANGED);

    operations.setupAutoSave();
    operations.setupAutoSave();
    operations.setupAutoSave();

    expect(eventBus.listenerCount(EVENT_TYPES.BOARD_CHANGED))
      .toBe(initialListenerCount + 1); // Should only add once
  });
});
```

### Race Condition Tests

#### 6. Concurrent Operations

```javascript
describe('Race Conditions', () => {
  test('should handle save during pending save', async () => {
    // Make save take 500ms
    mockStorage.setItem.mockImplementation(() =>
      new Promise(resolve => setTimeout(resolve, 500))
    );

    eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
    jest.advanceTimersByTime(1000); // First save starts

    eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
    jest.advanceTimersByTime(200); // Second event during first save

    jest.advanceTimersByTime(1300); // Let both complete

    // Verify data consistency
    const lastSaveData = JSON.parse(
      mockStorage.setItem.mock.calls[mockStorage.setItem.mock.calls.length - 1][1]
    );
    expect(lastSaveData).toBeDefined();
  });

  test('should preserve latest state when saves overlap', async () => {
    let saveOrder = [];
    mockStorage.setItem.mockImplementation((key, value) => {
      return new Promise(resolve => {
        const data = JSON.parse(value);
        setTimeout(() => {
          saveOrder.push(data.components.length);
          resolve();
        }, 100);
      });
    });

    state.addComponent({ id: 1 });
    eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
    jest.advanceTimersByTime(1000);

    state.addComponent({ id: 2 });
    eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
    jest.advanceTimersByTime(50); // Start second save before first completes

    jest.advanceTimersByTime(1100);

    // Final state should have 2 components
    expect(saveOrder[saveOrder.length - 1]).toBe(2);
  });

  test('should not corrupt data with rapid state changes', async () => {
    for (let i = 0; i < 100; i++) {
      state.addComponent({ id: i, type: 'AND' });
      if (i % 10 === 0) {
        eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
        jest.advanceTimersByTime(100);
      }
    }

    jest.advanceTimersByTime(1000);

    const savedData = JSON.parse(
      mockStorage.setItem.mock.calls[mockStorage.setItem.mock.calls.length - 1][1]
    );
    expect(savedData.components).toHaveLength(100);
  });
});
```

#### 7. Timer Edge Cases

```javascript
describe('Timer Edge Cases', () => {
  test('should handle timer at exactly delay boundary', () => {
    eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
    jest.advanceTimersByTime(999);
    expect(mockStorage.setItem).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(mockStorage.setItem).toHaveBeenCalledTimes(1);
  });

  test('should handle system time jumps', () => {
    eventBus.emit(EVENT_TYPES.BOARD_CHANGED);

    // Simulate large time jump (e.g., laptop sleep)
    jest.advanceTimersByTime(60000);

    expect(mockStorage.setItem).toHaveBeenCalledTimes(1);
  });

  test('should handle timer cleared during save execution', async () => {
    mockStorage.setItem.mockImplementation(() =>
      new Promise(resolve => setTimeout(resolve, 100))
    );

    eventBus.emit(EVENT_TYPES.BOARD_CHANGED);
    jest.advanceTimersByTime(1000); // Save starts

    operations.clearAutoSave(); // Clear during save

    jest.advanceTimersByTime(100); // Let save complete

    // Save should still complete (already started)
    expect(mockStorage.setItem).toHaveBeenCalled();
  });
});
```

### Integration Tests: `tests/integration/autoSave.integration.test.js`

#### 8. Full Workflow Integration

```javascript
describe('Auto-Save Integration', () => {
  let operations;
  let storage;

  beforeEach(async () => {
    storage = new LocalStorageAdapter();
    await storage.clear();
    operations = new CircuitOperations(storage);
    jest.useFakeTimers();
  });

  test('should persist component additions across reload', async () => {
    operations.addComponent('AND', 100, 100);
    jest.advanceTimersByTime(1000);

    // Simulate reload
    const newOperations = new CircuitOperations(storage);
    await newOperations.restoreAutoSavedState();

    expect(newOperations.state.getComponents()).toHaveLength(1);
  });

  test('should persist connection additions across reload', async () => {
    const comp1 = operations.addComponent('INPUT', 50, 50);
    const comp2 = operations.addComponent('AND', 150, 50);
    operations.addConnection(comp1.id, 'output', comp2.id, 'input1');
    jest.advanceTimersByTime(1000);

    const newOperations = new CircuitOperations(storage);
    await newOperations.restoreAutoSavedState();

    expect(newOperations.state.getConnections()).toHaveLength(1);
  });

  test('should persist truth table state across reload', async () => {
    operations.state.setTruthTableState({
      x: 200,
      y: 300,
      width: 400,
      height: 500,
      visible: true,
      columnOrder: ['A', 'B', 'OUT']
    });
    eventBus.emit(EVENT_TYPES.TRUTH_TABLE_STATE_CHANGED);
    jest.advanceTimersByTime(1000);

    const newOperations = new CircuitOperations(storage);
    await newOperations.restoreAutoSavedState();

    const restored = newOperations.state.getTruthTableState();
    expect(restored.x).toBe(200);
    expect(restored.columnOrder).toEqual(['A', 'B', 'OUT']);
  });

  test('should handle complex workflow with multiple operations', async () => {
    // Add components
    const input1 = operations.addComponent('INPUT', 50, 50);
    const input2 = operations.addComponent('INPUT', 50, 100);
    const andGate = operations.addComponent('AND', 150, 75);
    const output = operations.addComponent('OUTPUT', 250, 75);

    // Add connections
    operations.addConnection(input1.id, 'output', andGate.id, 'input1');
    operations.addConnection(input2.id, 'output', andGate.id, 'input2');
    operations.addConnection(andGate.id, 'output', output.id, 'input');

    // Move a component
    operations.moveComponent(andGate.id, 200, 100);

    jest.advanceTimersByTime(1000);

    // Verify save
    const saved = await storage.getItem('currentBoard');
    const data = JSON.parse(saved);

    expect(data.components).toHaveLength(4);
    expect(data.connections).toHaveLength(3);
    expect(data.components.find(c => c.id === andGate.id).x).toBe(200);
  });
});
```

#### 9. User Action Sequences

```javascript
describe('User Action Sequences', () => {
  test('should save after add component action', async () => {
    operations.addComponent('AND', 100, 100);

    expect(mockStorage.setItem).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    expect(mockStorage.setItem).toHaveBeenCalledTimes(1);
  });

  test('should save after delete component action', async () => {
    const comp = operations.addComponent('AND', 100, 100);
    jest.advanceTimersByTime(1000);
    mockStorage.setItem.mockClear();

    operations.deleteComponent(comp.id);
    jest.advanceTimersByTime(1000);

    const saved = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
    expect(saved.components).toHaveLength(0);
  });

  test('should batch multiple moves into single save', async () => {
    const comp = operations.addComponent('AND', 100, 100);
    jest.advanceTimersByTime(1000);
    mockStorage.setItem.mockClear();

    // Simulate dragging
    for (let i = 0; i < 50; i++) {
      operations.moveComponent(comp.id, 100 + i, 100 + i);
    }

    jest.advanceTimersByTime(1000);
    expect(mockStorage.setItem).toHaveBeenCalledTimes(1);

    const saved = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
    expect(saved.components[0].x).toBe(149);
  });
});
```

### Hybrid Mode Tests (For Future Implementation)

#### 10. Instant vs Debounced Behavior

```javascript
describe('Hybrid Save Mode (Future)', () => {
  test('should save instantly on addComponent', () => {
    operations.addComponent('AND', 100, 100);
    expect(mockStorage.setItem).toHaveBeenCalledTimes(1); // Instant
  });

  test('should save instantly on deleteComponent', () => {
    const comp = operations.addComponent('AND', 100, 100);
    mockStorage.setItem.mockClear();

    operations.deleteComponent(comp.id);
    expect(mockStorage.setItem).toHaveBeenCalledTimes(1); // Instant
  });

  test('should save instantly on addConnection', () => {
    const comp1 = operations.addComponent('INPUT', 50, 50);
    const comp2 = operations.addComponent('AND', 150, 50);
    mockStorage.setItem.mockClear();

    operations.addConnection(comp1.id, 'output', comp2.id, 'input1');
    expect(mockStorage.setItem).toHaveBeenCalledTimes(1); // Instant
  });

  test('should debounce moveComponent', () => {
    const comp = operations.addComponent('AND', 100, 100);
    mockStorage.setItem.mockClear();

    operations.moveComponent(comp.id, 150, 150);
    expect(mockStorage.setItem).not.toHaveBeenCalled(); // Debounced

    jest.advanceTimersByTime(1000);
    expect(mockStorage.setItem).toHaveBeenCalledTimes(1);
  });

  test('should debounce truth table drag', () => {
    operations.state.setTruthTableState({ x: 100, y: 100 });
    eventBus.emit(EVENT_TYPES.TRUTH_TABLE_STATE_CHANGED);

    expect(mockStorage.setItem).not.toHaveBeenCalled(); // Debounced

    jest.advanceTimersByTime(1000);
    expect(mockStorage.setItem).toHaveBeenCalledTimes(1);
  });

  test('instant save should cancel pending debounce', () => {
    const comp = operations.addComponent('AND', 100, 100);
    mockStorage.setItem.mockClear();

    operations.moveComponent(comp.id, 150, 150); // Starts debounce timer
    jest.advanceTimersByTime(500);

    operations.addComponent('OR', 200, 200); // Instant save

    expect(mockStorage.setItem).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1000);
    expect(mockStorage.setItem).toHaveBeenCalledTimes(1); // Debounce was cancelled
  });
});
```

---

## Implementation Recommendations

### If Refactoring to Hybrid Approach

1. **Create save strategy abstraction**
   ```javascript
   class SaveStrategy {
     configure(options) {}
     onStateChanged(eventType, state) {}
     cancelPending() {}
     forceSave() {}
   }
   ```

2. **Add save state tracking**
   ```javascript
   this.saveState = {
     isInProgress: false,
     lastSaveTime: null,
     hasPendingChanges: false,
     failureCount: 0
   };
   ```

3. **Use event type to determine save mode**
   ```javascript
   const INSTANT_SAVE_EVENTS = [
     'COMPONENT_ADDED',
     'COMPONENT_REMOVED',
     'CONNECTION_ADDED',
     'CONNECTION_REMOVED'
   ];

   const DEBOUNCED_SAVE_EVENTS = [
     'COMPONENT_MOVED',
     'TRUTH_TABLE_STATE_CHANGED'
   ];
   ```

4. **Handle instant/debounce interaction**
   ```javascript
   instantSave() {
     this.cancelPendingDebounce();
     await this.saveBoardState();
   }
   ```

### Estimated Effort

| Phase | Task | Time |
|-------|------|------|
| 1 | Write comprehensive test suite | 4-6 hrs |
| 2 | Create save strategy abstraction | 3-4 hrs |
| 3 | Implement instant + debounced modes | 3-4 hrs |
| 4 | Fix existing race conditions | 2-3 hrs |
| 5 | Integration testing | 2-3 hrs |
| **Total** | | **~2-3 days** |

---

## Appendix: Test Coverage Checklist

### Unit Tests

- [ ] Basic debounce timing
- [ ] Timer reset on subsequent events
- [ ] Event batching
- [ ] All trigger events (BOARD_CHANGED, BOARD_LOADED, TRUTH_TABLE_STATE_CHANGED, THEME_CHANGED)
- [ ] Non-trigger events ignored
- [ ] Data integrity (components, connections, truth table state)
- [ ] State capture timing
- [ ] Storage write failure handling
- [ ] JSON serialization error handling
- [ ] Recovery after failure
- [ ] Timer cleanup on clearAutoSave()
- [ ] Event listener cleanup
- [ ] Multiple clearAutoSave() calls
- [ ] Listener leak prevention

### Race Condition Tests

- [ ] Save during pending save
- [ ] State preservation with overlapping saves
- [ ] Rapid state changes
- [ ] Timer boundary conditions
- [ ] System time jumps
- [ ] Timer cleared during save execution

### Integration Tests

- [ ] Component persistence across reload
- [ ] Connection persistence across reload
- [ ] Truth table state persistence
- [ ] Complex multi-operation workflows
- [ ] Add component action flow
- [ ] Delete component action flow
- [ ] Move batching behavior

### Hybrid Mode Tests (Future)

- [ ] Instant save on addComponent
- [ ] Instant save on deleteComponent
- [ ] Instant save on addConnection
- [ ] Debounced moveComponent
- [ ] Debounced truth table drag
- [ ] Instant cancels pending debounce
