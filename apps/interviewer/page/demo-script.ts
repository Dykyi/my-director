import { speechParts } from './reading-run.ts';

export type DemoSpeaker = 'interviewer' | 'guest';
export interface DemoLine {
  speaker: DemoSpeaker;
  text: string;
}

const squeeze = (text: string) => text.replace(/\s+/g, ' ').trim();

const spoken = (speaker: DemoSpeaker, text: string): DemoLine[] =>
  text ? speechParts(text).map((part) => ({ speaker, text: part })) : [];

/** Blocks split by a blank line: the first line asks, the rest of the block answers. */
export const parseDemoScript = (text: string): DemoLine[] =>
  text.split(/\n\s*\n/).flatMap((block) => {
    const [question = '', ...answer] = block.trim().split('\n');
    return [
      ...spoken('interviewer', squeeze(question)),
      ...spoken('guest', squeeze(answer.join(' '))),
    ];
  });
