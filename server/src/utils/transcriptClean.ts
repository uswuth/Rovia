/**
 * Deterministic cleanup of raw speech-to-text output.
 *
 * Whisper writes exactly what it hears, which includes the hesitation sounds,
 * stutters and immediate word repetitions every speaker produces. The raw
 * transcript is therefore accurate but unpleasant to read.
 *
 * This removes only those artefacts. It never paraphrases, reorders, translates
 * or adds a word, so the result is still what the person said — just readable.
 */

/** Sounds that carry no meaning on their own. Whole word, any case. */
const FILLER_WORDS = [
  'um',
  'umm',
  'uhm',
  'uh',
  'uhh',
  'er',
  'erm',
  'ah',
  'ahh',
  'hmm',
  'hmmm'
];

const FILLER_PATTERN = new RegExp(`\\b(?:${FILLER_WORDS.join('|')})\\b,?\\s*`, 'gi');

/**
 * A filler dropped mid-sentence takes the comma that wrapped it with it, so
 * "we should, uh, ship" becomes "we should ship" rather than "we should, ship".
 */
const WRAPPED_FILLER_PATTERN = new RegExp(
  `\\s*,\\s*\\b(?:${FILLER_WORDS.join('|')})\\b,?\\s*`,
  'gi'
);

/** Labels Whisper writes over non-speech rather than leaving the segment empty. */
const NON_SPEECH_PATTERN = /[[(](?:inaudible|silence|music|applause|laughter|no speech)[\])]/gi;

/**
 * A word cut off mid-syllable then repeated: "th- the", "I- I". The space after
 * the hyphen is what separates a stutter from a legitimate hyphenation such as
 * "co-ordinate".
 */
const collapseStutters = (text: string): string =>
  text.replace(/\b([A-Za-z]{1,3})-\s+([A-Za-z]+)/g, (match, fragment: string, word: string) =>
    word.toLowerCase().startsWith(fragment.toLowerCase()) ? word : match
  );

/**
 * Immediate repeats of a word or a phrase up to three words long: "I I think",
 * "the the", "you know you know". Longer loops collapse over repeated passes.
 */
const REPEATED_CHUNK_PATTERN = /\b([A-Za-z']+(?:\s+[A-Za-z']+){0,2})\b(?:\s+\1\b)+/gi;

const collapseRepetitions = (text: string): string => {
  let current = text;
  let previous: string;
  do {
    previous = current;
    current = current.replace(REPEATED_CHUNK_PATTERN, '$1');
  } while (current !== previous);
  return current;
};

const tidyPunctuation = (text: string): string =>
  text
    // Removing a filler can leave a space before the comma that followed it.
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,;:])(?:\s*[,;:])+/g, '$1')
    .replace(/\.{2,}/g, '.')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,;:.!?-]+/, '');

const cleanLine = (line: string): string => {
  const trimmed = line.trim();
  if (!trimmed) return '';

  let text = trimmed.replace(NON_SPEECH_PATTERN, ' ');
  text = text.replace(WRAPPED_FILLER_PATTERN, ' ');
  text = text.replace(FILLER_PATTERN, '');
  text = collapseStutters(text);
  text = collapseRepetitions(text);
  text = tidyPunctuation(text);

  // A line that was nothing but filler is not a turn and should disappear.
  if (!/[\p{L}\p{N}]/u.test(text)) return '';

  // Dropping a leading filler leaves the sentence starting in lower case, and
  // the flat text puts each turn after "Speaker: ", which needs the same fix.
  return text.replace(/(^|:\s)([a-z])/g, (_match, prefix: string, first: string) => prefix + first.toUpperCase());
};

/**
 * Cleans a transcript while keeping its line structure, so the "Speaker: …"
 * blocks stay separated exactly as they were stored.
 */
export const cleanTranscriptText = (raw: string | null | undefined): string => {
  if (!raw) return '';

  return raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(cleanLine)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};
