import type { Voice } from '../server/voice-catalog.ts';
import { litBars } from './audio-level.ts';
import { byId, ContentKey, setClass, setDisabled, setHidden, setText, writeText } from './dom.ts';
import { qualityOf } from './labels.ts';
import { parseScript } from './question-run.ts';
import { parseParagraphs } from './reading-run.ts';
import { ScriptEditor, type ScriptEditorIds, type ScriptFormat } from './script-editor.ts';
import { SettingsForm } from './settings-form.ts';
import type { Settings } from './settings-store.ts';
import {
  SESSION_ROWS,
  type ConnectionTone,
  type SessionRow,
  type ViewState,
} from './view-state.ts';

const METER_BARS = 12;
const PERCENT = 100;

const SCRIPT_EDITOR: ScriptEditorIds = {
  list: 'questionList',
  editor: 'scriptEditor',
  text: 'scriptText',
  edit: 'editScriptButton',
  save: 'saveScriptButton',
  cancel: 'cancelScriptButton',
  reset: 'defaultScriptButton',
};
const READING_EDITOR: ScriptEditorIds = {
  list: 'paragraphList',
  editor: 'readingEditor',
  text: 'readingScript',
  edit: 'editReadingButton',
  save: 'saveReadingButton',
  cancel: 'cancelReadingButton',
  reset: 'defaultReadingButton',
};
const ONE_PER_LINE: ScriptFormat = { parse: parseScript, separator: '\n' };
const BLANK_LINE_BETWEEN: ScriptFormat = { parse: parseParagraphs, separator: '\n\n' };

const CONNECTION_CHIP: Record<ConnectionTone, string> = {
  idle: 'chip',
  live: 'chip chip-live',
  paused: 'chip chip-paused',
};

export interface ViewActions {
  toggleJoin(): void;
  join(): void;
  ask(): void;
  previous(): void;
  next(): void;
  select(index: number): void;
  read(): void;
  toggleRecording(): void;
  hear(on: boolean): void;
  settingsEdited(): void;
  saveScript(text: string): void;
  saveReading(text: string): void;
  downloadCsv(): void;
  reset(): void;
}

const code = (text: string) => Object.assign(document.createElement('code'), { textContent: text });
const span = (className: string, text: string) =>
  Object.assign(document.createElement('span'), { className, textContent: text });
const chip = (text: string) => span('chip', text);

export interface DefaultTexts {
  script: string;
  reading: string;
}

export class InterviewerView {
  readonly speech = byId<HTMLAudioElement>('speech');
  readonly videoHost = byId('video');
  readonly #settingsForm: SettingsForm;
  readonly #meterBars = Array.from({ length: METER_BARS }, () => document.createElement('i'));
  readonly #sessionCells: Record<SessionRow, HTMLTableCellElement>;
  readonly #scriptEditor: ScriptEditor;
  readonly #readingEditor: ScriptEditor;
  readonly #emptyContent = new ContentKey();
  readonly #listContent = new ContentKey();
  readonly #paragraphContent = new ContentKey();

  constructor(actions: ViewActions, voices: readonly Voice[], defaults: DefaultTexts) {
    byId('meterBars').replaceChildren(...this.#meterBars);
    this.#sessionCells = this.#buildSessionTable();
    this.#settingsForm = new SettingsForm(byId('settingsForm'), voices, () =>
      actions.settingsEdited(),
    );
    this.#scriptEditor = new ScriptEditor(SCRIPT_EDITOR, ONE_PER_LINE, defaults.script, (text) =>
      actions.saveScript(text),
    );
    this.#readingEditor = new ScriptEditor(
      READING_EDITOR,
      BLANK_LINE_BETWEEN,
      defaults.reading,
      (text) => actions.saveReading(text),
    );
    this.#bind(actions);
  }

  log(line: string): void {
    byId('log').textContent += `${line}\n`;
    byId('panel-log').scrollTop = byId('panel-log').scrollHeight;
  }

  fillSettings(settings: Settings): void {
    this.#settingsForm.fill(settings);
    byId<HTMLInputElement>('hearToggle').checked = settings.hearPhone;
  }

  readSettings(current: Settings): Settings {
    return this.#settingsForm.read(current);
  }

  render(state: ViewState): void {
    this.#renderHeader(state);
    this.#renderStage(state);
    this.#renderMode(state);
    this.#renderPrompter(state);
    this.#renderQuestions(state);
    this.#renderReading(state);
    this.#renderSessionPanel(state);
  }

  #renderHeader(state: ViewState): void {
    setText('roomName', state.room);
    setText('identityName', state.identity);
    setClass('connChip', CONNECTION_CHIP[state.connection.tone]);
    setText('connText', state.connection.text);
    setText('joinButton', state.inRoom ? 'Leave' : 'Join');
    setDisabled('joinButton', state.joining);
    setDisabled('stageJoinButton', state.joining);
    setDisabled('resetButton', state.inRoom);
  }

  #renderStage(state: ViewState): void {
    const { phone } = state;
    const waiting = !phone.video && !phone.pause;
    byId('stage').classList.toggle('is-empty', waiting);
    setHidden('emptyState', !waiting);
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
    const lit = litBars(phone.levelDb, METER_BARS);
    this.#meterBars.forEach((bar, index) => bar.classList.toggle('lit', index < lit));
    setText('meterDb', `${phone.levelDb} dB`);
    setHidden('recChip', state.recording.clock === undefined);
    setText('recTime', state.recording.clock ?? '');
    setHidden('pausedOverlay', !phone.pause);
    setText('pausedTitle', phone.pause?.title ?? '');
    setText('pausedMeta', phone.pause?.meta ?? '');
  }

  #renderEmptyText({ inRoom, room, phone, autoStartChips }: ViewState): void {
    if (!this.#emptyContent.changed([inRoom, room, phone.name, autoStartChips])) return;
    byId('emptyText').replaceChildren(
      ...(inRoom
        ? [
            'Press Start recording in MyDirector on the iPhone. It joins this room as ',
            code(phone.name),
            '.',
          ]
        : ['Join room ', code(room), ' to see the phone, ask the questions and record the call.']),
    );
    byId('emptyChips').replaceChildren(...(inRoom ? autoStartChips.map(chip) : []));
  }

  #renderMode({ mode }: ViewState): void {
    const reading = mode === 'reading';
    setHidden('questionPrompter', reading);
    setHidden('questionsPane', reading);
    setHidden('readingPrompter', !reading);
    setHidden('readingPane', !reading);
    setText('scriptTab', reading ? 'Text' : 'Questions');
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

  /** Rebuilt only when the script, the current question or the marks change, so a click is never lost. */
  #renderQuestions({ questions }: ViewState): void {
    this.#scriptEditor.items = questions.list;
    if (!this.#listContent.changed([questions.list, questions.current, [...questions.asked]]))
      return;
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

  #renderReading({ reading }: ViewState): void {
    setText('readingLabel', reading.label);
    setText('readingState', reading.state);
    setText('readingClock', reading.clock);
    setText('readingText', reading.text);
    byId('readingProgress').style.width = `${reading.progress * PERCENT}%`;
    setText('readLabel', reading.startLabel);
    setDisabled('readButton', !reading.canStart);
    setText('readingVoiceLabel', reading.voice);
    setText('readingSummary', reading.label);
    this.#readingEditor.items = reading.paragraphs;
    if (!this.#paragraphContent.changed([reading.paragraphs, reading.current])) return;
    byId('paragraphList').replaceChildren(
      ...reading.paragraphs.map((text, index) => {
        const item = document.createElement('li');
        item.classList.toggle('is-current', index === reading.current);
        item.append(span('mark', String(index + 1)), span('line', text));
        return item;
      }),
    );
  }

  #renderSessionPanel({ recording, session, canDownloadCsv }: ViewState): void {
    for (const [row, value] of Object.entries(session))
      writeText(this.#sessionCells[row as SessionRow], value);
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
    byId('readButton').onclick = () => actions.read();
    byId('recordButton').onclick = () => actions.toggleRecording();
    byId<HTMLInputElement>('hearToggle').onchange = (event) =>
      actions.hear((event.target as HTMLInputElement).checked);
    byId('csvButton').onclick = () => actions.downloadCsv();
    byId('resetButton').onclick = () => actions.reset();

    byId('settingsButton').onclick = () => this.#showSettings(true);
    byId('closeSettingsButton').onclick = () => this.#showSettings(false);
    byId('settingsBackdrop').onclick = () => this.#showSettings(false);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.#showSettings(false);
    });

    for (const tab of document.querySelectorAll<HTMLElement>('[data-tab]')) {
      tab.onclick = () => this.#showTab(tab);
    }
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
}
