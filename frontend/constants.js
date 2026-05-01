const DEFAULT_COLS = [
  {id:'mon', label:'Mon', date:'04/27'},
  {id:'tue', label:'Tue', date:''},
  {id:'wed', label:'Wed', date:''},
  {id:'thu', label:'Thu', date:''},
  {id:'fri', label:'Fri', date:''},
  {id:'sat', label:'Sat', date:''},
  {id:'sun', label:'Sun', date:''},
];

const DEFAULT_WEEK_UNSCHEDULED = [
  {id:'unscheduled', label:'Unscheduled'},
  {id:'unscheduled_w1', label:'Unscheduled'},
];

const INIT_TASKS = [
  {id:'t1',  text:'Task A',  type:'t-locked',    col:'mon', locked:true},
  {id:'t2',  text:'Task B',  type:'t-locked',    col:'wed', locked:true},
  {id:'t3',  text:'Task C',  type:'t-async',     col:'mon'},
  {id:'t4',  text:'Task D',  type:'t-async',     col:'tue'},
  {id:'t5',  text:'Task E',  type:'t-practice',  col:'wed'},
  {id:'t6',  text:'Task F',  type:'t-rest',      col:'thu'},
  {id:'t7',  text:'Task G',  type:'t-unplanned', col:'unscheduled'},
];

const DEFAULT_TYPE_CONFIG = {
  't-locked':    { label:'locked',    bg:'#e8f0fa', border:'#b5cff0', text:'#1a4a8a' },
  't-interview': { label:'interview', bg:'#eeecfb', border:'#cbc6f0', text:'#3c3489' },
  't-tax':       { label:'taxes',     bg:'#fdf3dc', border:'#f5d98a', text:'#7a4800' },
  't-practice':  { label:'practice',  bg:'#eaf6ee', border:'#a8ddb8', text:'#1a5c30' },
  't-async':     { label:'async',     bg:'#f0f0f8', border:'#c8c8e0', text:'#444466' },
  't-rest':      { label:'rest',      bg:'#fdecea', border:'#f5bdb8', text:'#8a2020' },
  't-unplanned': { label:'unplanned', bg:'#f2f0f8', border:'#c4bedd', text:'#665880', dashed:true, italic:true },
  'done':        { label:'done',      bg:'#f0f5f0', border:'#c4d8c4', text:'#8aaa8a' },
};

const DEFAULT_LEGEND_ORDER = ['t-locked','t-interview','t-tax','t-practice','t-async','t-rest','t-unplanned','done'];

const COLOR_PRESETS = [
  { bg:'#e8f0fa', border:'#b5cff0', text:'#1a4a8a' },
  { bg:'#eeecfb', border:'#cbc6f0', text:'#3c3489' },
  { bg:'#fdf3dc', border:'#f5d98a', text:'#7a4800' },
  { bg:'#eaf6ee', border:'#a8ddb8', text:'#1a5c30' },
  { bg:'#f0f0f8', border:'#c8c8e0', text:'#444466' },
  { bg:'#fdecea', border:'#f5bdb8', text:'#8a2020' },
  { bg:'#e0f5f5', border:'#90d0d0', text:'#1a5555' },
  { bg:'#fef0e6', border:'#f5c895', text:'#7a3000' },
  { bg:'#fceaf4', border:'#e8b0d8', text:'#6a1a4a' },
  { bg:'#f4f4f2', border:'#c4c4be', text:'#888888' },
];

const UI_SCALES = [0.75, 0.875, 1, 1.125, 1.25];
