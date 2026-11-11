import type { Voice } from '../server/voice-catalog.ts';
import {
  clampQuietSec,
  clampTalkMinutes,
  MAX_QUIET_SEC,
  MAX_TALK_MINUTES,
  MIN_QUIET_SEC,
  MIN_TALK_MINUTES,
  type AskerMode,
  type FlowMode,
  type Settings,
} from './settings-store.ts';

const NAME_FIELDS = ['room', 'identity', 'phone'] as const;
const SWITCHES = ['startOnJoin', 'loop', 'recordOnJoin', 'statsCsv', 'statsOverlay'] as const;
const VOICE_FIELDS = ['voice', 'guestVoice'] as const;

type NameField = (typeof NAME_FIELDS)[number];
type Switch = (typeof SWITCHES)[number];

type NumberField = 'quietSec' | 'talkMinutes';
type VoiceField = (typeof VOICE_FIELDS)[number];

export type FormValues = Record<NameField | NumberField | VoiceField, string> &
  Record<Switch, boolean> & { asker: AskerMode; mode: FlowMode };

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
    talkMinutes: clampTalkMinutes(Number(values.talkMinutes), current.talkMinutes),
  };
}

export class SettingsForm {
  readonly #form: HTMLFormElement;

  constructor(form: HTMLFormElement, voices: readonly Voice[], onEdit: () => void) {
    this.#form = form;
    for (const field of VOICE_FIELDS)
      this.#select(field).replaceChildren(
        ...voices.map(({ name, locale }) => new Option(`${name} · ${locale}`, name)),
      );
    Object.assign(this.#input('quietSec'), {
      min: String(MIN_QUIET_SEC),
      max: String(MAX_QUIET_SEC),
    });
    Object.assign(this.#input('talkMinutes'), {
      min: String(MIN_TALK_MINUTES),
      max: String(MAX_TALK_MINUTES),
    });
    form.onsubmit = (event) => event.preventDefault();
    form.onchange = () => onEdit();
  }

  fill(settings: Settings): void {
    for (const name of NAME_FIELDS) this.#input(name).value = settings[name];
    this.#input('quietSec').value = String(settings.quietSec);
    this.#input('talkMinutes').value = String(settings.talkMinutes);
    for (const field of VOICE_FIELDS) this.#select(field).value = settings[field];
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
      mode: this.#field<HTMLInputElement>('input[name="mode"]:checked').value as FlowMode,
      voice: this.#select('voice').value,
      guestVoice: this.#select('guestVoice').value,
      quietSec: text('quietSec'),
      talkMinutes: text('talkMinutes'),
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
