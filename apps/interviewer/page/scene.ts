/** Shows the scene on the whole screen for the phone's camera; Esc leaves it and hides it again. */
export function openScene(element: HTMLElement): void {
  const hide = () => {
    element.hidden = true;
  };
  element.hidden = false;
  element.onfullscreenchange = () => {
    if (!document.fullscreenElement) hide();
  };
  element.requestFullscreen().catch(hide);
}
