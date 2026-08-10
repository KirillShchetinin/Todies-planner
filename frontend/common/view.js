// view.js — which renderer owns the screen.
//
// Desktop and mobile are two independent renderers over one model. This module
// is the only place that knows which of them is active: each layer registers
// itself once at load, and render() — the single exit point of every mutation —
// dispatches to whichever view the viewport currently selects.
//
// Common code must never name a renderer directly. Anything a view alone can
// answer (its scroll container, its teardown) belongs in its registration.

// name → { render, teardown?, scrollEl? }
const _views = {};

function registerView(name, api) { _views[name] = api; }

function isMobileView()   { return document.body.dataset.view === 'mobile'; }
function currentViewName(){ return isMobileView() ? 'mobile' : 'desktop'; }
function activeView()     { return _views[currentViewName()] || {}; }

// The element that actually scrolls vertically: the document on desktop,
// #board on mobile. Callers that must preserve scroll position ask here.
function viewScrollEl() { return activeView().scrollEl ? activeView().scrollEl() : null; }

// The view whose DOM is currently on screen, so a switch can tear the old one
// down exactly once instead of on every render.
let _renderedView = null;

function render() {
  const name = currentViewName();
  if (_renderedView && _renderedView !== name) {
    const prev = _views[_renderedView];
    if (prev && prev.teardown) prev.teardown();
  }
  _renderedView = name;
  const view = activeView();
  if (view.render) view.render();
}

const _mobileMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

function _applyViewClass(matches) {
  document.body.dataset.view = matches ? 'mobile' : 'desktop';
}

_mobileMq.addEventListener('change', e => {
  _applyViewClass(e.matches);
  applyScale(currentScale());   // each view keeps its own scale
  render();
});

// Set before the first render so mobile.css's body[data-view] rules are in
// effect for the very first paint.
_applyViewClass(_mobileMq.matches);
