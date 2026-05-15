// option-c-interactive.jsx
// Interactive Option C prototype — tap day rows to expand, tap tasks to open
// the action sheet, tap quick add to open the add-task sheet, tap ≡ for menu,
// tap the unscheduled chip for the drawer. State is local; no persistence.

function OptionCInteractive({ initialExpandedIds = ['thu'], initialHeader = 'strip' }) {
  const [expanded,   setExpanded]   = React.useState(() => new Set(initialExpandedIds));
  const [overlay,    setOverlay]    = React.useState(null); // {kind, ...}
  const [header,     setHeader]     = React.useState(initialHeader);
  const [filter,     setFilter]     = React.useState('all');
  const [addStep,    setAddStep]    = React.useState(1);
  const [typed,      setTyped]      = React.useState('Bloomberg ');

  const toggleDay = (id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const close = () => setOverlay(null);

  // Pick a sensible day-id when an action sheet / add sheet needs one.
  const focusedDay = expanded.has('thu') ? 'thu' : ([...expanded][0] || 'thu');

  let overlayEl = null;
  if (overlay?.kind === 'action') {
    overlayEl = <ActionSheet task={overlay.task} fromDay={overlay.fromDay} onDismiss={close}/>;
  } else if (overlay?.kind === 'add') {
    overlayEl = (
      <AddTaskSheet
        step={addStep}
        dayId={focusedDay}
        selectedType="Work"
        typedText={addStep === 2 ? typed : ''}
        onDismiss={() => { setAddStep(1); close(); }}
      />
    );
  } else if (overlay?.kind === 'menu') {
    overlayEl = <SideMenu onDismiss={close}/>;
  } else if (overlay?.kind === 'unsched') {
    overlayEl = <UnscheduledDrawer onDismiss={close}/>;
  }

  return (
    <div style={{position:'relative', width:'100%', height:'100%'}}>
      <OptionC
        expandedIds={expanded}
        header={header}
        filter={filter}
        overlay={overlayEl}
        onTapDay={toggleDay}
        onLongPressTask={(task, fromDay) => setOverlay({kind:'action', task, fromDay})}
        onTapQuickAdd={() => { setAddStep(1); setOverlay({kind:'add'}); }}
        onTapMenu={() => setOverlay({kind:'menu'})}
        onTapUnsched={() => setOverlay({kind:'unsched'})}
      />

      {/* Mini control strip for the demo — hidden when an overlay is open */}
      {!overlay && (
        <div style={{
          position:'absolute', top:0, left:0, right:0,
          padding:'4px 6px',
          display:'flex', gap:6, justifyContent:'center',
          pointerEvents:'none',
        }}>
          <div style={{
            display:'flex', gap:4, pointerEvents:'auto',
            background:'rgba(20,15,5,0.55)', borderRadius:14, padding:'3px 4px',
            fontFamily:THEME.mono, fontSize:9, color:'#fff',
            letterSpacing:'0.05em', textTransform:'uppercase',
            backdropFilter:'blur(4px)',
          }}>
            <CtrlBtn active={header==='strip'}  onClick={()=>setHeader('strip')}>strip</CtrlBtn>
            <CtrlBtn active={header==='wide'}   onClick={()=>setHeader('wide')}>wide</CtrlBtn>
            <span style={{width:1, background:'rgba(255,255,255,0.18)', margin:'2px 2px'}}/>
            <CtrlBtn active={filter==='all'}        onClick={()=>setFilter('all')}>all</CtrlBtn>
            <CtrlBtn active={filter==='important'}  onClick={()=>setFilter('important')}>!  only</CtrlBtn>
            <span style={{width:1, background:'rgba(255,255,255,0.18)', margin:'2px 2px'}}/>
            <CtrlBtn onClick={()=>setExpanded(new Set(DAYS.map(d=>d.id)))}>expand all</CtrlBtn>
            <CtrlBtn onClick={()=>setExpanded(new Set(['thu']))}>only today</CtrlBtn>
          </div>
        </div>
      )}
    </div>
  );
}

function CtrlBtn({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      fontFamily:THEME.mono, fontSize:9,
      color: active ? '#1a1a1a' : '#fff',
      background: active ? '#ffd9a8' : 'transparent',
      border:'none', borderRadius:10, padding:'4px 8px',
      letterSpacing:'0.05em', textTransform:'uppercase',
      cursor:'pointer',
    }}>{children}</button>
  );
}

Object.assign(window, { OptionCInteractive });
