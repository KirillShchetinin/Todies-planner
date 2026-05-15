// mobile-shared.jsx — small primitives shared by all three option files.
// Strictly visual; no business logic.

// Wood-board backdrop matching frontend/style.css body bg.
function WoodBg({ children, style }) {
  return (
    <div style={{
      width:'100%', height:'100%',
      background: `
        radial-gradient(ellipse 120% 100% at 50% 50%, transparent 60%, rgba(0,0,0,0.22) 100%),
        repeating-linear-gradient(174deg, transparent 0 18px, rgba(0,0,0,0.04) 18px 19px, transparent 19px 34px, rgba(255,255,255,0.05) 34px 35px),
        repeating-linear-gradient(180deg, transparent 0 60px, rgba(0,0,0,0.035) 60px 62px, transparent 62px 130px, rgba(255,255,255,0.04) 130px 132px),
        linear-gradient(168deg, #e2cfa8 0%, #d8c298 30%, #d0ba90 55%, #dac49c 80%, #e0cca6 100%)
      `,
      ...style,
    }}>
      {children}
    </div>
  );
}

// Sky/blue unscheduled stripe (matches .unscheduled-bar)
function SkyBg({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: `
        radial-gradient(ellipse 160px 70px at 15% 55%, rgba(255,255,255,0.45) 0%, transparent 65%),
        radial-gradient(ellipse 200px 80px at 52% 45%, rgba(255,255,255,0.38) 0%, transparent 65%),
        radial-gradient(ellipse 150px 65px at 82% 50%, rgba(255,255,255,0.35) 0%, transparent 65%),
        linear-gradient(to bottom, ${THEME.unschedFrom} 0%, ${THEME.unschedMid} 55%, ${THEME.unschedTo} 100%)
      `,
      border:`1px dashed ${THEME.unschedBorder}`,
      borderRadius:10,
      ...style,
    }}>
      {children}
    </div>
  );
}

// Paper card (matches .col): off-white with crisp 1-2-3px stacked shadows.
function Paper({ children, style, today, dashed }) {
  const ring = today ? `1px solid ${THEME.todayRing}` : `1px solid ${THEME.border}`;
  return (
    <div style={{
      background: today ? THEME.todayTint : THEME.surface,
      border: dashed ? `1px dashed ${THEME.borderHover}` : ring,
      borderRadius: 3,
      boxShadow: `
        1px 1px 0 rgba(0,0,0,0.06),
        2px 2px 0 rgba(0,0,0,0.04),
        3px 4px 6px rgba(30,20,10,0.18),
        -1px 3px 8px rgba(30,20,10,0.10),
        4px 1px 8px rgba(30,20,10,0.08)
      `,
      ...style,
    }}>
      {children}
    </div>
  );
}

// Label pill background applied to a task (uses the same `bg/border/text` from constants).
function TaskCard({ task, size = 'md', style, onClick }) {
  const c = LABELS[task.type] || LABELS.Random;
  const pad   = size === 'sm' ? '5px 8px' : size === 'lg' ? '10px 12px' : '7px 10px';
  const fs    = size === 'sm' ? 12 : size === 'lg' ? 15 : 13;
  return (
    <div onClick={onClick} style={{
      position:'relative',
      background: c.bg, border:`1px solid ${c.border}`, color: c.text,
      borderRadius:6, padding: pad, fontSize: fs,
      fontFamily: THEME.sans, lineHeight:1.35,
      display:'flex', alignItems:'flex-start', gap:6,
      opacity: task.done ? 0.7 : 1,
      overflow:'hidden',
      ...style,
    }}>
      {task.important && (
        <span style={{ color:'#e8130d', fontWeight:700, fontSize: fs+3, lineHeight:1, marginRight:-2 }}>!</span>
      )}
      <span style={{
        flex:1, wordBreak:'break-word',
        textDecoration: task.done ? 'line-through' : 'none',
        textDecorationColor: 'rgba(0,0,0,0.35)',
      }}>{task.text}</span>
      {task.done && (
        <span style={{ color:'#27ae60', fontSize: fs+2, lineHeight:1, marginLeft:'auto' }}>✓</span>
      )}
      {task.cancelled && <CancelOverlay />}
    </div>
  );
}

// X overlay for cancelled tasks (matches .task.cancelled ::before/::after diagonals).
function CancelOverlay() {
  const line = 'linear-gradient(to bottom right, transparent calc(50% - 0.6px), rgba(180,30,30,0.55) calc(50% - 0.6px), rgba(180,30,30,0.55) calc(50% + 0.6px), transparent calc(50% + 0.6px))';
  const line2= 'linear-gradient(to bottom left,  transparent calc(50% - 0.6px), rgba(180,30,30,0.55) calc(50% - 0.6px), rgba(180,30,30,0.55) calc(50% + 0.6px), transparent calc(50% + 0.6px))';
  return (
    <>
      <span style={{position:'absolute', inset:0, background:line, pointerEvents:'none'}} />
      <span style={{position:'absolute', inset:0, background:line2, pointerEvents:'none'}} />
    </>
  );
}

// Small dotted row indicator (used in compact views) — one dot per task in label color.
function DotRow({ tasks, max = 12, size = 6 }) {
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
      {tasks.slice(0, max).map((t, i) => {
        const c = LABELS[t.type] || LABELS.Random;
        return (
          <span key={t.id} style={{
            width:size, height:size, borderRadius:'50%',
            background: c.border,
            opacity: t.done || t.cancelled ? 0.3 : 1,
          }}/>
        );
      })}
      {tasks.length > max && (
        <span style={{ fontFamily: THEME.mono, fontSize: 9, color: THEME.textDim, marginLeft:2 }}>+{tasks.length - max}</span>
      )}
    </div>
  );
}

// Flames for today (matches .today-flames).
function Flames() {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:1, marginLeft:6 }}>
      <span style={{fontSize:13}}>🔥</span>
      <span style={{fontSize:15}}>🔥</span>
      <span style={{fontSize:13}}>🔥</span>
    </span>
  );
}

// "+ add task" footer matching the desktop .add-btn dashed style.
function AddTaskBtn({ children = '+ add task', style, onClick }) {
  return (
    <button onClick={onClick} style={{
      width:'100%', textAlign:'left',
      fontFamily: THEME.mono, fontSize: 12, color: THEME.textDim,
      background:'none', border:`1px dashed ${THEME.border}`, borderRadius:6,
      padding:'8px 10px', cursor:'pointer',
      ...style,
    }}>{children}</button>
  );
}

// Day header label (DM Mono uppercase like .col-header)
function DayHeader({ day, right, big }) {
  const sz = big ? 18 : 12;
  return (
    <div style={{
      display:'flex', alignItems:'baseline', justifyContent:'space-between',
      fontFamily: THEME.mono, color: THEME.textMuted,
      textTransform:'uppercase', letterSpacing:'0.07em',
      paddingBottom:6, borderBottom:`1px solid ${THEME.border}`,
    }}>
      <span style={{display:'flex', alignItems:'baseline', gap:8}}>
        <span style={{fontSize: sz, fontWeight:500, color: day.today ? THEME.accent : THEME.textMuted}}>{day.label}</span>
        <span style={{fontSize: big ? 12 : 10, color: THEME.textDim, textTransform:'none', letterSpacing:0}}>{day.date}</span>
        {day.today && <Flames/>}
      </span>
      {right}
    </div>
  );
}

Object.assign(window, { WoodBg, SkyBg, Paper, TaskCard, CancelOverlay, DotRow, Flames, AddTaskBtn, DayHeader });
