const UndoHistory = (() => {
  const MAX = 10;
  const stack = [];

  function snapshot() {
    return {
      cols:           structuredClone(cols),
      weekUnscheduled:structuredClone(weekUnscheduled),
      state:          structuredClone(state),
      idCounter, colCounter, typeCounter,
      typeConfig:     structuredClone(typeConfig),
      legendOrder:    [...legendOrder],
    };
  }

  function push() {
    stack.push(snapshot());
    if (stack.length > MAX) stack.shift();
  }

  function pop() {
    if (stack.length === 0) return false;
    const s = stack.pop();
    cols            = s.cols;
    weekUnscheduled = s.weekUnscheduled;
    state           = s.state;
    idCounter       = s.idCounter;
    colCounter      = s.colCounter;
    typeCounter     = s.typeCounter;
    typeConfig      = s.typeConfig;
    legendOrder     = s.legendOrder;
    return true;
  }

  return { push, pop };
})();
