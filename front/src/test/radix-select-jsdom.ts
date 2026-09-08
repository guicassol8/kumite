// jsdom has no pointer-capture support, but Radix's Select relies on it during
// open/select interactions. These are the smallest shims that let a REAL
// Radix Select be driven under vitest — nothing here fakes Radix itself.

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {}
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {}
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
