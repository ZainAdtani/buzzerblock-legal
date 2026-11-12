const BOOKING_URL = "https://calendly.com/zkadtani/job";

const STORAGE_KEY = "missed-call-saver-v1";
const DEMO = { calls: "10", value: "200", share: "60", demo: true };
const WEEKS_PER_YEAR = 52;
const MONTHS_PER_YEAR = 12;

const calls = document.querySelector("#calls");
const jobValue = document.querySelector("#job-value");
const share = document.querySelector("#share");
const shareValue = document.querySelector("#share-value");
const inputNote = document.querySelector("#input-note");
const annualValue = document.querySelector("#annual-value");
const monthlyValue = document.querySelector("#monthly-value");
const monthlyJobs = document.querySelector("#monthly-jobs");
const bookingLink = document.querySelector("#booking-link");
const bookingNote = document.querySelector("#booking-note");

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});
const jobs = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
let usingDemo;

function readSavedInputs() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved.calls === "string" &&
      typeof saved.value === "string" && typeof saved.share === "string") {
      return saved;
    }
  } catch {
    // The calculator also works when the browser blocks local file storage.
  }
  return DEMO;
}

function saveInputs() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      calls: calls.value,
      value: jobValue.value,
      share: share.value,
      demo: usingDemo
    }));
  } catch {
    // The current numbers stay on screen even if the browser cannot save them.
  }
}

function loadInputs(values) {
  calls.value = values.calls;
  jobValue.value = values.value;
  share.value = values.share;
  usingDemo = values.demo === true;
  renderEstimate();
}

function renderEstimate() {
  shareValue.value = share.value + "%";
  share.setAttribute("aria-valuetext", share.value + " percent");

  calls.setAttribute("aria-invalid", String(!calls.validity.valid));
  jobValue.setAttribute("aria-invalid", String(!jobValue.validity.valid));

  if (!calls.validity.valid) {
    inputNote.textContent = "Enter a whole number of calls from 0 to 1,000,000.";
  } else if (!jobValue.validity.valid) {
    inputNote.textContent = "Enter a job value from $0 to $1 billion, with up to two decimals.";
  } else if (!calls.value || !jobValue.value) {
    inputNote.textContent = "Enter missed calls and a job value to see your estimate.";
  } else {
    inputNote.textContent = usingDemo ? "Demo numbers. Replace them with your own." : "The estimate updates as you type.";
  }

  if (!calls.value || !jobValue.value || !calls.validity.valid || !jobValue.validity.valid) {
    annualValue.textContent = "…";
    monthlyValue.textContent = "…";
    monthlyJobs.textContent = "…";
    return;
  }

  const lostJobsPerYear = Number(calls.value) * (Number(share.value) / 100) * WEEKS_PER_YEAR;
  const lostMoneyPerYear = lostJobsPerYear * Number(jobValue.value);

  annualValue.textContent = money.format(lostMoneyPerYear);
  monthlyValue.textContent = money.format(lostMoneyPerYear / MONTHS_PER_YEAR);
  monthlyJobs.textContent = jobs.format(lostJobsPerYear / MONTHS_PER_YEAR);
}

for (const input of [calls, jobValue, share]) {
  input.addEventListener("input", () => {
    usingDemo = false;
    renderEstimate();
    saveInputs();
  });
}

document.querySelector("#load-demo").addEventListener("click", () => {
  loadInputs(DEMO);
  saveInputs();
});

bookingLink.href = BOOKING_URL;
if (BOOKING_URL !== "https://cal.com/REPLACE-ME") {
  bookingNote.hidden = true;
} else {
  bookingLink.addEventListener("click", (event) => {
    event.preventDefault();
    bookingNote.textContent = "Booking is not set up in this demo.";
  });
}

loadInputs(readSavedInputs());
