'use strict';

const sampleDigest = [
  'What this is: A short lesson on keeping missed calls from going cold.',
  '00:01 Host: Find out when calls get missed before you buy anything.',
  '00:13 Host: Ask what help the caller needs before you ask for a booking.',
  '00:14 Host: Ask what help the caller needs before you ask for a booking.',
  '00:24 Host: Pick one person to check for replies during work hours.',
  '00:32 Host: Count replies and bookings separately so you know what changed.',
  'Move: Track missed calls for one week and look for the busiest hour.',
  'Money: Real fit. A local shop could pay for help if it misses good calls and has someone to handle replies.',
  'Benefit: You can see whether missed calls are costing work before you spend on a fix.'
].join('\n');

const sampleTriage = [
  'Missed calls at small shops | I can try the one-week call log this week.',
  'How search results rank local shops | Useful background. I need to learn the basics first.',
  'One strange trick for instant sales | Clickbait. No proof or useful steps.'
].join('\n');

const settings = {
  digest: {
    label: 'Transcript or notes',
    help: 'Paste text from one video. Include at least three distinct points.',
    placeholder: 'Paste your transcript or notes here…',
    run: 'Make digest',
    result: 'Your digest',
    copy: 'Copy digest',
    empty: 'Your digest will appear here. Try the sample to see the format.',
    sample: sampleDigest
  },
  triage: {
    label: 'Video titles and notes',
    help: 'Add one video per line. Put a | between the title and your notes.',
    placeholder: 'Video title | What you know about it',
    run: 'Sort videos',
    result: 'Your triage',
    copy: 'Copy triage',
    empty: 'You’ll get one suggested call per video. Try the sample to see how it works.',
    sample: sampleTriage
  }
};

const $ = id => document.getElementById(id);
const source = $('source');
const buttons = [...document.querySelectorAll('[data-mode]')];
const storageKey = 'queue-digest-drafts-v1';
const oldStorageKey = 'queuebrain-draft-v1';
const maxLength = 120000;
const maxVideos = 100;
const timestamp = '\\d{1,3}:\\d{2}(?::\\d{2})?(?:[.,]\\d{1,3})?';
const cueRange = new RegExp('^' + timestamp + '\\s+-->\\s+' + timestamp + '(?:\\s+.*)?$');
const leadingTime = new RegExp('^\\s*(?:\\[\\s*' + timestamp + '\\s*\\]|\\(\\s*' + timestamp + '\\s*\\)|' + timestamp + '(?=\\s|$))\\s*[-–—|]?\\s*');
const speakerRole = /^(?:\[\s*)?(?:speaker\s*\d*|host|guest|narrator|interviewer|participant\s*\d*)(?:\s*\])?\s*:\s*/i;
const speakerName = /^(?:\[[\p{Lu}][\p{L}' -]{0,35}\]|[\p{Lu}][\p{L}'-]{0,20}(?: [\p{Lu}][\p{L}'-]{0,20})?)\s*:\s*/u;
const fieldPattern = /^(what this is|what it is|summary|takeaways?|one usable move|usable move|action|move|money angle|money|how it benefits (?:you|the reader)|benefit)\s*:\s*/i;
const filler = /^(?:hi everyone|hey guys|hello everyone|welcome(?: back)? to|thanks? for watching|please subscribe|like and subscribe)\b/i;
const actionPattern = /^(?:(?:you (?:can|should)|try to)\s+)?(?:add|ask|build|call|check|choose|compare|count|create|find|keep|look|make|measure|pick|put|record|review|save|send|set|start|test|track|try|use|write)\b/i;
const commercial = /\b(?:customers?|clients?|buyers?|revenue|sales|pricing|budgets?|paid|pay for|charge for|sell|profit)\b/i;
const commonWords = new Set('about after again also and are because been before being but can could does each from have here how into just like more most much only other our over really same should some than that the their them then there these they thing this those through too very want was were what when where which while who will with would you your'.split(' '));
const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('en', {granularity: 'sentence'}) : null;

const tidy = value => value.replace(/\s+/g, ' ').trim();
const trimBullet = value => value.replace(/^\s*(?:[-*•]\s+|\d+[.)]\s+)/, '');
const sentence = value => /[.!?]$/.test(value) ? value : value + '.';
const textLines = value => value.replace(/\r\n?/g, '\n').split('\n').map(line => line.trim()).filter(Boolean);
const canonical = value => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function cleanTranscript(input) {
  const raw = textLines(input);
  const lines = [];
  const seen = new Set();
  const namedPrefixes = new Map();
  for (const line of raw) {
    const name = trimBullet(line).match(speakerName)?.[0].trim();
    if (name && !fieldPattern.test(line)) {
      namedPrefixes.set(name, (namedPrefixes.get(name) || 0) + 1);
    }
  }
  let timestamps = 0;
  let speakers = 0;
  let repeats = 0;

  for (let line of raw) {
    if (cueRange.test(line)) {
      timestamps++;
      continue;
    }
    if (/^(?:WEBVTT\b|Kind:|Language:|\d+$)/i.test(line)) continue;

    const withoutTime = line.replace(leadingTime, '');
    const hadTime = withoutTime !== line;
    if (hadTime) timestamps++;
    line = trimBullet(withoutTime);

    // Preserve section headings and avoid stripping a lone title from untimed notes.
    if (!fieldPattern.test(line)) {
      let withoutSpeaker = line.replace(speakerRole, '');
      const name = line.match(speakerName)?.[0].trim();
      if (withoutSpeaker === line && name && (hadTime || name.startsWith('[') || namedPrefixes.get(name) > 1)) {
        withoutSpeaker = line.slice(name.length).trim();
      }
      if (withoutSpeaker !== line) speakers++;
      line = withoutSpeaker;
    }
    line = tidy(line.replace(/^(?:>>+|\[music\]|\[applause\])\s*/i, ''));
    const key = canonical(line);
    if (!key) continue;
    if (seen.has(key)) {
      repeats++;
      continue;
    }
    seen.add(key);
    lines.push(line);
  }
  return {lines, before: raw.length, timestamps, speakers, repeats};
}

function labeledNotes(lines) {
  const notes = {summary: '', takeaways: [], move: '', money: '', benefit: '', body: []};
  for (const line of lines) {
    if (/^video title\s*:/i.test(line)) continue;
    const match = line.match(fieldPattern);
    if (!match) {
      notes.body.push(line);
      continue;
    }
    const value = line.slice(match[0].length).trim();
    if (!value) continue;
    const label = match[1].toLowerCase();
    if (/^takeaway/.test(label)) notes.takeaways.push(value);
    else if (/^(what|summary)/.test(label)) notes.summary ||= value;
    else if (/^(one usable move|usable move|action|move)/.test(label)) notes.move ||= value;
    else if (/^money/.test(label)) notes.money ||= value;
    else notes.benefit ||= value;
  }
  return notes;
}

function extractPoints(lines) {
  const points = [];
  const seen = new Set();
  for (const line of lines) {
    const parts = segmenter
      ? Array.from(segmenter.segment(line), part => part.segment)
      : line.split(/(?<=[.!?])\s+/);
    for (const part of parts) {
      const point = tidy(part);
      const key = canonical(point);
      if (key.length < 7 || filler.test(point) || seen.has(key)) continue;
      seen.add(key);
      points.push(point);
    }
  }
  return points;
}

function rankPoints(points) {
  const tokens = points.map(point => [...new Set(canonical(point).split(' ').filter(word => word.length > 2 && !commonWords.has(word)))]);
  const frequency = new Map();
  for (const words of tokens) {
    for (const word of words) frequency.set(word, (frequency.get(word) || 0) + 1);
  }
  return points.map((point, index) => {
    const words = tokens[index];
    const relevance = words.reduce((total, word) => total + Math.min(frequency.get(word), 5) - 1, 0) / Math.max(1, words.length);
    const action = actionPattern.test(point) ? 1.3 : 0;
    const readable = point.length >= 28 && point.length <= 210 ? 1 : 0;
    return {point, index, score: relevance + action + readable};
  }).sort((a, b) => b.score - a.score || a.index - b.index);
}

function moneyAngle(notes, body) {
  const tagged = notes.money.match(/^(real fit|stretch|not for (?:you|him))\b[\s:.,;–—-]*/i);
  if (tagged) {
    const key = tagged[1].toLowerCase();
    const label = key === 'real fit' ? 'Real fit' : key === 'stretch' ? 'Stretch' : 'Not for you';
    const reason = notes.money.slice(tagged[0].length).trim();
    if (reason) return {label, reason};
    if (label === 'Not for you') return {label, reason: 'The notes do not identify a fit.'};
    return {label: 'Stretch', reason: 'Add who would pay and why before calling this a real fit.'};
  }

  if (notes.money || commercial.test(body)) {
    return {label: 'Stretch', reason: notes.money || 'The notes mention business or sales. Check who would pay and what they would get.'};
  }
  return {label: 'Not for you', reason: 'The pasted text gives no clear reason someone would pay for this.'};
}

function makeDigest(lines) {
  const notes = labeledNotes(lines);
  const points = extractPoints(notes.body);
  const tagged = extractPoints(notes.takeaways);
  const seen = new Set(tagged.map(canonical));
  const ranked = rankPoints(points);
  const extra = ranked.filter(entry => !seen.has(canonical(entry.point)));
  const chosen = extra.slice(0, 5 - Math.min(5, tagged.length)).sort((a, b) => a.index - b.index);
  const takeaways = [...tagged.slice(0, 5), ...chosen.map(entry => entry.point)];
  if (takeaways.length < 3) return null;

  const summary = notes.summary || ranked[0]?.point || tagged[0];
  const move = notes.move || ranked.find(entry => actionPattern.test(entry.point))?.point ||
    'Pick one takeaway and write down the first small step you could try.';
  const benefit = notes.benefit || 'You can review the main points and choose one thing to try without rewatching.';
  const angle = moneyAngle(notes, takeaways.join(' '));
  return [
    {title: 'What this is', text: sentence(summary)},
    {title: 'Takeaways', items: takeaways.map(sentence)},
    {title: 'One usable move', text: sentence(move)},
    {title: 'Money angle', text: sentence(angle.reason), label: angle.label},
    {title: 'How it benefits you', text: sentence(benefit)}
  ];
}

function triageVideos(value) {
  const seen = new Set();
  const rows = [];
  for (const line of textLines(value).slice(0, maxVideos)) {
    const [rawTitle, ...details] = trimBullet(line).split(/\s*\|\s*|\s+[–—]\s+/);
    const title = tidy(rawTitle);
    const key = canonical(title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const note = tidy(details.join(' '));
    let label = 'Learn';
    let reason = note ? 'Review for useful background.' : 'Add a note to judge its value.';
    if (/\b(?:drop|skip|clickbait|no (?:proof|steps|value)|not relevant|off[- ]topic|duplicate|outdated|already know)\b/i.test(note)) {
      label = 'Drop';
      reason = 'Your note flags low value or poor fit.';
    } else if (/\b(?:keep|try|apply|test|use|build|implement|template|checklist|this week|next step)\b/i.test(note)) {
      label = 'Keep';
      reason = 'Your note points to something you can use.';
    }
    rows.push({title, label, reason});
  }
  return rows;
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function renderDigest(sections) {
  const nodes = sections.map(section => {
    const box = element('section', '', 'digest-section');
    box.append(element('h3', section.title));
    if (section.items) {
      const list = element('ol');
      list.append(...section.items.map(item => element('li', item)));
      box.append(list);
    } else {
      if (section.label) {
        const color = section.label === 'Real fit' ? 'keep' : section.label === 'Stretch' ? 'stretch' : 'none';
        box.append(element('span', section.label, 'fit ' + color));
      }
      box.append(element('p', section.text));
    }
    return box;
  });
  $('result').replaceChildren(...nodes);

  return sections.map(section => {
    const body = section.items ? section.items.map((item, i) => (i + 1) + '. ' + item).join('\n') : section.text;
    return section.title + '\n' + (section.label ? section.label + ': ' : '') + body;
  }).join('\n\n');
}

function renderTriage(rows) {
  const list = element('ul', '', 'triage-list');
  for (const row of rows) {
    const item = element('li', '', 'triage-row');
    item.append(element('span', row.label, 'fit ' + row.label.toLowerCase()), element('strong', row.title), document.createTextNode('. ' + row.reason));
    list.append(item);
  }
  $('result').replaceChildren(list);
  return rows.map(row => row.label + ': ' + row.title + ' | ' + row.reason).join('\n');
}

function loadDrafts() {
  const empty = {digest: '', triage: ''};
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved && typeof saved === 'object') {
      for (const name of Object.keys(empty)) {
        if (typeof saved[name] === 'string') empty[name] = saved[name].slice(0, maxLength);
      }
      return empty;
    }
    const old = JSON.parse(localStorage.getItem(oldStorageKey) || 'null');
    if (old) {
      empty.digest = [
        old.title && 'Video title: ' + old.title,
        (old.summary || old.title) && 'What this is: ' + (old.summary || old.title),
        ...(typeof old.takeaways === 'string' ? textLines(old.takeaways).map(line => 'Takeaway: ' + trimBullet(line)) : []),
        old.move && 'Move: ' + old.move,
        (old.angle || old.reason) && 'Money: ' + [old.angle, old.reason].filter(Boolean).join('. ')
      ].filter(Boolean).join('\n');
    }
  } catch {
    $('draft-status').textContent = 'This browser could not read your draft.';
  }
  return empty;
}

const drafts = loadDrafts();
let mode = 'digest';
let showingSample = false;
let output = '';

function saveDraft() {
  drafts[mode] = source.value;
  try {
    localStorage.setItem(storageKey, JSON.stringify(drafts));
    $('draft-status').textContent = 'Drafts stay in this browser.';
  } catch {
    $('draft-status').textContent = 'This browser could not save your draft.';
  }
}

function resetResult() {
  output = '';
  $('result').replaceChildren();
  $('copy').disabled = true;
  $('copy-text').hidden = true;
  $('copy-status').textContent = '';
  $('sample-badge').hidden = true;
  $('empty').hidden = false;
  $('cleanup').hidden = true;
  $('source-status').textContent = '';
}

function setMode(next) {
  mode = next;
  showingSample = false;
  const copy = settings[mode];
  source.value = drafts[mode];
  source.placeholder = copy.placeholder;
  $('source-label').textContent = copy.label;
  $('source-help').textContent = copy.help;
  $('run').textContent = copy.run;
  $('result-title').textContent = copy.result;
  $('copy').textContent = copy.copy;
  $('empty').textContent = copy.empty;
  $('digest-tips').hidden = mode === 'triage';
  buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
  resetResult();
}

function processInput() {
  resetResult();
  if (!source.value.trim()) {
    $('source-status').textContent = 'Paste some text or try the sample.';
    return;
  }
  if (mode === 'digest') {
    const clean = cleanTranscript(source.value);
    $('cleanup').textContent = clean.before + ' lines in · ' + clean.lines.length + ' kept · ' +
      clean.timestamps + ' timestamps, ' + clean.speakers + ' speaker labels and ' + clean.repeats + ' repeats removed';
    $('cleanup').hidden = false;
    const digest = makeDigest(clean.lines);
    if (!digest) {
      $('source-status').textContent = 'Add a few more notes. A digest needs at least three distinct takeaways.';
      return;
    }
    output = renderDigest(digest);
  } else {
    const rows = triageVideos(source.value);
    if (!rows.length) {
      $('source-status').textContent = 'Add a video title on each line.';
      return;
    }
    if (textLines(source.value).length > maxVideos) {
      $('source-status').textContent = 'Sorted the first 100 lines. Paste the rest as a second batch.';
    }
    output = renderTriage(rows);
  }
  $('empty').hidden = true;
  $('sample-badge').hidden = !showingSample;
  $('copy').disabled = false;
  $('result-title').focus();
}

async function copyResult() {
  const value = output;
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    if (value === output) $('copy-status').textContent = 'Copied.';
    return;
  } catch {
    if (value !== output) return;
  }

  const field = $('copy-text');
  field.value = value;
  field.hidden = false;
  field.focus();
  field.select();
  let copied = false;
  try { copied = document.execCommand('copy'); } catch { /* Keep the selection for manual copy. */ }
  if (copied) {
    field.hidden = true;
    $('copy').focus();
  }
  $('copy-status').textContent = copied ? 'Copied.' : 'Use your device’s Copy command to copy the selected text.';
}

source.maxLength = maxLength;
source.addEventListener('input', () => {
  showingSample = false;
  saveDraft();
  resetResult();
});
buttons.forEach(button => button.addEventListener('click', () => {
  if (mode !== button.dataset.mode) setMode(button.dataset.mode);
}));
$('source-form').addEventListener('submit', event => {
  event.preventDefault();
  processInput();
});
$('sample').addEventListener('click', () => {
  showingSample = true;
  source.value = settings[mode].sample;
  processInput();
});
$('copy').addEventListener('click', copyResult);
setMode(mode);
