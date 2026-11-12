const BOOKING_URL = 'https://calendly.com/zkadtani/job';
const STORAGE_KEY = 'aev-ai-checkup-v1';

const questions = [
  {
    area: 'Google profile',
    title: 'Can customers find the right hours and phone number for you on Google?',
    options: ['I have no profile or the details are wrong', 'Most details are right, but I rarely check', 'The details are current'],
    fixes: [
      'Claim your Google Business Profile and add your current hours, phone number and website.',
      'Check your listing now and set a reminder to update it before holidays.',
      'Check that your holiday hours are listed before the next holiday.'
    ]
  },
  {
    area: 'Reviews',
    title: 'Do you ask customers for a review after a job?',
    options: ['Rarely or never', 'Sometimes, when I remember', 'I ask after most jobs'],
    fixes: [
      'Save your Google review link and share it when you thank a customer after a job.',
      'Add a review reminder to your end of job checklist.',
      'Set aside a few minutes each week to reply to new reviews.'
    ]
  },
  {
    area: 'Website contact',
    title: 'How easy is it to reach you from your website on a phone?',
    options: ['I have no site or my contact details are hard to find', 'People can reach me, but it takes a few taps', 'There is a clear call or contact button'],
    fixes: [
      'Put a clear call or contact button near the top of your home page. If you have no site, make sure your Google listing shows how to reach you.',
      'Move your contact button up so people can see it as soon as the home page opens.',
      'Tap your contact button on a phone and make sure it reaches the right number or form.'
    ]
  },
  {
    area: 'Missed calls',
    title: 'What happens when you miss a call from a new customer?',
    options: ['It often goes unanswered', 'I call back when I have time', 'They get a quick reply, and I follow up'],
    fixes: [
      'Set up a short reply for missed calls that asks what the caller needs and tells them when you can call back.',
      'Set aside time to return missed calls before the end of each workday.',
      'Call your business line after hours and check what a new caller gets.'
    ]
  },
  {
    area: 'Follow up',
    title: 'Do you check back after sending a quote?',
    options: ['Rarely or never', 'Sometimes, when I remember', 'I have a reminder and follow up most times'],
    fixes: [
      'When you send a quote, set a reminder to check back in two workdays.',
      'Keep open quotes on one list with a date to check back on each one.',
      'Review open quotes once a week and make sure each has a next step.'
    ]
  },
  {
    area: 'Booking',
    title: 'How do customers get on your calendar?',
    options: ['It usually takes several calls or messages', 'They can ask for a time and I confirm it later', 'They can pick a time or get one in a single reply'],
    fixes: [
      'Offer two open times in your first reply so customers can pick one right away.',
      'Add a clear reply window to booking requests so customers know when to expect a time.',
      'Try booking from a phone and check that the confirmation has the right time and next steps.'
    ]
  },
  {
    area: 'Social posts',
    title: 'How often do you share useful updates on social media?',
    options: ['Rarely or never', 'Some weeks, when there is time', 'Most weeks on a set day'],
    fixes: [
      'Pick one day each week to share a tip or a photo of work you have permission to show.',
      'Save a few post ideas and set a weekly reminder to share one.',
      'Use a question customers ask often as the topic of your next post.'
    ]
  },
  {
    area: 'Email list',
    title: 'Do you have an email list people have signed up for?',
    options: ['No', 'Yes, but I rarely use it', 'Yes, and I send useful updates'],
    fixes: [
      'Give customers a clear way to sign up for occasional tips or updates by email.',
      'Send your list one helpful seasonal tip this month.',
      'Check that your signup form says what people will get and how often.'
    ]
  },
  {
    area: 'Repeat customers',
    title: 'Do you give past customers a reason to come back?',
    options: ['I wait for them to reach out', 'I remind some people when I remember', 'I have a clear plan for repeat visits'],
    fixes: [
      'Tell customers when it makes sense to book again before you finish the job.',
      'Set a reminder for the next service date when you close a job.',
      'Review your timing so reminders arrive when past customers are likely to need you.'
    ]
  },
  {
    area: 'Response time',
    title: 'How soon do you reply to new questions during business hours?',
    options: ['Usually the next day or later', 'Usually the same day', 'Usually within an hour'],
    fixes: [
      'Check new messages at two set times each workday and tell customers when you will reply.',
      'Save replies to your most common questions so you can answer sooner.',
      'Check a few recent requests for slow replies and see what got in the way.'
    ]
  },
  {
    area: 'Online payments',
    title: 'Can customers pay online if they want to?',
    options: ['No, they need to pay in person', 'Sometimes, but it takes extra steps', 'Yes, with a clear way to pay from their phone'],
    fixes: [
      'Check whether the service you use for invoices lets you add a pay link.',
      'Put the payment instructions in the same message as the invoice.',
      'Check that an invoice is easy to read and pay from a phone.'
    ]
  }
];

const total = questions.length + 1;
const maxPoints = questions.length * 2;
const get = (id) => document.getElementById(id);
const quiz = get('quiz');
const report = get('report');
const stepTitle = get('step-title');
const stepHelp = get('step-help');
const answerArea = get('answer-area');
const quizError = get('quiz-error');
const bookingLink = get('booking-link');
const bookingStatus = get('booking-status');
const bookingIsPlaceholder = BOOKING_URL.endsWith('/REPLACE-ME');

let state = load();

function blankState() {
  return { step: 0, answers: Array(questions.length).fill(null), note: '', finished: false };
}

function load() {
  const initial = blankState();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !Array.isArray(saved.answers)) return initial;

    initial.answers = questions.map((_, index) => {
      const answer = saved.answers[index];
      return [0, 1, 2].includes(answer) ? answer : null;
    });
    initial.note = typeof saved.note === 'string' ? saved.note.slice(0, 500) : '';
    const firstBlank = initial.answers.indexOf(null);
    const lastReachable = firstBlank < 0 ? total - 1 : firstBlank;
    initial.step = Number.isInteger(saved.step) ? Math.max(0, Math.min(saved.step, lastReachable)) : 0;
    initial.finished = saved.finished === true && firstBlank < 0;
  } catch {
    return initial;
  }
  return initial;
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    get('save-status').textContent = 'This browser could not save your progress.';
  }
}

function renderQuestion() {
  const question = questions[state.step];
  get('step-count').textContent = 'Question ' + (state.step + 1) + ' of ' + total;
  get('step-topic').textContent = question ? question.area : 'Your own words';
  get('progress').value = state.step + 1;
  get('back').hidden = state.step === 0;
  get('next').textContent = question ? 'Continue' : 'See my report';
  quizError.textContent = '';
  answerArea.replaceChildren();

  if (!question) {
    stepTitle.textContent = 'What is the biggest headache in your business right now?';
    stepHelp.textContent = 'Optional. Leave out customer names and contact details.';
    const note = document.createElement('textarea');
    note.id = 'pain-input';
    note.setAttribute('aria-labelledby', 'step-title');
    note.setAttribute('aria-describedby', 'step-help');
    note.rows = 4;
    note.maxLength = 500;
    note.value = state.note;
    note.addEventListener('input', () => {
      state.note = note.value;
      save();
    });
    answerArea.append(note);
    return;
  }

  stepTitle.textContent = question.title;
  stepHelp.textContent = 'Pick the answer that fits best.';
  const group = document.createElement('div');
  group.className = 'choices';
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-labelledby', 'step-title');
  group.setAttribute('aria-describedby', 'step-help quiz-error');
  question.options.forEach((option, index) => {
    const label = document.createElement('label');
    label.className = 'choice';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'answer';
    radio.value = String(index);
    radio.checked = state.answers[state.step] === index;
    radio.addEventListener('change', () => {
      state.answers[state.step] = index;
      quizError.textContent = '';
      save();
    });
    const text = document.createElement('span');
    text.textContent = option;
    label.append(radio, text);
    group.append(label);
  });
  answerArea.append(group);
}

function gradeFor(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function renderReport() {
  const points = state.answers.reduce((sum, answer) => sum + answer, 0);
  const score = Math.round(points * 100 / maxPoints);
  get('score-number').textContent = score;
  get('grade').textContent = 'Grade ' + gradeFor(score);
  get('fix-title').textContent = score === 100 ? 'Three areas to keep strong' : 'Your first three fixes';
  const weakest = questions.map((question, index) => ({ question, index, points: state.answers[index] }))
    .sort((a, b) => a.points - b.points || a.index - b.index)
    .slice(0, 3);
  const fixes = get('fixes');
  fixes.replaceChildren();
  weakest.forEach(({ question, points }) => {
    const item = document.createElement('li');
    const area = document.createElement('h3');
    area.textContent = question.area;
    const fix = document.createElement('p');
    fix.textContent = question.fixes[points];
    item.append(area, fix);
    fixes.append(item);
  });

  const note = state.note.trim();
  get('note-section').hidden = !note;
  get('pain-note').textContent = note;
  bookingStatus.textContent = bookingIsPlaceholder ? 'Booking link coming soon.' : '';
}

function show(moveFocus = false) {
  quiz.hidden = state.finished;
  report.hidden = !state.finished;
  if (state.finished) {
    renderReport();
  } else {
    renderQuestion();
  }
  if (moveFocus) {
    (state.finished ? get('report-title') : stepTitle).focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}

get('quiz-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (state.step < questions.length && state.answers[state.step] === null) {
    quizError.textContent = 'Pick an answer to continue.';
    answerArea.querySelector('input').focus();
    return;
  }
  if (state.step === total - 1) {
    state.finished = true;
  } else {
    state.step++;
  }
  save();
  show(true);
});

get('back').addEventListener('click', () => {
  if (state.step === 0) return;
  state.step--;
  save();
  show(true);
});

get('restart').addEventListener('click', () => {
  state = blankState();
  save();
  show(true);
});

bookingLink.href = BOOKING_URL;
bookingLink.addEventListener('click', (event) => {
  if (!bookingIsPlaceholder) return;
  event.preventDefault();
  bookingStatus.textContent = 'Booking is not set up in this demo.';
});

get('print').addEventListener('click', () => window.print());
show();
