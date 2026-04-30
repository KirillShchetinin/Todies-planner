const DEFAULT_COLS = [
  {id:'mon',    label:'Mon',       date:'04/20'},
  {id:'tue',    label:'Tue',       date:'04/21'},
  {id:'wed',    label:'Wed',       date:'04/22'},
  {id:'thu',    label:'Thu',       date:'04/23'},
  {id:'fri',    label:'Fri',       date:'04/24'},
  {id:'sat',    label:'Sat',       date:'04/25'},
  {id:'sun',    label:'Sun',       date:'04/26'},
  {id:'nxtwed', label:'Next Wed+', date:'04/29+'},
];

const DEFAULT_WEEK_UNSCHEDULED = [
  {id:'unscheduled', label:'Unscheduled'},
  {id:'unscheduled_w1', label:'Unscheduled'},
];

const INIT_TASKS = [
  {id:'t1',  text:'Team standup 10am',         type:'t-locked',    col:'mon',         locked:true},
  {id:'t2',  text:'1:1 with manager 3pm',      type:'t-locked',    col:'wed',         locked:true},
  {id:'t3',  text:'Sprint planning 2pm',       type:'t-locked',    col:'mon',         locked:true},
  {id:'t4',  text:'Weekly review 5pm',         type:'t-locked',    col:'fri',         locked:true},
  {id:'t5',  text:'Reply to emails',           type:'t-async',     col:'mon'},
  {id:'t6',  text:'Update project docs',       type:'t-async',     col:'tue'},
  {id:'t7',  text:'Review pull requests',      type:'t-async',     col:'wed'},
  {id:'t8',  text:'Send weekly report',        type:'t-async',     col:'fri'},
  {id:'t9',  text:'Read industry articles',    type:'t-practice',  col:'tue'},
  {id:'t10', text:'Work on side project',      type:'t-practice',  col:'thu'},
  {id:'t11', text:'Learn new tool / framework',type:'t-practice',  col:'sat'},
  {id:'t12', text:'File expense report',       type:'t-tax',       col:'thu'},
  {id:'t13', text:'Grocery shopping',          type:'t-async',     col:'unscheduled'},
  {id:'t14', text:'Gym',                       type:'t-rest',      col:'tue'},
  {id:'t15', text:'Gym',                       type:'t-rest',      col:'thu'},
  {id:'t16', text:'Catch up with a friend',    type:'t-rest',      col:'sat'},
  {id:'t17', text:'Plan next week',            type:'t-practice',  col:'sun'},
  {id:'t18', text:'Deep work block',           type:'t-unplanned', col:'unscheduled'},
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
