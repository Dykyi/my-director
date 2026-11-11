import { byId, setDisabled, setHidden } from './dom.ts';

export interface ScriptEditorIds {
  list: string;
  editor: string;
  text: string;
  edit: string;
  save: string;
  cancel: string;
  reset: string;
}

export interface ScriptFormat {
  parse(text: string): string[];
  separator: string;
}

export class ScriptEditor {
  items: readonly string[] = [];
  readonly #ids: ScriptEditorIds;
  readonly #format: ScriptFormat;
  readonly #text: HTMLTextAreaElement;

  constructor(
    ids: ScriptEditorIds,
    format: ScriptFormat,
    defaultText: string,
    save: (text: string) => void,
  ) {
    this.#ids = ids;
    this.#format = format;
    this.#text = byId<HTMLTextAreaElement>(ids.text);
    byId(ids.edit).onclick = () => this.#show(true);
    byId(ids.cancel).onclick = () => this.#show(false);
    byId(ids.reset).onclick = () => {
      this.#text.value = defaultText.trim();
      setDisabled(ids.save, false);
    };
    this.#text.oninput = () => setDisabled(ids.save, format.parse(this.#text.value).length === 0);
    byId(ids.save).onclick = () => {
      save(this.#text.value);
      this.#show(false);
    };
  }

  #show(open: boolean): void {
    const ids = this.#ids;
    setHidden(ids.editor, !open);
    setHidden(ids.list, open);
    setHidden(ids.edit, open);
    if (open) this.#text.value = this.items.join(this.#format.separator);
    setDisabled(ids.save, false);
  }
}
