import type { Voice } from '../server/voice-catalog.ts';
import { qualityOf } from './labels.ts';
import { parseScript } from './question-run.ts';
import {
  clampQuietSec,
  MAX_QUIET_SEC,
  MIN_QUIET_SEC,
  type Asker,
  type Settings,
} from './settings-store.ts';

const METER_BARS = 12;
const METER_FLOOR_DB = -60;
const PERCENT = 100;

export const SESSION_ROWS = {
  phone: 'Phone',
  inRoom: 'Phone in the room',
  picture: 'Picture',
  freezes: 'Freezes',
  lost: 'Packets lost, video / audio',
  pauses: 'Pauses',
  asked: 'Questions asked',
  recording: 'Recording',
  rows: 'Stats rows',
} as const;
export type SessionRow = keyof typeof SESSION_ROWS;

export type ChipLook = '' | 'chip-live' | 'chip-paused';

export interface ViewState {
  room: string;
  identity: string;
  connection: { text: string; look: ChipLook };
  inRoom: boolean;
  joining: boolean;
  onJoin: readonly string[];
  phone: {
    name: string;
    video: boolean;
    audio: boolean;
    quality: string;
    levelDb: number;
    pause: { title: string; meta: string } | undefined;
  };
  statsLine: string | undefined;
  prompter: {
    label: string;
    text: string;
    state: string;
    quiet: string;
    progress: number;
    askLabel: string;
    canAsk: boolean;
    canPrevious: boolean;
    canNext: boolean;
    voice: string;
  };
  questions: { list: readonly string[]; current: number; asked: ReadonlySet<number> };
  recording: { clock: string | undefined; label: string; enabled: boolean };
  session: Record<SessionRow, string>;
  canDownloadCsv: boolean;
}

export interface ViewActions {
  toggleJoin(): void;
  join(): void;
  ask(): void;
  previous(): void;
  next(): void;
  select(index: number): void;
  toggleRecording(): void;
  hear(on: boolean): void;
  settingsEdited(): void;
  saveScript(text: string): void;
  downloadCsv(): void;
  reset(): void;
}

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`#${id} is missing from index.html`);
  return element as T;
}

function setText(id: string, value: string): void {
  const element = byId(id);
  if (element.textContent !== value) element.textContent = value;
}

function setHidden(id: string, hidden: boolean): void {
  const element = byId(id);
  if (element.hidden !== hidden) element.hidden = hidden;
}

function setDisabled(id: string, disabled: boolean): void {
  const button = byId<HTMLButtonElement>(id);
  if (button.disabled !== disabled) button.disabled = disabled;
}

function setClass(id: string, className: string): void {
  const element = byId(id);
  if (element.className !== className) element.className = className;
}

const code = (text: string) => Object.assign(document.createElement('code'), { textContent: text });
const chip = (text: string) =>
  Object.assign(document.createElement('span'), { className: 'chip', textContent: text });

export class InterviewerView {
  readonly speech = byId<HTMLAudioElement>('speech');
  readonly videoHost = byId('video');
  readonly #form = byId<HTMLFormElement>('settingsForm');
  readonly #meterBars = Array.from({ length: METER_BARS }, () => document.createElement('i'));
  readonly #sessionCells: Record<SessionRow, HTMLTableCellElement>;
  readonly #defaultScript: string;
  #questions: readonly string[] = [];
  #emptyKey = '';
  #listKey = '';

  constructor(actions: ViewActions, voices: readonly Voice[], defaultScript: string) {
    this.#defaultScript = defaultScript;
    byId('meterBars').replaceChildren(...this.#meterBars);
    this.#sessionCells = this.#buildSessionTable();
    this.#select('voice').replaceChildren(
      ...voices.map(({ name, locale }) => new Option(`${name} · ${locale}`, name)),
    );
    Object.assign(this.#input('quietSec'), {
      min: String(MIN_QUIET_SEC),
      max: String(MAX_QUIET_SEC),
    });
    this.#bind(actions);
  }

  log(line: string): void {
    byId('log').textContent += `${line}\n`;
    byId('panel-log').scrollTop = byId('panel-log').scrollHeight;
  }

  fillSettings(settings: Settings): void {
    for (const name of ['room', 'identity', 'phone'] as const)
      this.#input(name).value = settings[name];
    this.#input('quietSec').value = String(settings.quietSec);
    this.#select('voice').value = settings.voice;
    this.#radio(settings.asker).checked = true;
    for (const name of [
      'startOnJoin',
      'loop',
      'recordOnJoin',
      'statsCsv',
      'statsOverlay',
    ] as const) {
      this.#input(name).checked = settings[name];
    }
    byId<HTMLInputElement>('hearToggle').checked = settings.hearPhone;
  }

  readSettings(current: Settings): Settings {
    const text = (name: 'room' | 'identity' | 'phone') =>
      this.#input(name).value.trim() || current[name];
    const checked = (name: string) => this.#input(name).checked;
    const asker: Asker = this.#radio('microphone').checked ? 'microphone' : 'voice';
    return {
      ...current,
      room: text('room'),
      identity: text('identity'),
      phone: text('phone'),
      asker,
      voice: this.#select('voice').value,
      quietSec: clampQuietSec(Number(this.#input('quietSec').value), current.quietSec),
      startOnJoin: checked('startOnJoin'),
      loop: checked('loop'),
      recordOnJoin: checked('recordOnJoin'),
      statsCsv: checked('statsCsv'),
      statsOverlay: checked('statsOverlay'),
    };
  }

  render(state: ViewState): void {
    this.#renderHeader(state);
    this.#renderStage(state);
    this.#renderPrompter(state);
    this.#renderQuestions(state);
    this.#renderSide(state);
  }

  #renderHeader(state: ViewState): void {
    setText('roomName', state.room);
    setText('identityName', state.identity);
    setClass('connChip', `chip ${state.connection.look}`.trim());
    setText('connText', state.connection.text);
    setText('joinButton', state.inRoom ? 'Leave' : 'Join');
    setDisabled('joinButton', state.joining);
    setDisabled('stageJoinButton', state.joining);
    setDisabled('resetButton', state.inRoom);
  }

  #renderStage(state: ViewState): void {
    const { phone } = state;
    byId('stage').classList.toggle('is-empty', !phone.video);
    setHidden('emptyState', phone.video);
    setHidden('video', !phone.video);
    setHidden('stageJoinButton', state.inRoom);
    setText('emptyTitle', state.inRoom ? 'Waiting for the phone' : 'Not in the room yet');
    this.#renderEmptyText(state);

    const quality = qualityOf(phone.quality);
    setHidden('phoneBadge', !phone.video);
    setText('phoneName', phone.name);
    setClass('qualityBars', `bars quality-${phone.quality}`);
    byId('qualityBars')
      .querySelectorAll('i')
      .forEach((bar, index) => bar.classList.toggle('lit', index < quality.bars));
    setClass('qualityText', `quality-text quality-${phone.quality}`);
    setText('qualityText', quality.label);

    setHidden('statsLine', !phone.video || state.statsLine === undefined);
    setText('statsLine', state.statsLine ?? '');
    setHidden('micMeter', !phone.audio);
    const lit = Math.round(((phone.levelDb - METER_FLOOR_DB) / -METER_FLOOR_DB) * METER_BARS);
    this.#meterBars.forEach((bar, index) => bar.classList.toggle('lit', index < lit));
    setText('meterDb', `${phone.levelDb} dB`);
    setHidden('recChip', state.recording.clock === undefined);
    setText('recTime', state.recording.clock ?? '');
    setHidden('pausedOverlay', !phone.pause);
    setText('pausedTitle', phone.pause?.title ?? '');
    setText('pausedMeta', phone.pause?.meta ?? '');
  }

  #renderEmptyText(state: ViewState): void {
    const key = JSON.stringify([state.inRoom, state.room, state.phone.name, state.onJoin]);
    if (key === this.#emptyKey) return;
    this.#emptyKey = key;
    byId('emptyText').replaceChildren(
      ...(state.inRoom
        ? [
            'Press Start recording in MyDirector on the iPhone. It joins this room as ',
            code(state.phone.name),
            '.',
          ]
        : [
            'Join room ',
            code(state.room),
            ' to see the phone, ask the questions and record the call.',
          ]),
    );
    byId('emptyChips').replaceChildren(...(state.inRoom ? state.onJoin.map(chip) : []));
  }

  #renderPrompter({ prompter }: ViewState): void {
    setText('questionLabel', prompter.label);
    setText('questionText', prompter.text);
    setText('questionState', prompter.state);
    setText('quietLabel', prompter.quiet);
    byId('questionProgress').style.width = `${prompter.progress * PERCENT}%`;
    setText('askLabel', prompter.askLabel);
    setDisabled('askButton', !prompter.canAsk);
    setDisabled('prevButton', !prompter.canPrevious);
    setDisabled('nextButton', !prompter.canNext);
    setText('voiceLabel', prompter.voice);
  }

  #renderQuestions({ questions }: ViewState): void {
    this.#questions = questions.list;
    const key = JSON.stringify([questions.list, questions.current, [...questions.asked]]);
    if (key === this.#listKey) return;
    this.#listKey = key;
    setText('questionsSummary', `${questions.asked.size} of ${questions.list.length} asked`);
    byId('questionList').replaceChildren(
      ...questions.list.map((text, index) => {
        const asked = questions.asked.has(index);
        const item = document.createElement('li');
        item.classList.toggle('is-current', index === questions.current);
        item.classList.toggle('is-asked', asked && index !== questions.current);
        const mark = Object.assign(document.createElement('span'), {
          className: 'mark',
          textContent: asked ? '✓' : String(index + 1),
        });
        item.append(mark, text);
        item.dataset.index = String(index);
        return item;
      }),
    );
  }

  #renderSide({ recording, session, canDownloadCsv }: ViewState): void {
    for (const [row, value] of Object.entries(session)) {
      const cell = this.#sessionCells[row as SessionRow];
      if (cell.textContent !== value) cell.textContent = value;
    }
    setDisabled('csvButton', !canDownloadCsv);
    setText('recordButton', recording.label);
    setDisabled('recordButton', !recording.enabled);
    byId('recordButton').classList.toggle(
      'button-record',
      recording.clock === undefined && recording.enabled,
    );
  }

  #bind(actions: ViewActions): void {
    byId('joinButton').onclick = () => actions.toggleJoin();
    byId('stageJoinButton').onclick = () => actions.join();
    byId('askButton').onclick = () => actions.ask();
    byId('prevButton').onclick = () => actions.previous();
    byId('nextButton').onclick = () => actions.next();
    byId('questionList').onclick = (event) => {
      const index = (event.target as HTMLElement).closest('li')?.dataset.index;
      if (index !== undefined) actions.select(Number(index));
    };
    byId('recordButton').onclick = () => actions.toggleRecording();
    byId<HTMLInputElement>('hearToggle').onchange = (event) =>
      actions.hear((event.target as HTMLInputElement).checked);
    byId('csvButton').onclick = () => actions.downloadCsv();
    byId('resetButton').onclick = () => actions.reset();

    this.#form.onsubmit = (event) => event.preventDefault();
    this.#form.onchange = () => actions.settingsEdited();
    byId('settingsButton').onclick = () => this.#showSettings(true);
    byId('closeSettingsButton').onclick = () => this.#showSettings(false);
    byId('settingsBackdrop').onclick = () => this.#showSettings(false);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.#showSettings(false);
    });

    for (const tab of document.querySelectorAll<HTMLElement>('[data-tab]')) {
      tab.onclick = () => this.#showTab(tab);
    }

    const scriptText = byId<HTMLTextAreaElement>('scriptText');
    byId('editScriptButton').onclick = () => this.#editScript(true);
    byId('cancelScriptButton').onclick = () => this.#editScript(false);
    byId('defaultScriptButton').onclick = () => {
      scriptText.value = this.#defaultScript.trim();
      setDisabled('saveScriptButton', false);
    };
    scriptText.oninput = () =>
      setDisabled('saveScriptButton', parseScript(scriptText.value).length === 0);
    byId('saveScriptButton').onclick = () => {
      actions.saveScript(scriptText.value);
      this.#editScript(false);
    };
  }

  #buildSessionTable(): Record<SessionRow, HTMLTableCellElement> {
    const table = byId<HTMLTableSectionElement>('statsTable');
    const cells = Object.entries(SESSION_ROWS).map(([row, label]) => {
      const line = table.insertRow();
      line.insertCell().textContent = label;
      return [row, line.insertCell()];
    });
    return Object.fromEntries(cells);
  }

  #showSettings(open: boolean): void {
    setHidden('settingsBackdrop', !open);
    setHidden('settingsPanel', !open);
  }

  #showTab(selected: HTMLElement): void {
    for (const tab of document.querySelectorAll<HTMLElement>('[data-tab]')) {
      tab.setAttribute('aria-selected', String(tab === selected));
      setHidden(`panel-${tab.dataset.tab}`, tab !== selected);
    }
  }

  #editScript(open: boolean): void {
    setHidden('scriptEditor', !open);
    setHidden('questionList', open);
    setHidden('editScriptButton', open);
    if (open) byId<HTMLTextAreaElement>('scriptText').value = this.#questions.join('\n');
    setDisabled('saveScriptButton', false);
  }

  #field<T extends Element>(selector: string): T {
    const field = this.#form.querySelector<T>(selector);
    if (!field) throw new Error(`${selector} is missing from the settings form`);
    return field;
  }

  #input(name: string): HTMLInputElement {
    return this.#field(`input[name="${name}"]`);
  }

  #radio(asker: Asker): HTMLInputElement {
    return this.#field(`input[name="asker"][value="${asker}"]`);
  }

  #select(name: string): HTMLSelectElement {
    return this.#field(`select[name="${name}"]`);
  }
}
