# Day Column Collapse Flow

## Toggle (on header click)

```
User clicks day header
        │
        ▼
 Has done tasks?
 OR active tasks > 3?
        │
      NO│                     YES
        │                      │
    (no-op)              toggle short ↔ full
```

## Short-state rendering

```
Render column in SHORT state
        │
        ▼
 Has any active tasks?
   │              │
  NO             YES
   │              │
Show first 2     Hide ALL done tasks
done tasks       Show first 3 active tasks
   │              │
   │              │
Dot the rest     Dot overflow active (normal)
(faded)          + all done (faded)
```

## Dot color coding

Each dot uses the task type's border color.
Done tasks / overflow-done dots are rendered at reduced opacity.
Active overflow dots are rendered at full opacity.
