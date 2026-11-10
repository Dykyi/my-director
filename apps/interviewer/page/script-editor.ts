import { byId, setDisabled, setHidden } from './dom.ts';
import { parseScript } from './question-run.ts';

export class ScriptEditor {
  questions: readonly string[] = [];
  readonly #text = byId<HTMLTextAreaElement>('scriptText');

  constructor(defaultScript: string, save: (text: string) => void) {
    byId('editScriptButton').onclick = () => this.#show(true);
    byId('cancelScriptButton').onclick = () => this.#show(false);
    byId('defaultScriptButton').onclick = () => {
      this.#text.value = defaultScript.trim();
      setDisabled('saveScriptButton', false);
    };
    this.#text.oninput = () =>
      setDisabled('saveScriptButton', parseScript(this.#text.value).length === 0);
    byId('saveScriptButton').onclick = () => {
      save(this.#text.value);
      this.#show(false);
    };
  }

  #show(open: boolean): void {
    setHidden('scriptEditor', !open);
    setHidden('questionList', open);
    setHidden('editScriptButton', open);
    if (open) this.#text.value = this.questions.join('\n');
    setDisabled('saveScriptButton', false);
  }
}
