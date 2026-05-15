// option-a-day-focus.jsx
// A: Day Focus — one day at a time. Sticky day-strip at top, big tasks below.
// Best for adding/checking off; swipe horizontally to switch days.

function OptionA({ initialDayId = 'thu', actionSheet = null }) {
  const [activeId, setActiveId] = React.useState(initialDayId);
  const active = DAYS.find(d => d.id === activeId);
  const tasks  = TASKS[activeId] || [];
  const unsched = TASKS.unscheduled;

  return (
    <WoodBg style={{display:'flex', flexDirection:'column'}}>
      {/* top bar */}
      <div style={{
        padding:'12px 16px 0', display:'flex', alignItems:'center', justifyContent:'space-between',
      }}>
        <span style={{fontFamily:THEME.mono, fontSize:13, fontWeight:500, color:THEME.accent, letterSpacing:'-0.02em'}}>weekly planner</span>
        <div style={{display:'flex', gap:8}}>
          <IconBtn>◆</IconBtn>
          <IconBtn>≡</IconBtn>
        </div>
      </div>

      {/* week strip — scrollable horizontally, snap-ish */}
      <DayStrip days={DAYS} activeId={activeId} onPick={setActiveId} />

      {/* unscheduled rail (collapsed-by-default; horizontal scroll of mini chips) */}
      <SkyBg style={{margin:'4px 12px 8px', padding:'6px 8px'}}>
        <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:6}}>
          <span style={{fontFamily:THEME.mono, fontSize:9, textTransform:'uppercase', letterSpacing:'0.08em', color:'#3a6a8a'}}>unscheduled · {unsched.length}</span>
          <span style={{flex:1}}/>
          <span style={{fontFamily:THEME.mono, fontSize:10, color:'#3a6a8a'}}>+ add</span>
        </div>
        <div style={{display:'flex', gap:5, overflowX:'auto', paddingBottom:2}}>
          {unsched.map(t => (
            <TaskCard key={t.id} task={t} size="sm" style={{flex:'0 0 auto', minWidth:120, maxWidth:160}}/>
          ))}
        </div>
      </SkyBg>

      {/* main paper card for the active day — fills remaining space */}
      <Paper today={active.today} style={{
        margin:'0 12px 12px', padding:'12px 12px 14px',
        display:'flex', flexDirection:'column', gap:8,
        flex:1, minHeight:0, overflow:'hidden',
      }}>
        <DayHeader day={active} big right={
          <span style={{fontFamily:THEME.mono, fontSize:10, color:THEME.textDim}}>
            {tasks.filter(t=>t.done).length}/{tasks.filter(t=>!t.cancelled).length} done
          </span>
        }/>

        <div style={{display:'flex', flexDirection:'column', gap:6, overflowY:'auto', flex:1, paddingRight:2}}>
          {tasks.map(t => <TaskCard key={t.id} task={t} size="lg"/>)}
          <AddTaskBtn style={{marginTop:4}}/>
        </div>
      </Paper>

      {/* bottom add bar — primary action */}
      <div style={{
        padding:'8px 12px 14px',
        display:'flex', gap:8,
      }}>
        <button style={{
          flex:1, fontFamily:THEME.mono, fontSize:13, color:THEME.text,
          background:THEME.surface, border:`1px solid ${THEME.borderHover}`, borderRadius:10,
          padding:'12px 14px', textAlign:'left',
        }}>+ add to {active.label.toLowerCase()}</button>
        <button style={{
          fontFamily:THEME.mono, fontSize:18, color:THEME.text,
          background:THEME.surface, border:`1px solid ${THEME.borderHover}`, borderRadius:10,
          padding:'0 14px', width:48,
        }}>↻</button>
      </div>

      {actionSheet && <MoveSheet {...actionSheet}/>}
    </WoodBg>
  );
}

function IconBtn({ children }) {
  return (
    <button style={{
      width:32, height:32, borderRadius:8, fontSize:14,
      fontFamily:THEME.mono, color:THEME.textMuted,
      background:'rgba(255,255,255,0.35)', border:`1px solid ${THEME.border}`,
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>{children}</button>
  );
}

function DayStrip({ days, activeId, onPick }) {
  return (
    <div style={{
      display:'flex', gap:6, padding:'10px 12px 8px',
      overflowX:'auto', scrollSnapType:'x mandatory',
    }}>
      {days.map(d => {
        const isActive = d.id === activeId;
        const count = (TASKS[d.id] || []).length;
        const allDone = count > 0 && (TASKS[d.id] || []).every(t => t.done || t.cancelled);
        return (
          <button key={d.id} onClick={() => onPick(d.id)} style={{
            flex:'0 0 auto', scrollSnapAlign:'center',
            display:'flex', flexDirection:'column', alignItems:'center', gap:3,
            padding:'8px 12px',
            background: isActive ? THEME.surface : 'rgba(255,255,255,0.18)',
            border: d.today ? `1px solid ${THEME.todayRing}` : `1px solid ${isActive ? THEME.borderHover : 'transparent'}`,
            borderRadius:10, minWidth:54, position:'relative',
          }}>
            <span style={{fontFamily:THEME.mono, fontSize:10, color:THEME.textMuted, textTransform:'uppercase', letterSpacing:'0.07em'}}>{d.label}</span>
            <span style={{fontFamily:THEME.mono, fontSize:15, fontWeight:500, color: d.today ? '#c25400' : THEME.text}}>{d.date.slice(3)}</span>
            <span style={{position:'absolute', bottom:4, display:'flex', gap:2}}>
              {(TASKS[d.id] || []).slice(0,4).map(t => {
                const c = LABELS[t.type] || LABELS.Random;
                return <span key={t.id} style={{width:4, height:4, borderRadius:'50%', background:c.border, opacity: t.done||t.cancelled ? 0.3:1}}/>;
              })}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Action sheet for long-pressed task — "Move to…", mark done, important, delete.
function MoveSheet({ task, fromDay }) {
  return (
    <div style={{
      position:'absolute', inset:0,
      background:'rgba(0,0,0,0.32)',
      display:'flex', flexDirection:'column', justifyContent:'flex-end',
      zIndex:50,
    }}>
      <div style={{
        background:THEME.surface, borderTopLeftRadius:18, borderTopRightRadius:18,
        padding:'10px 14px 16px',
        boxShadow:'0 -8px 24px rgba(0,0,0,0.18)',
        display:'flex', flexDirection:'column', gap:10,
      }}>
        <div style={{width:36, height:4, background:'rgba(0,0,0,0.18)', borderRadius:2, alignSelf:'center', margin:'4px 0 4px'}}/>
        <TaskCard task={task} size="md"/>
        <div style={{fontFamily:THEME.mono, fontSize:10, color:THEME.textDim, textTransform:'uppercase', letterSpacing:'0.08em', marginTop:2}}>move to</div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:6}}>
          {[{id:'unsched', label:'Unsch', date:''}, ...DAYS].map(d => {
            const isFrom = d.id === fromDay;
            return (
              <button key={d.id} style={{
                fontFamily:THEME.mono, fontSize:11, padding:'8px 4px',
                background: isFrom ? 'rgba(0,0,0,0.06)' : THEME.surface2,
                border:`1px solid ${THEME.border}`, borderRadius:8,
                color: isFrom ? THEME.textDim : THEME.text,
                display:'flex', flexDirection:'column', gap:1,
                opacity: isFrom ? 0.55 : 1,
              }}>
                <span style={{textTransform:'uppercase', letterSpacing:'0.05em'}}>{d.label}</span>
                <span style={{fontSize:9, color:THEME.textDim}}>{d.date}</span>
              </button>
            );
          })}
        </div>
        <div style={{height:1, background:THEME.border, margin:'6px 0 2px'}}/>
        <SheetRow icon="✓" label="Mark done"/>
        <SheetRow icon="!" label="Mark important" color="#c0392b"/>
        <SheetRow icon="✕" label="Cancel task" color="#8a2020"/>
        <SheetRow icon="🗑" label="Delete" color="#c0392b"/>
      </div>
    </div>
  );
}

function SheetRow({ icon, label, color }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12, padding:'10px 4px',
      fontFamily:THEME.sans, fontSize:14, color: color || THEME.text,
    }}>
      <span style={{fontFamily:THEME.mono, width:18, textAlign:'center', fontWeight:600}}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

Object.assign(window, { OptionA });
