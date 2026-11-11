import type { Voice } from '../server/voice-catalog.ts';
import {
  clampQuietSec,
  clampReadingMinutes,
  MAX_QUIET_SEC,
  MAX_READING_MINUTES,
  MIN_QUIET_SEC,
  MIN_READING_MINUTES,
  type AskerMode,
  type FlowMode,
  type Settings,
} from './settings-store.ts';

const NAME_FIELDS = ['room', 'identity', 'phone'] as const;
const SWITCHES = ['startOnJoin', 'loop', 'recordOnJoin', 'statsCsv', 'statsOverlay'] as const;

type NameField = (typeof NAME_FIELDS)[number];
type Switch = (typeof SWITCHES)[number];

type NumberField = 'quietSec' | 'readingMinutes';

export type FormValues = Record<NameField | NumberField, string> &
  Record<Switch, boolean> & { asker: AskerMode; mode: FlowMode; voice: string };

// An empty name keeps the old one; the server checks names on the next Join.
export function mergeFormValues(values: FormValues, current: Settings): Settings {
  const name = (field: NameField) => values[field].trim() || current[field];
  return {
    ...current,
    ...values,
    room: name('room'),
    identity: name('identity'),
    phone: name('phone'),
    quietSec: clampQuietSec(Number(values.quietSec), current.quietSec),
    readingMinutes: clampReadingMinutes(Number(values.readingMinutes), current.readingMinutes),
  };
}

export class SettingsForm {
  readonly #form: HTMLFormElement;

  constructor(form: HTMLFormElement, voices: readonly Voice[], onEdit: () => void) {
    this.#form = form;
    this.#select('voice').replaceChildren(
      ...voices.map(({ name, locale }) => new Option(`${name} · ${locale}`, name)),
    );
    Object.assign(this.#input('quietSec'), {
      min: String(MIN_QUIET_SEC),
      max: String(MAX_QUIET_SEC),
    });
    Object.assign(this.#input('readingMinutes'), {
      min: String(MIN_READING_MINUTES),
      max: String(MAX_READING_MINUTES),
    });
    form.onsubmit = (event) => event.preventDefault();
    form.onchange = () => onEdit();
  }

  fill(settings: Settings): void {
    for (const name of NAME_FIELDS) this.#input(name).value = settings[name];
    this.#input('quietSec').value = String(settings.quietSec);
    this.#input('readingMinutes').value = String(settings.readingMinutes);
    this.#select('voice').value = settings.voice;
    this.#radio('asker', settings.asker).checked = true;
    this.#radio('mode', settings.mode).checked = true;
    for (const name of SWITCHES) this.#input(name).checked = settings[name];
  }

  read(current: Settings): Settings {
    const text = (name: NameField | NumberField) => this.#input(name).value;
    const on = (name: Switch) => this.#input(name).checked;
    const values: FormValues = {
      room: text('room'),
      identity: text('identity'),
      phone: text('phone'),
      asker: this.#radio('asker', 'microphone').checked ? 'microphone' : 'voice',
      mode: this.#radio('mode', 'reading').checked ? 'reading' : 'questions',
      voice: this.#select('voice').value,
      quietSec: text('quietSec'),
      readingMinutes: text('readingMinutes'),
      startOnJoin: on('startOnJoin'),
      loop: on('loop'),
      recordOnJoin: on('recordOnJoin'),
      statsCsv: on('statsCsv'),
      statsOverlay: on('statsOverlay'),
    };
    return mergeFormValues(values, current);
  }

  #field<T extends Element>(selector: string): T {
    const field = this.#form.querySelector<T>(selector);
    if (!field) throw new Error(`${selector} is missing from the settings form`);
    return field;
  }

  #input(name: string): HTMLInputElement {
    return this.#field(`input[name="${name}"]`);
  }

  #radio(name: string, value: string): HTMLInputElement {
    return this.#field(`input[name="${name}"][value="${value}"]`);
  }

  #select(name: string): HTMLSelectElement {
    return this.#field(`select[name="${name}"]`);
  }
}
