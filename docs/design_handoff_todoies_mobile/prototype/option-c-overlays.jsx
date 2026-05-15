// option-c-overlays.jsx — sheets, drawers and menus for Option C.
// All overlays are absolutely positioned over the phone screen.

// ─────────────────────────────────────────────────────────────
// Shared scrim
// ─────────────────────────────────────────────────────────────
function Scrim({ onClick, children, justify = 'flex-end' }) {
  return (
    <div onClick={onClick} style={{
      position:'absolute', inset:0,
      background:'rgba(0,0,0,0.36)',
      display:'flex', flexDirection:'column', justifyContent:justify,
      zIndex:50,
    }}>{children}</div>
  );
}

function SheetCard({ children, style }) {
  return (
    <div onClick={e=>e.stopPropagation()} style={{
      background:THEME.surface,
      borderTopLeftRadius:18, borderTopRightRadius:18,
      padding:'10px 14px 18px',
      boxShadow:'0 -8px 30px rgba(0,0,0,0.22)',
      display:'flex', flexDirection:'column', gap:10,
      ...style,
    }}>
      <div style={{width:36, height:4, background:'rgba(0,0,0,0.18)', borderRadius:2, alignSelf:'center', margin:'4px 0 4px'}}/>
      {children}
    </div>
  );
}

function SheetSection({ label, children }) {
  return (
    <>
      <div style={{
        fontFamily:THEME.mono, fontSize:10, color:THEME.textDim,
        textTransform:'uppercase', letterSpacing:'0.08em', marginTop:6,
      }}>{label}</div>
      {children}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 1. Long-press → action sheet
// ─────────────────────────────────────────────────────────────
function ActionSheet({ task, fromDay, onDismiss }) {
  return (
    <Scrim onClick={onDismiss}>
      <SheetCard>
        <TaskCard task={task} size="md"/>

        <SheetSection label="move to">
          <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:6}}>
            {[{id:'unscheduled', label:'Unsch', date:''}, ...DAYS].map(d => {
              const isFrom = d.id === fromDay;
              return (
                <button key={d.id} style={{
                  fontFamily:THEME.mono, fontSize:11, padding:'8px 4px',
                  background: isFrom ? 'rgba(0,0,0,0.06)' : THEME.surface2,
                  border:`1px solid ${THEME.border}`, borderRadius:8,
                  color: isFrom ? THEME.textDim : THEME.text,
                  display:'flex', flexDirection:'column', gap:1,
                  opacity: isFrom ? 0.55 : 1,
                  cursor: isFrom ? 'default' : 'pointer',
                }}>
                  <span style={{textTransform:'uppercase', letterSpacing:'0.05em'}}>{d.label}</span>
                  <span style={{fontSize:9, color:THEME.textDim}}>{d.date}</span>
                </button>
              );
            })}
          </div>
        </SheetSection>

        <div style={{height:1, background:THEME.border, margin:'8px 0 2px'}}/>

        <SheetRow icon="✓" label="Mark done"/>
        <SheetRow icon="!" label="Mark important" color="#c0392b"/>
        <SheetRow icon="✕" label="Cancel task"   color="#8a2020"/>
        <SheetRow icon="🗑" label="Delete"        color="#c0392b"/>
      </SheetCard>
    </Scrim>
  );
}

function SheetRow({ icon, label, color }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:14, padding:'10px 4px',
      fontFamily:THEME.sans, fontSize:14.5, color: color || THEME.text, cursor:'pointer',
    }}>
      <span style={{fontFamily:THEME.mono, width:18, textAlign:'center', fontWeight:600}}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. Quick add → bottom sheet (two steps: pick label → type)
// ─────────────────────────────────────────────────────────────
function AddTaskSheet({ step = 1, dayId = 'thu', selectedType = 'Work', typedText = '', onDismiss }) {
  const day = DAYS.find(d => d.id === dayId) || { id:'thu', label:'Thu', date:'05/14' };
  const types = Object.keys(LABELS);
  return (
    <Scrim onClick={onDismiss}>
      <SheetCard style={{paddingBottom: step === 2 ? 0 : 18}}>
        <div style={{
          display:'flex', justifyContent:'space-between', alignItems:'baseline',
          fontFamily:THEME.mono, fontSize:11, color:THEME.textDim,
          textTransform:'uppercase', letterSpacing:'0.07em',
        }}>
          <span>add task</span>
          <span style={{color:THEME.textMuted}}>→ {day.label.toLowerCase()} · {day.date}</span>
        </div>

        {/* Step 1: pick label */}
        <SheetSection label={step === 1 ? '1 · pick a label' : '1 · label'}>
          <div style={{display:'flex', flexWrap:'wrap', gap:5}}>
            {types.map(name => {
              const c = LABELS[name];
              const selected = name === selectedType;
              return (
                <button key={name} style={{
                  fontFamily:THEME.mono, fontSize:11, padding:'5px 11px',
                  borderRadius:20,
                  background: c.bg, color: c.text,
                  border:`1px solid ${selected ? c.text : c.border}`,
                  opacity: selected ? 1 : 0.85,
                  boxShadow: selected ? '0 0 0 2px rgba(0,0,0,0.18)' : 'none',
                  cursor:'pointer',
                }}>{name}</button>
              );
            })}
            <button style={{
              fontFamily:THEME.mono, fontSize:11, padding:'5px 11px',
              borderRadius:20,
              background:'transparent', border:`1px dashed ${THEME.borderHover}`,
              color: THEME.textDim,
            }}>+ new</button>
          </div>
        </SheetSection>

        {step === 2 && (
          <SheetSection label="2 · name">
            <div style={{
              background: LABELS[selectedType].bg,
              border:`1px solid ${LABELS[selectedType].border}`,
              borderRadius:8, padding:'10px 12px',
              display:'flex', alignItems:'center', gap:8,
            }}>
              <span style={{
                fontFamily:THEME.sans, fontSize:15, color: LABELS[selectedType].text,
                flex:1, minWidth:0, lineHeight:1.3,
              }}>{typedText || 'Type a task…'}{typedText && <Caret/>}</span>
              <button style={{
                fontFamily:THEME.mono, fontSize:11, padding:'5px 11px',
                background:THEME.accent, color:'#fff',
                border:'none', borderRadius:6, cursor:'pointer',
              }}>add</button>
            </div>
            <div style={{
              fontFamily:THEME.mono, fontSize:10, color:THEME.textDim,
              display:'flex', gap:12, marginTop:4,
            }}>
              <span>↵ add &amp; close</span>
              <span>⇧↵ add &amp; keep open</span>
              <span style={{flex:1}}/>
              <span>! marks important</span>
            </div>
          </SheetSection>
        )}

        {/* iOS keyboard placeholder for step 2 */}
        {step === 2 && <KeyboardStub/>}
      </SheetCard>
    </Scrim>
  );
}

function Caret() {
  return (
    <span style={{
      display:'inline-block', width:2, height:'1em',
      background:'#1a1a1a', marginLeft:1,
      verticalAlign:'text-bottom',
      animation:'cBlink 1s steps(1) infinite',
    }}/>
  );
}

function KeyboardStub() {
  // Faint keyboard outline to suggest the sheet sits above it
  const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  return (
    <div style={{
      marginTop:10, marginLeft:-14, marginRight:-14, marginBottom:0,
      padding:'10px 6px 22px',
      background:'#cdd0d6',
      borderTop:'1px solid rgba(0,0,0,0.10)',
      display:'flex', flexDirection:'column', gap:6,
    }}>
      {rows.map((r, ri) => (
        <div key={ri} style={{
          display:'flex', justifyContent:'center', gap:4,
          paddingLeft: ri === 1 ? 16 : 0, paddingRight: ri === 1 ? 16 : 0,
        }}>
          {r.split('').map(k => (
            <span key={k} style={{
              flex:1, maxWidth:32, height:34, borderRadius:5,
              background:'#fdfdfd', border:'1px solid rgba(0,0,0,0.08)',
              boxShadow:'0 1px 0 rgba(0,0,0,0.12)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:THEME.sans, fontSize:14, color:'#111',
            }}>{k}</span>
          ))}
        </div>
      ))}
      <div style={{display:'flex', gap:4, justifyContent:'center'}}>
        <span style={{width:42, height:32, borderRadius:5, background:'#a8adb6'}}/>
        <span style={{flex:1, maxWidth:160, height:32, borderRadius:5, background:'#fdfdfd', border:'1px solid rgba(0,0,0,0.08)'}}/>
        <span style={{width:42, height:32, borderRadius:5, background:THEME.accent}}/>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. Side menu (≡) → slide-over from right
// ─────────────────────────────────────────────────────────────
function SideMenu({ onDismiss }) {
  return (
    <Scrim onClick={onDismiss} justify="flex-start">
      <div style={{flex:1, minHeight:0, display:'flex', justifyContent:'flex-end'}}>
        <div onClick={e=>e.stopPropagation()} style={{
          width:260, height:'100%',
          background:`rgba(220, 200, 160, 0.94)`,
          backdropFilter:'blur(8px)',
          WebkitBackdropFilter:'blur(8px)',
          borderLeft:`1px solid ${THEME.border}`,
          padding:'48px 18px 24px',
          display:'flex', flexDirection:'column', gap:18,
        }}>
          <div>
            <div style={{fontFamily:THEME.mono, fontSize:10, color:THEME.textMuted, textTransform:'uppercase', letterSpacing:'0.08em'}}>signed in</div>
            <div style={{fontFamily:THEME.sans, fontSize:15, color:THEME.text, marginTop:2}}>todoies user</div>
          </div>

          <MenuGroup title="account">
            <MenuRow label="Add account"/>
            <MenuRow label="Delete account" danger/>
          </MenuGroup>

          <MenuGroup title="labels">
            {Object.keys(LABELS).slice(0,6).map(n => {
              const c = LABELS[n];
              return (
                <div key={n} style={{display:'flex', alignItems:'center', gap:10, padding:'6px 4px'}}>
                  <span style={{
                    width:14, height:14, borderRadius:4,
                    background:c.bg, border:`1px solid ${c.border}`,
                  }}/>
                  <span style={{fontFamily:THEME.mono, fontSize:12, color:c.text}}>{n}</span>
                  <span style={{flex:1}}/>
                  <span style={{fontFamily:THEME.mono, fontSize:10, color:THEME.textDim}}>×</span>
                </div>
              );
            })}
            <MenuRow label="+ add label" dashed/>
          </MenuGroup>

          <MenuGroup title="settings">
            <div style={{display:'flex', gap:6, padding:'4px 4px'}}>
              <Pill>EN</Pill>
              <Pill>scale −</Pill>
              <Pill>scale +</Pill>
            </div>
          </MenuGroup>

          <div style={{flex:1}}/>
          <div style={{fontFamily:THEME.mono, fontSize:10, color:THEME.textDim}}>tap outside to close</div>
        </div>
      </div>
    </Scrim>
  );
}

function MenuGroup({ title, children }) {
  return (
    <div style={{display:'flex', flexDirection:'column', gap:4}}>
      <div style={{fontFamily:THEME.mono, fontSize:10, color:THEME.textDim, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:2}}>{title}</div>
      {children}
    </div>
  );
}

function MenuRow({ label, danger, dashed }) {
  return (
    <button style={{
      fontFamily:THEME.mono, fontSize:12,
      textAlign:'left', padding:'7px 10px', borderRadius:6,
      background:'rgba(0,0,0,0.06)', border:`1px ${dashed?'dashed':'solid'} ${THEME.borderHover}`,
      color: danger ? '#8a2020' : THEME.text, cursor:'pointer',
    }}>{label}</button>
  );
}

function Pill({ children }) {
  return (
    <button style={{
      fontFamily:THEME.mono, fontSize:11,
      padding:'4px 9px', borderRadius:5,
      background:THEME.surface, border:`1px solid ${THEME.borderHover}`,
      color: THEME.textMuted, cursor:'pointer',
    }}>{children}</button>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. Unscheduled drawer — full sky-blue list of unscheduled tasks
// ─────────────────────────────────────────────────────────────
function UnscheduledDrawer({ onDismiss }) {
  return (
    <Scrim onClick={onDismiss}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:`
          radial-gradient(ellipse 160px 70px at 15% 25%, rgba(255,255,255,0.45) 0%, transparent 65%),
          radial-gradient(ellipse 200px 80px at 52% 65%, rgba(255,255,255,0.38) 0%, transparent 65%),
          linear-gradient(to bottom, ${THEME.unschedFrom} 0%, ${THEME.unschedMid} 55%, ${THEME.unschedTo} 100%)
        `,
        borderTopLeftRadius:18, borderTopRightRadius:18,
        borderTop:`1px dashed ${THEME.unschedBorder}`,
        padding:'10px 14px 22px',
        boxShadow:'0 -8px 30px rgba(0,0,0,0.22)',
        display:'flex', flexDirection:'column', gap:10,
        maxHeight:'82%',
      }}>
        <div style={{width:36, height:4, background:'rgba(80,150,200,0.4)', borderRadius:2, alignSelf:'center'}}/>
        <div style={{
          display:'flex', alignItems:'baseline', justifyContent:'space-between',
        }}>
          <div>
            <div style={{fontFamily:THEME.mono, fontSize:10, color:'#3a6a8a', textTransform:'uppercase', letterSpacing:'0.08em'}}>unscheduled</div>
            <div style={{fontFamily:THEME.sans, fontSize:17, fontWeight:500, color:'#1a4a6a', marginTop:2}}>{TASKS.unscheduled.length} tasks waiting</div>
          </div>
          <button style={{
            fontFamily:THEME.mono, fontSize:11, padding:'5px 10px',
            background:'rgba(255,255,255,0.65)', border:'1px solid rgba(80,150,200,0.30)',
            color:'#1a4a6a', borderRadius:6, cursor:'pointer',
          }}>+ add</button>
        </div>

        <div style={{
          display:'flex', flexDirection:'column', gap:6,
          overflowY:'auto', paddingRight:2, marginTop:4,
        }}>
          {TASKS.unscheduled.map(t => (
            <div key={t.id} style={{display:'flex', alignItems:'center', gap:8}}>
              <TaskCard task={t} size="md" style={{flex:1}}/>
              <button style={{
                fontFamily:THEME.mono, fontSize:11, padding:'8px 10px',
                background:'rgba(255,255,255,0.70)', border:'1px solid rgba(80,150,200,0.30)',
                color:'#1a4a6a', borderRadius:6, whiteSpace:'nowrap',
              }}>schedule ›</button>
            </div>
          ))}
        </div>

        <div style={{
          fontFamily:THEME.mono, fontSize:10, color:'#3a6a8a',
          textAlign:'center', paddingTop:6, opacity:0.8,
        }}>tap "schedule" or long-press to move to a day</div>
      </div>
    </Scrim>
  );
}

Object.assign(window, { ActionSheet, AddTaskSheet, SideMenu, UnscheduledDrawer });
