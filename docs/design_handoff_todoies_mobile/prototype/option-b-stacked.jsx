// option-b-stacked.jsx
// B: Stacked Days — full week as a vertical scrolling list. Each day = full-width
// paper card. Closest mental model to the desktop board.

function OptionB({ scrollTo = 'thu' }) {
  return (
    <WoodBg style={{display:'flex', flexDirection:'column'}}>
      {/* Header */}
      <div style={{
        padding:'10px 14px 8px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        borderBottom:`1px solid ${THEME.border}`,
      }}>
        <div style={{display:'flex', alignItems:'baseline', gap:8}}>
          <span style={{fontFamily:THEME.mono, fontSize:13, fontWeight:500, color:THEME.accent}}>weekly planner</span>
          <span style={{fontFamily:THEME.mono, fontSize:10, color:THEME.textDim}}>week of may 11</span>
        </div>
        <div style={{display:'flex', gap:6}}>
          <MiniIcon>◆</MiniIcon>
          <MiniIcon>≡</MiniIcon>
        </div>
      </div>

      {/* Mini week dots — tap to jump-scroll */}
      <div style={{display:'flex', gap:4, padding:'8px 12px', background:'rgba(0,0,0,0.04)'}}>
        {DAYS.map(d => {
          const t = TASKS[d.id] || [];
          const remaining = t.filter(x => !x.done && !x.cancelled).length;
          return (
            <div key={d.id} style={{
              flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2,
              padding:'4px 0',
              background: d.id === scrollTo ? 'rgba(255,255,255,0.5)' : 'transparent',
              border: d.today ? `1px solid ${THEME.todayRing}` : '1px solid transparent',
              borderRadius:6,
            }}>
              <span style={{fontFamily:THEME.mono, fontSize:9, color:THEME.textMuted, textTransform:'uppercase'}}>{d.label.slice(0,1)}</span>
              <span style={{fontFamily:THEME.mono, fontSize:11, fontWeight:500, color: d.today ? '#c25400' : THEME.text}}>{remaining || '·'}</span>
            </div>
          );
        })}
      </div>

      {/* Unscheduled stripe — collapsed to a single-row horizontal scroll */}
      <SkyBg style={{margin:'8px 12px 6px', padding:'8px 10px'}}>
        <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:6}}>
          <span style={{fontFamily:THEME.mono, fontSize:9, textTransform:'uppercase', letterSpacing:'0.08em', color:'#3a6a8a'}}>unscheduled · week 1</span>
          <span style={{flex:1}}/>
          <span style={{fontFamily:THEME.mono, fontSize:10, color:'#3a6a8a'}}>+</span>
        </div>
        <div style={{display:'flex', gap:5, overflowX:'auto'}}>
          {TASKS.unscheduled.map(t => (
            <TaskCard key={t.id} task={t} size="sm" style={{flex:'0 0 auto', minWidth:115, maxWidth:150}}/>
          ))}
        </div>
      </SkyBg>

      {/* Vertical scroll of day cards */}
      <div style={{
        flex:1, minHeight:0, overflowY:'auto',
        padding:'4px 12px 80px',
        display:'flex', flexDirection:'column', gap:10,
      }}>
        {DAYS.map(d => <DayCard key={d.id} day={d} scrolledTo={d.id === scrollTo}/>)}
      </div>

      {/* Floating quick-add */}
      <button style={{
        position:'absolute', right:18, bottom:22,
        width:56, height:56, borderRadius:'50%',
        background:THEME.surface, border:`1px solid ${THEME.borderHover}`,
        boxShadow:'0 6px 16px rgba(0,0,0,0.22), 1px 1px 0 rgba(0,0,0,0.08)',
        fontFamily:THEME.mono, fontSize:24, color:THEME.accent,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>+</button>
    </WoodBg>
  );
}

function DayCard({ day, scrolledTo }) {
  const tasks = TASKS[day.id] || [];
  return (
    <Paper today={day.today} style={{
      padding:'10px 12px 12px',
      display:'flex', flexDirection:'column', gap:6,
      outline: scrolledTo && day.today ? `2px solid ${THEME.todayRing}` : 'none',
      outlineOffset: 1,
    }}>
      <DayHeader day={day} right={
        <span style={{fontFamily:THEME.mono, fontSize:10, color:THEME.textDim}}>
          {tasks.length === 0 ? '—' : `${tasks.filter(t=>t.done).length}/${tasks.filter(t=>!t.cancelled).length}`}
        </span>
      }/>
      <div style={{display:'flex', flexDirection:'column', gap:5}}>
        {tasks.map(t => <TaskCard key={t.id} task={t} size="md"/>)}
        <AddTaskBtn/>
      </div>
    </Paper>
  );
}

function MiniIcon({ children }) {
  return (
    <button style={{
      width:28, height:28, borderRadius:6, fontSize:13,
      fontFamily:THEME.mono, color:THEME.textMuted,
      background:'rgba(255,255,255,0.35)', border:`1px solid ${THEME.border}`,
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>{children}</button>
  );
}

Object.assign(window, { OptionB });
