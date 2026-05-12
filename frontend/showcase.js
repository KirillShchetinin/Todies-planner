function loadShowcase() {
  const today = new Date();
  const dow = today.getDay();
  const mon = new Date(today);
  mon.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));

  const fmt = d => `${String(d.getMonth() + 1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;

  const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const ids    = [901, 902, 903, 904, 905, 906, 907];

  cols = labels.map((label, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return { id: ids[i], label, date: fmt(d) };
  });

  weekUnscheduled = [{ id: 900, label: 'Unscheduled' }];

  typeConfig = {
    ...DEFAULT_TYPE_CONFIG,
    't-work':     { label: 'Work',     bg: '#e8f0fa', border: '#b5cff0', text: '#1a4a8a' },
    't-personal': { label: 'Personal', bg: '#eaf6ee', border: '#a8ddb8', text: '#1a5c30' },
    't-errand':   { label: 'Errand',   bg: '#fdf3dc', border: '#f5d98a', text: '#7a4800' },
  };

  legendOrder = ['Random', 't-work', 't-personal', 't-errand'];

  const [monId, tueId, wedId, thuId, friId, satId, sunId] = ids;

  state = {
    [monId]: [
      { id: 9001, text: 'Team standup',        type: 't-work' },
      { id: 9002, text: 'Buy groceries',        type: 't-errand' },
      { id: 9003, text: 'Review pull requests', type: 't-work', done: true },
    ],
    [tueId]: [
      { id: 9004, text: 'Write weekly report', type: 't-work' },
      { id: 9005, text: 'Gym',                 type: 't-personal' },
    ],
    [wedId]: [
      { id: 9006, text: 'Team standup',   type: 't-work' },
      { id: 9007, text: 'Call dentist',   type: 't-errand' },
      { id: 9008, text: 'Lunch with Alex',type: 't-personal' },
    ],
    [thuId]: [
      { id: 9009, text: 'Code review session', type: 't-work' },
      { id: 9010, text: 'Pay utility bills',   type: 't-errand' },
    ],
    [friId]: [
      { id: 9011, text: 'Team standup',  type: 't-work' },
      { id: 9012, text: 'Plan next week',type: 't-work' },
      { id: 9013, text: 'Gym',           type: 't-personal' },
    ],
    [satId]: [
      { id: 9014, text: 'Farmers market', type: 't-errand' },
      { id: 9015, text: 'Read a book',    type: 't-personal' },
    ],
    [sunId]: [
      { id: 9016, text: 'Meal prep', type: 't-personal' },
      { id: 9017, text: 'Laundry',   type: 't-errand', done: true },
    ],
    900: [
      { id: 9018, text: 'Fix bike',      type: 't-errand' },
      { id: 9019, text: 'Renew passport',type: 't-personal' },
    ],
  };

  render();
}
