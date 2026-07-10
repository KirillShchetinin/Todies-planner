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
  {id:'t1', text:'Task A', type:'Random', col:'mon'},
  {id:'t2', text:'Task B', type:'Random', col:'wed'},
];

const DEFAULT_TYPE_CONFIG = {
  'Random': { label:'Random', bg:'#f2f2f0', border:'#d8d8d4', text:'#444444' },
};

const DEFAULT_LEGEND_ORDER = ['Random'];

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
  { bg:'#dbe4f5', border:'#7fa0d8', text:'#0d2f66' },
  { bg:'#ffe0e0', border:'#ff8080', text:'#cc0000' },
  { bg:'#000000', border:'#000000', text:'#ffffff' },
];

const UI_SCALES = [0.75, 0.875, 1, 1.125, 1.25];
