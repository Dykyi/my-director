import demoScript from '../demo.txt';
import defaultReading from '../reading.txt';
import { Interviewer } from './interviewer.ts';

await Interviewer.start(defaultReading, demoScript);
