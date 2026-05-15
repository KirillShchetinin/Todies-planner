// option-c-week-strip.jsx
// C: Week Strip + Today Hero — compact day-strip up top, one or more days
// expanded below as full-width paper cards. Tap a strip chip (or a collapsed
// row, or the chevron on an open card) to toggle that day's expansion.
// Multiple days can be expanded at once; the day list scrolls.
//
// Props on OptionC:
//   expandedIds     — Set<string> | string[] | string (single) of expanded day ids
//   expandedId      — legacy single-string fallback if expandedIds not provided
//   header          — 'strip' (default) | 'wide'
//   filter          — 'all' (default) | 'important'
//   overlay         — optional element rendered on top
//   tasks           — optional override of the global TASKS map
//   onTapDay        — (dayId) => void   (toggle expand)
//   onLongPressTask — (task, dayId) => void
//   onTapQuickAdd   — () => void
//   onTapMenu       — () => void
//   onTapUnsched    — () => void

function normalizeExpanded(expandedIds, expandedId) {
  if (expandedIds instanceof Set) return expandedIds;
  if (Array.isArray(expandedIds))  return new Set(expandedIds);
  if (typeof expandedIds === 'string') return new Set([expandedIds]);
  if (typeof expandedId  === 'string') return new Set([expandedId]);
  return new Set(['thu']);
}

function OptionC({
  expandedIds, expandedId,
  header = 'strip', filter = 'all',
  overlay = null, tasks: tasksOverride,
  onTapDay, onLongPressTask, onTapQuickAdd, onTapMenu, onTapUnsched,
}) {
  const T = tasksOverride || TASKS;
  const expanded = normalizeExpanded(expandedIds, expandedId);

  return (
    <WoodBg style={{display:'flex', flexDirection:'column'}}>
      {header === 'strip'
        ? <StripHeader onTapMenu={onTapMenu} expanded={expanded} onTapDay={onTapDay} filter={filter} T={T}/>
        : <WideHeader  onTapMenu={onTapMenu} filter={filter}/>}

      {header === 'wide' && <WeekProgress T={T}/>}

      {/* Unscheduled chip — tap to open the drawer */}
      <div style={{padding:'4px 12px 0'}}>
        <SkyBg
          onClick={onTapUnsched}
          style={{padding:'6px 10px', display:'flex', alignItems:'center', gap:8, cursor:'pointer'}}
        >
          <span style={{fontFamily:THEME.mono, fontSize:10, color:'#3a6a8a', textTransform:'uppercase', letterSpacing:'0.07em'}}>
            unscheduled · {T.unscheduled.length}
          </span>
          <DotRow tasks={T.unscheduled} max={20} size={5}/>
          <span style={{flex:1}}/>
          <span style={{fontFamily:THEME.mono, fontSize:13, color:'#3a6a8a'}}>›</span>
        </SkyBg>
      </div>

      {/* Day list — expanded days become heroes, others stay as rows */}
      <div style={{
        flex:1, minHeight:0, overflowY:'auto',
        padding:'10px 12px 80px',
        display:'flex', flexDirection:'column', gap:6,
      }}>
        {DAYS.map(d => expanded.has(d.id)
          ? <DayHero key={d.id} day={d} tasks={T[d.id] || []} filter={filter}
              onLongPressTask={onLongPressTask}
              onTapCollapse={() => onTapDay && onTapDay(d.id)}/>
          : <DayRow  key={d.id} day={d} tasks={T[d.id] || []} filter={filter}
              onTap={() => onTapDay && onTapDay(d.id)}/>
        )}
      </div>

      {/* Quick add — always docked, always targets today */}
      <div style={{
        position:'absolute', left:0, right:0, bottom:0,
        padding:'10px 14px 16px',
        background:'linear-gradient(to top, rgba(216,194,152,1) 40%, rgba(216,194,152,0))',
        pointerEvents: overlay ? 'none' : 'auto',
      }}>
        <button onClick={onTapQuickAdd} style={{
          width:'100%', fontFamily:THEME.mono, fontSize:13, color:THEME.text,
          background:THEME.surface, border:`1px solid ${THEME.borderHover}`, borderRadius:12,
          padding:'13px 14px', textAlign:'left',
          boxShadow:'0 4px 14px rgba(0,0,0,0.14)',
          display:'flex', alignItems:'center', gap:8, cursor:'pointer',
        }}>
          <span style={{fontFamily:THEME.mono, fontSize:18, color:THEME.textMuted}}>+</span>
          <span>quick add…</span>
          <span style={{flex:1}}/>
          <span style={{
            fontFamily:THEME.mono, fontSize:10, color:THEME.textDim,
            textTransform:'uppercase', letterSpacing:'0.07em',
          }}>today</span>
        </button>
      </div>

      {overlay}
    </WoodBg>
  );
}

// ─────────────────────────────────────────────────────────────
// Headers
// ─────────────────────────────────────────────────────────────
function WideHeader({ onTapMenu, filter }) {
  return (
    <div style={{
      padding:'10px 14px 8px',
      display:'flex', alignItems:'center', justifyContent:'space-between',
    }}>
      <div>
        <div style={{fontFamily:THEME.mono, fontSize:11, color:THEME.textMuted, textTransform:'uppercase', letterSpacing:'0.08em'}}>this week</div>
        <div style={{fontFamily:THEME.sans, fontSize:18, fontWeight:500, color:THEME.text, marginTop:2}}>May 11 – 17</div>
      </div>
      <div style={{display:'flex', gap:6, alignItems:'center'}}>
        {filter === 'important' && <FilterBadge>!  only</FilterBadge>}
        <MiniIcon2>◆</MiniIcon2>
        <MiniIcon2 onClick={onTapMenu}>≡</MiniIcon2>
      </div>
    </div>
  );
}

function StripHeader({ onTapMenu, expanded, onTapDay, filter, T = TASKS }) {
  return (
    <div style={{padding:'10px 12px 4px'}}>
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        marginBottom:8,
      }}>
        <span style={{fontFamily:THEME.mono, fontSize:13, fontWeight:500, color:THEME.accent}}>weekly planner</span>
        <div style={{display:'flex', gap:6, alignItems:'center'}}>
          {filter === 'important' && <FilterBadge>!  only</FilterBadge>}
          <MiniIcon2>◆</MiniIcon2>
          <MiniIcon2 onClick={onTapMenu}>≡</MiniIcon2>
        </div>
      </div>

      {/* Compact day strip — tap to toggle expansion */}
      <div style={{display:'flex', gap:4}}>
        {DAYS.map(d => {
          const t = T[d.id] || [];
          const rem = t.filter(x => !x.done && !x.cancelled).length;
          const isExpanded = expanded.has(d.id);
          return (
            <button key={d.id} onClick={() => onTapDay && onTapDay(d.id)} style={{
              flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2,
              padding:'6px 0',
              background: isExpanded ? THEME.surface : 'rgba(255,255,255,0.20)',
              border: d.today ? `1px solid ${THEME.todayRing}` : `1px solid ${isExpanded ? THEME.borderHover : 'transparent'}`,
              borderRadius:6, cursor:'pointer',
              boxShadow: isExpanded ? '0 2px 6px rgba(0,0,0,0.10)' : 'none',
            }}>
              <span style={{fontFamily:THEME.mono, fontSize:9, color: isExpanded ? THEME.text : THEME.textMuted, textTransform:'uppercase', letterSpacing:'0.07em'}}>{d.label.slice(0,1)}</span>
              <span style={{fontFamily:THEME.mono, fontSize:12, fontWeight:500, color: d.today ? '#c25400' : THEME.text}}>{d.date.slice(3)}</span>
              <span style={{fontFamily:THEME.mono, fontSize:9, color: rem ? THEME.textMuted : THEME.textDim, marginTop:1}}>
                {rem || '✓'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterBadge({ children }) {
  return (
    <span style={{
      fontFamily:THEME.mono, fontSize:10, color:'#8a2020',
      background:'#fdecea', border:'1px solid #f5bdb8', borderRadius:6,
      padding:'3px 7px', textTransform:'uppercase', letterSpacing:'0.06em',
    }}>{children}</span>
  );
}

// ─────────────────────────────────────────────────────────────
// Weekly progress
// ─────────────────────────────────────────────────────────────
function WeekProgress({ T = TASKS }) {
  let done = 0, total = 0;
  DAYS.forEach(d => (T[d.id]||[]).forEach(t => { if (!t.cancelled) { total++; if (t.done) done++; }}));
  const pct = total ? Math.round(done/total*100) : 0;
  return (
    <div style={{padding:'2px 14px 8px'}}>
      <div style={{height:6, background:'rgba(0,0,0,0.10)', borderRadius:3, overflow:'hidden', position:'relative'}}>
        <div style={{
          position:'absolute', inset:0, width: pct + '%',
          background:'linear-gradient(to right, #a8ddb8, #6fbf85)',
        }}/>
      </div>
      <div style={{
        display:'flex', justifyContent:'space-between', marginTop:4,
        fontFamily:THEME.mono, fontSize:10, color:THEME.textMuted, letterSpacing:'0.05em',
      }}>
        <span>{done} / {total} done</span>
        <span>{pct}%</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Day hero (expanded) + Day row (collapsed)
// ─────────────────────────────────────────────────────────────
function DayHero({ day, tasks: dayTasks, filter, onLongPressTask, onTapCollapse }) {
  const allTasks = dayTasks || [];
  let tasks = allTasks;
  if (filter === 'important') tasks = tasks.filter(t => t.important && !t.done && !t.cancelled);
  return (
    <Paper today={day.today} style={{padding:'14px 14px 16px', display:'flex', flexDirection:'column', gap:8}}>
      {/* Header is a button so you can tap to collapse */}
      <button onClick={onTapCollapse} style={{
        display:'flex', alignItems:'baseline', justifyContent:'space-between',
        background:'none', border:'none', padding:0, textAlign:'left',
        cursor:'pointer', width:'100%',
      }}>
        <div style={{display:'flex', alignItems:'baseline', gap:8}}>
          <span style={{fontFamily:THEME.sans, fontSize:22, fontWeight:500, color:THEME.text}}>{day.label}</span>
          <span style={{fontFamily:THEME.mono, fontSize:11, color:THEME.textMuted}}>{day.md}</span>
          {day.today && <Flames/>}
        </div>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <span style={{fontFamily:THEME.mono, fontSize:10, color:THEME.textDim, textTransform:'uppercase', letterSpacing:'0.07em'}}>
            {allTasks.filter(t=>t.done).length} / {allTasks.filter(t=>!t.cancelled).length}
          </span>
          <span style={{fontFamily:THEME.mono, fontSize:14, color:THEME.textDim, lineHeight:1}}>▾</span>
        </div>
      </button>

      <div style={{height:1, background:THEME.border, margin:'2px 0 4px'}}/>

      <div style={{display:'flex', flexDirection:'column', gap:6}}>
        {tasks.length === 0 && filter === 'important' && (
          <div style={{fontFamily:THEME.mono, fontSize:11, color:THEME.textDim, padding:'8px 4px'}}>
            no important tasks for this day
          </div>
        )}
        {tasks.length === 0 && filter !== 'important' && (
          <div style={{
            fontFamily:THEME.mono, fontSize:11, color:THEME.textDim,
            padding:'12px 4px', textAlign:'center', borderRadius:6,
            background:'rgba(0,0,0,0.025)',
          }}>
            no tasks yet · drag from unscheduled or tap +
          </div>
        )}
        {tasks.map(t => (
          <div key={t.id} onClick={() => onLongPressTask && onLongPressTask(t, day.id)}>
            <TaskCard task={t} size="md"/>
          </div>
        ))}
        <AddTaskBtn style={{marginTop:2}}/>
      </div>
    </Paper>
  );
}

function DayRow({ day, tasks: dayTasks, filter, onTap }) {
  const tasks = dayTasks || [];
  const remaining = tasks.filter(t => !t.done && !t.cancelled).length;
  const hasImportant = tasks.some(t => t.important && !t.done && !t.cancelled);
  const dimmed = filter === 'important' && !hasImportant;
  return (
    <button onClick={onTap} style={{
      width:'100%', textAlign:'left',
      background: THEME.surface,
      border: `1px solid ${THEME.border}`,
      borderRadius:3,
      padding:'10px 12px',
      display:'flex', alignItems:'center', gap:10,
      boxShadow:'1px 1px 0 rgba(0,0,0,0.05), 2px 3px 5px rgba(30,20,10,0.10)',
      opacity: dimmed ? 0.45 : 1,
      cursor:'pointer',
    }}>
      <div style={{display:'flex', flexDirection:'column', minWidth:36}}>
        <span style={{fontFamily:THEME.mono, fontSize:11, fontWeight:500, color: day.today ? '#c25400' : THEME.textMuted, textTransform:'uppercase', letterSpacing:'0.07em'}}>{day.label}</span>
        <span style={{fontFamily:THEME.mono, fontSize:10, color:THEME.textDim}}>{day.date.slice(3)}</span>
      </div>
      <div style={{width:1, height:24, background:THEME.border}}/>
      <div style={{flex:1, minWidth:0}}>
        {tasks.length === 0
          ? <span style={{fontFamily:THEME.mono, fontSize:11, color:THEME.textDim}}>empty</span>
          : <DotRow tasks={tasks} max={20} size={7}/>}
      </div>
      {hasImportant && <span style={{color:'#e8130d', fontWeight:700, fontSize:15, lineHeight:1}}>!</span>}
      <span style={{
        fontFamily:THEME.mono, fontSize:11,
        color: remaining ? THEME.text : THEME.textDim,
        minWidth:22, textAlign:'right',
      }}>{remaining || '✓'}</span>
      <span style={{fontFamily:THEME.mono, color:THEME.textDim, fontSize:14}}>›</span>
    </button>
  );
}

function MiniIcon2({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      width:30, height:30, borderRadius:8, fontSize:13,
      fontFamily:THEME.mono, color:THEME.textMuted,
      background:'rgba(255,255,255,0.35)', border:`1px solid ${THEME.border}`,
      display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
    }}>{children}</button>
  );
}

Object.assign(window, { OptionC });
