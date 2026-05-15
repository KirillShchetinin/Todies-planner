// shared-data.jsx — mock data + theme tokens lifted from frontend/style.css + constants.js
// Mirrors a real week so all three mobile proposals show identical content.

const THEME = {
  // wood/board
  board: '#d8c298',
  boardEdge: 'rgba(0,0,0,0.30)',
  // unscheduled stripe (light sky)
  unschedFrom: '#b8ddf0',
  unschedMid:  '#cce8f5',
  unschedTo:   '#ddf0f8',
  unschedBorder: 'rgba(80,150,200,0.30)',
  // paper
  surface:  '#f0eeea',
  surface2: '#e6e3de',
  border:        'rgba(0,0,0,0.10)',
  borderHover:   'rgba(0,0,0,0.18)',
  text:      '#1a1a1a',
  textMuted: '#666',
  textDim:   '#aaa',
  accent:    '#2a2a2a',
  todayRing: 'rgba(220,100,20,0.55)',
  todayTint: '#fff6ec',
  // fonts
  mono: "'DM Mono','Consolas','Courier New',monospace",
  sans: "'DM Sans',system-ui,-apple-system,sans-serif",
};

// Label palette — matches frontend/constants.js COLOR_PRESETS
const LABELS = {
  Personal:   { bg:'#e8f0fa', border:'#b5cff0', text:'#1a4a8a' },
  Work:       { bg:'#fdf3dc', border:'#f5d98a', text:'#7a4800' },
  Finance:    { bg:'#fdecea', border:'#f5bdb8', text:'#8a2020' },
  Build:      { bg:'#eaf6ee', border:'#a8ddb8', text:'#1a5c30' },
  Chore:      { bg:'#fceaf4', border:'#e8b0d8', text:'#6a1a4a' },
  Interview:  { bg:'#eeecfb', border:'#cbc6f0', text:'#3c3489' },
  Health:     { bg:'#e0f5f5', border:'#90d0d0', text:'#1a5555' },
  Random:     { bg:'#f2f2f0', border:'#d8d8d4', text:'#444444' },
};

const DAYS = [
  { id:'mon', label:'Mon', date:'05/11', md:'May 11' },
  { id:'tue', label:'Tue', date:'05/12', md:'May 12' },
  { id:'wed', label:'Wed', date:'05/13', md:'May 13' },
  { id:'thu', label:'Thu', date:'05/14', md:'May 14', today:true },
  { id:'fri', label:'Fri', date:'05/15', md:'May 15' },
  { id:'sat', label:'Sat', date:'05/16', md:'May 16' },
  { id:'sun', label:'Sun', date:'05/17', md:'May 17' },
];

// Status flags: done | cancelled | important
const TASKS = {
  unscheduled: [
    { id:'u1', text:"Reply to Lara's proff", type:'Work' },
    { id:'u2', text:'Build Py ft for cash circ', type:'Health' },
    { id:'u3', text:'Taxes', type:'Build' },
    { id:'u4', text:'Reply to Vannevar', type:'Work' },
    { id:'u5', text:'GOOGLE SCHEDULE', type:'Work' },
    { id:'u6', text:'Think what to do with Antropic', type:'Work' },
  ],
  mon: [
    { id:'m1', text:'Headlands – 3pm', type:'Work', important:true },
    { id:'m2', text:'Schedule Vannever PS Tech', type:'Work', done:true },
  ],
  tue: [
    { id:'t1', text:'Uber Coding Screen – 1pm', type:'Interview', important:true, done:true },
    { id:'t2', text:'Bloomberg – BS Schedule', type:'Work' },
    { id:'t3', text:'Trading…', type:'Work', cancelled:true },
    { id:'t4', text:'BJJ', type:'Work', done:true },
    { id:'t5', text:'Todies', type:'Work' },
  ],
  wed: [
    { id:'w1', text:'Vannever Phone Screen: 2pm', type:'Work', done:true },
    { id:'w2', text:'Comms / recruitment', type:'Work' },
  ],
  thu: [
    { id:'th1', text:'ROMAN-IN', type:'Work', done:true },
    { id:'th2', text:'Call with someone – 12:30pm', type:'Work', done:true },
    { id:'th3', text:'Trading', type:'Work', done:true },
    { id:'th4', text:'TAXES!!!', type:'Finance' },
    { id:'th5', text:'Fix leaked secrets', type:'Build' },
    { id:'th6', text:'Investigate how to do car inspection', type:'Chore' },
    { id:'th7', text:'Try Claude Design to design mobile view of the Todoies', type:'Build' },
  ],
  fri: [
    { id:'f1', text:'Car inspection', type:'Chore' },
    { id:'f2', text:'TAXES', type:'Finance' },
    { id:'f3', text:'Bloomberg Prep Call – 1pm?', type:'Work', important:true },
    { id:'f4', text:'INSURANCE', type:'Chore' },
  ],
  sat: [
    { id:'s1', text:'Check when registration for F1 Vegas/Spain', type:'Random' },
  ],
  sun: [
    { id:'su1', text:'Behavioral Prep – Bloomberg', type:'Health', important:true },
  ],
};

Object.assign(window, { THEME, LABELS, DAYS, TASKS });
