// Minimal stand-ins for browser APIs jsdom does not implement. They only let components
// mount; layout and modality are checked in real-browser QA, not here.

class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

export function installDomShims(): void {
  window.ResizeObserver ??= NoopResizeObserver;
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView ??= function scrollIntoView() {};
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.show ??= function show(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}
