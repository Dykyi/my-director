export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`#${id} is missing from index.html`);
  return element as T;
}

// Writes only what changed, so a selection or a hover survives the tick.
export function writeText(element: HTMLElement, value: string): void {
  if (element.textContent !== value) element.textContent = value;
}

export const setText = (id: string, value: string): void => writeText(byId(id), value);

export function setHidden(id: string, hidden: boolean): void {
  const element = byId(id);
  if (element.hidden !== hidden) element.hidden = hidden;
}

export function setDisabled(id: string, disabled: boolean): void {
  const button = byId<HTMLButtonElement>(id);
  if (button.disabled !== disabled) button.disabled = disabled;
}

export function setClass(id: string, className: string): void {
  const element = byId(id);
  if (element.className !== className) element.className = className;
}

export class ContentKey {
  #last = '';

  changed(content: unknown): boolean {
    const key = JSON.stringify(content);
    if (key === this.#last) return false;
    this.#last = key;
    return true;
  }
}
