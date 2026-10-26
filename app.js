const fields = {
  doc: {
    key: "hideaway-team-doc",
    state: document.querySelector("#state-doc"),
    open: document.querySelector("#open-doc"),
    fallback: "https://docs.google.com/document/create",
    label: "Doc",
    test: (url) => url.hostname === "docs.google.com" && url.pathname.includes("/document/"),
  },
  sheet: {
    key: "hideaway-team-sheet",
    state: document.querySelector("#state-sheet"),
    open: document.querySelector("#open-sheet"),
    fallback: "https://docs.google.com/spreadsheets/create",
    label: "Sheet",
    test: (url) => url.hostname === "docs.google.com" && url.pathname.includes("/spreadsheets/"),
  },
  calendar: {
    key: "hideaway-team-calendar",
    state: document.querySelector("#state-calendar"),
    open: document.querySelector("#open-calendar"),
    fallback: "https://calendar.google.com/calendar/u/0/r",
    label: "Calendar",
    test: (url) => url.hostname === "calendar.google.com",
  },
};

const form = document.querySelector("#links");
const formNote = document.querySelector("#form-note");
const copyNote = document.querySelector("#copy-note");
const briefBox = document.querySelector("#brief");

function saved(kind) {
  return localStorage.getItem(fields[kind].key) || "";
}

function paint() {
  for (const [kind, field] of Object.entries(fields)) {
    const url = saved(kind);
    field.open.href = url || field.fallback;
    field.open.textContent = url ? `Open ${field.label}` : `Create ${field.label}`;
    field.state.textContent = url ? "Saved in this browser." : `No ${field.label} saved in this browser yet.`;
    const input = form.elements[kind];
    if (input && !input.value) input.value = url;
  }
}

function brief(name, voice, partner) {
  const doc = saved("doc") || "the shared Doc on the lab Google Drive";
  const sheet = saved("sheet") || "the shared Sheet on the lab Google Drive";
  const calendar = saved("calendar") || "the shared Calendar on the lab Google Drive";
  return [
    `You are ${name} on the 615 team lab with ${partner}. Sammy talks to one of you at a time in your own app. You two keep the shared record. This lab is not the615hideaway.com and it is not Sammy's personal Google Drive.`,
    "Use only the lab Google account.",
    `Doc (${doc}): this is where you talk things out and hand work across. Append one new paragraph. Start with the date and "${voice}:". Do not edit older paragraphs.`,
    `When Sammy asks you to tell ${partner} to do something, write a line that starts "${voice} → ${partner}:" and add a Sheet row owned by ${partner}.`,
    `When a Doc line is addressed to you, do the work or write back what you need. Then update the Sheet and append the result.`,
    `Sheet (${sheet}): columns are Task, Owner, Status, Due, Notes. Status is open, doing, done, or needs Sammy. Add a row when something needs doing. Use needs Sammy when Sammy has to decide or help.`,
    `Calendar (${calendar}): an event whose title starts with TEAM is a timed handoff. The Doc remains the conversation.`,
    "Sammy may paste text that ChatGPT drafted. Treat that text as Sammy's. ChatGPT is not a teammate here.",
    "Do not post to Facebook, Instagram, or Threads from this board. Do not open or change the website repository.",
  ].join("\n\n");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const rejected = [];
  for (const [kind, field] of Object.entries(fields)) {
    const value = form.elements[kind].value.trim();
    let url;
    try {
      url = new URL(value);
    } catch {
      rejected.push(field.label);
      continue;
    }
    if (url.protocol !== "https:" || !field.test(url)) {
      rejected.push(field.label);
      continue;
    }
    localStorage.setItem(field.key, url.toString());
  }
  paint();
  formNote.textContent = rejected.length
    ? `Check the ${rejected.join(" and ")} address. It needs to be an https Google link of that type.`
    : "Saved in this browser.";
});

document.querySelector("#clear-links").addEventListener("click", () => {
  for (const field of Object.values(fields)) localStorage.removeItem(field.key);
  form.reset();
  formNote.textContent = "Cleared from this browser.";
  paint();
});

function showBrief(text) {
  briefBox.value = text;
  briefBox.focus();
  briefBox.select();
  const copied = navigator.clipboard && window.isSecureContext
    ? navigator.clipboard.writeText(text).then(() => true).catch(() => false)
    : Promise.resolve(false);
  copied.then((ok) => {
    copyNote.textContent = ok
      ? "Copied. Paste it into that teammate."
      : "The brief is in the box. Select it and copy it by hand.";
  });
}

document.querySelector("#copy-grok").addEventListener("click", () => {
  showBrief(brief("Grok Bot", "Grok Bot", "Muse"));
});

document.querySelector("#copy-muse").addEventListener("click", () => {
  showBrief(brief("Muse", "Muse", "Grok Bot"));
});

paint();
