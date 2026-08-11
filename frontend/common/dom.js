// dom.js — the one DOM helper both renderers and the shared widgets use.
//
// Every view builds its DOM by hand, and the three-line create/class/text trio
// was repeated ~170 times. mkEl replaces exactly that trio, assignment for
// assignment: the class is always set, and textContent is set whenever a third
// argument is passed — even one whose value is undefined — so it behaves
// identically to writing the assignments out.
//
// Anything else about the element (style, dataset, handlers, attributes) is
// still set on the returned node by the caller; this helper stays a shorthand,
// not a component layer.
function mkEl(tag, className, ...text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text.length) node.textContent = text[0];
  return node;
}
