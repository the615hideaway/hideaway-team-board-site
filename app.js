const linkFields = {
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
};

const columns = [
  "Record type",
  "Title or assignment",
  "Person",
  "Entered by",
  "Recorded at",
  "Status",
  "Source",
  "Check-in result",
  "Working on",
  "Completed",
  "Waiting on",
  "Blocked",
  "Recommendation",
  "Response time",
  "Uncertainty",
  "Decision",
  "Notes",
];

const briefs = {
  gb: [
    "You are GB, Chief Coordinator of the 615 Hideaway AI team.",
    "The owner directs the project. You organize priorities, assignments, and progress. Relay carries messages only to the assistants the owner or you select, and brings each reply back under that assistant's name.",
    "Keep every assistant separate. Do not combine ChatGPT (Chad) with Scout. Do not combine Muse #1 with Muse #2. Do not attribute one person's work to another.",
    "Phase 1 is manual. The public control room cannot contact an assistant or read the private lab Doc or Sheet. Copying text does not send it. A missing reply is not a completed check-in.",
    "Muse #1 still handles Facebook, Instagram, and Threads. Do not post to those accounts from this board. The owner enters Muse #1's reports by hand.",
    "You and Relay are the only seats the owner said have credential-vault access. Do not put vault contents or private file addresses on the public board or in a repository.",
    "Do not change the615hideaway.com, its repository, its database, or its deployment.",
  ].join("\n\n"),
  relay: [
    "You are Relay, Communications Coordinator of the 615 Hideaway AI team.",
    "The owner or GB prepares the assignment and selects the recipients. Contact only those seats. Bring each reply back under the author's name. A missing reply stays missing.",
    "Do not treat Failed, Unavailable, Waiting, or Not yet requested as a completed check-in. No updates is a real reply only when a reply was actually received.",
    "The public control room cannot send a message for you. Paste each copy into that assistant's own app.",
    "You and GB are the only seats the owner said have credential-vault access. Do not put vault contents or private file addresses on the public board.",
    "Do not post to Facebook, Instagram, or Threads. Do not change the615hideaway.com.",
  ].join("\n\n"),
  muse1: [
    "You are Muse #1 on the 615 Hideaway AI team.",
    "Your role is Facebook, Instagram, and Threads. Keep that role. You are not Muse #2.",
    "This board does not post to those accounts. Your reports currently come through the owner and are entered manually.",
    "Do not change the615hideaway.com, its repository, its database, or its deployment.",
  ].join("\n\n"),
};

const blockedPatterns = [
  [/docs\.google\.com/i, "Private Google Doc links stay off records prepared on this public site."],
  [/drive\.google\.com/i, "Private Google Drive links stay off records prepared on this public site."],
  [/calendar\.google\.com/i, "Calendar links stay off records prepared on this public site."],
  [/supabase\.co/i, "That address does not belong in a board record."],
  [/service_role/i, "That value does not belong in a board record."],
  [/api[_-]?key/i, "That value does not belong in a board record."],
  [/access[_-]?token/i, "That value does not belong in a board record."],
  [/\bpassword\b/i, "Do not put a password in a board record."],
  [/\bsecret\b/i, "Do not put a secret in a board record."],
  [/bearer\s+[a-z0-9]/i, "That value does not belong in a board record."],
  [/eyJ[A-Za-z0-9_-]{20,}/, "That value does not belong in a board record."],
];

function value(id) {
  return document.querySelector(id).value.trim();
}

function selectedRecipients() {
  return [...document.querySelectorAll("input[name=recipient]:checked")].map((box) => box.value);
}

function pad(number) {
  return String(number).padStart(2, "0");
}

function nowParts() {
  const date = new Date();
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return { local: `${day} ${time}`, input: `${day}T${time}` };
}

function stamp(id) {
  document.querySelector(id).value = nowParts().input;
}

function blockedReason(text) {
  for (const [pattern, reason] of blockedPatterns) {
    if (pattern.test(text)) return reason;
  }
  return "";
}

function csvField(raw) {
  let field = String(raw ?? "");
  if (/^[=+\-@]/.test(field)) field = `'${field}`;
  if (/[",\n]/.test(field)) return `"${field.replace(/"/g, '""')}"`;
  return field;
}

function sheetRow(fields) {
  return columns.map((key) => csvField(fields[key] || "")).join(",");
}

function responseTime(start, end) {
  if (!start || !end) return "Not measured";
  const from = new Date(start);
  const to = new Date(end);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return "Not measured";
  const minutes = Math.round((to - from) / 60000);
  if (minutes < 0) return "Not calculated. The reply time is earlier than the request time.";
  return `${minutes} minutes, from the two times entered on this form`;
}

function checkinResult(status, noUpdates) {
  if (status === "Received" && noUpdates) return "Completed check-in: no updates.";
  if (status === "Received") return "Completed response. This is a received reply, not a missing one.";
  return `Not a completed check-in. Status: ${status}.`;
}

async function copyText(text, note, preview) {
  const reason = blockedReason(text);
  if (reason) {
    note.textContent = reason;
    return false;
  }
  preview.value = text;
  preview.focus();
  preview.select();
  let copied = false;
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      copied = false;
    }
  }
  note.textContent = copied
    ? "Copied. This does not send it, and it is not stored on the board."
    : "Clipboard was not available. The text is selected above. Copy it by hand. It has not been sent or stored.";
  return true;
}

function assignmentMessage(person) {
  const copiedAt = nowParts().local;
  return [
    `To: ${person}`,
    `From: ${value("#relay-from")}`,
    `Assignment: ${value("#relay-title")}`,
    `Copied at: ${copiedAt}`,
    "Copied at is the time this text was prepared. It is not a send time.",
    "",
    value("#relay-body"),
    "",
    `Paste this into ${person}'s own app. Copying it here does not send it.`,
  ].join("\n");
}

function assignmentFields(person) {
  return {
    "Record type": "assignment",
    "Title or assignment": value("#relay-title"),
    Person: person,
    "Entered by": value("#relay-from"),
    "Recorded at": nowParts().local,
    Status: "Not yet requested",
    Source: "Draft prepared on the public control room. Not sent.",
    "Check-in result": "Not a check-in.",
    "Response time": "Not measured",
    Notes: value("#relay-body"),
  };
}

function validateAssignment() {
  if (!value("#relay-from")) return "Choose who the assignment is from.";
  if (!value("#relay-title")) return "Write the assignment title.";
  if (!value("#relay-body")) return "Write the message.";
  if (!selectedRecipients().length) return "Select at least one recipient.";
  return "";
}

function paintRecipientActions() {
  const box = document.querySelector("#relay-actions");
  box.replaceChildren();
  const names = selectedRecipients();
  if (!names.length) {
    const note = document.createElement("p");
    note.className = "hint";
    note.textContent = "Select at least one recipient.";
    box.append(note);
    return;
  }
  for (const name of names) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `Copy for ${name}`;
    button.addEventListener("click", () => copyOne(name));
    box.append(button);
  }
  const log = document.createElement("button");
  log.type = "button";
  log.className = "quiet";
  log.textContent = "Copy log rows";
  log.addEventListener("click", () => copyLogRows(names));
  box.append(log);
}

async function copyOne(name) {
  const note = document.querySelector("#relay-note");
  const problem = validateAssignment();
  if (problem) {
    note.textContent = problem;
    return;
  }
  if (!selectedRecipients().includes(name)) {
    note.textContent = "That recipient is not selected.";
    return;
  }
  await copyText(assignmentMessage(name), note, document.querySelector("#relay-preview"));
}

async function copyLogRows(names) {
  const note = document.querySelector("#relay-note");
  const problem = validateAssignment();
  if (problem) {
    note.textContent = problem;
    return;
  }
  const rows = names.map((name) => sheetRow(assignmentFields(name))).join("\n");
  const copied = await copyText(rows, note, document.querySelector("#relay-preview"));
  if (copied) {
    note.textContent = "Copied log rows. Status stays Not yet requested. This does not send them, and they are not stored on the board.";
  }
}

function replyData() {
  const noUpdates = document.querySelector("#reply-no-updates").checked;
  const status = value("#reply-status");
  return {
    noUpdates,
    status,
    fields: {
      "Record type": "reply",
      "Title or assignment": value("#reply-assignment"),
      Person: value("#reply-author"),
      "Entered by": value("#reply-entered-by"),
      "Recorded at": value("#reply-seen").replace("T", " "),
      Status: status,
      Source: value("#reply-source"),
      "Check-in result": checkinResult(status, noUpdates),
      "Response time": responseTime(value("#reply-requested"), value("#reply-seen")),
      Notes: noUpdates ? "No updates." : value("#reply-body"),
    },
  };
}

function validateReply() {
  const data = replyData();
  if (!data.fields["Title or assignment"]) return "Write the assignment this reply belongs to.";
  if (!data.fields.Person) return "Choose the author of the reply.";
  if (!data.fields["Entered by"]) return "Choose who entered this.";
  if (!data.status) return "Choose a status.";
  if (data.noUpdates && data.status !== "Received") {
    return "No updates counts only when the status is Received. Otherwise uncheck it.";
  }
  if (data.status === "Received" && !data.noUpdates && !data.fields.Notes) {
    return "Write the reply, or check No updates.";
  }
  if (!data.fields["Recorded at"]) return "Add the time you saw the reply. The page will not invent one.";
  if (!data.fields.Source) return "Say where this reply was seen.";
  return "";
}

function replyText(data) {
  const fields = data.fields;
  return [
    "Record type: reply",
    `Assignment: ${fields["Title or assignment"]}`,
    `Author: ${fields.Person}`,
    `Entered by: ${fields["Entered by"]}`,
    `Reply seen at: ${fields["Recorded at"]}`,
    `Status: ${fields.Status}`,
    `Source: ${fields.Source}`,
    `Check-in result: ${fields["Check-in result"]}`,
    `Response time: ${fields["Response time"]}`,
    "",
    fields.Notes,
    "",
    "This copy is not stored on the board, and it does not change the team panels.",
  ].join("\n");
}

function setAnswersDisabled(box, selectors) {
  const off = box.checked;
  for (const selector of selectors) document.querySelector(selector).disabled = off;
}

function checkData() {
  const noUpdates = document.querySelector("#check-no-updates").checked;
  const status = value("#check-status");
  const read = (id) => {
    if (noUpdates) return "No updates.";
    const text = value(id);
    if (text) return text;
    return status === "Received" ? "" : "No response recorded.";
  };
  return {
    noUpdates,
    status,
    fields: {
      "Record type": "check-in",
      "Title or assignment": "Manual check-in",
      Person: value("#check-who"),
      "Entered by": value("#check-entered-by"),
      "Recorded at": value("#check-recorded").replace("T", " "),
      Status: status,
      Source: value("#check-source"),
      "Check-in result": checkinResult(status, noUpdates),
      "Working on": read("#check-q1"),
      Completed: read("#check-q2"),
      "Waiting on": read("#check-q3"),
      Blocked: read("#check-q4"),
      Recommendation: read("#check-q5"),
      "Response time": "Not measured",
    },
  };
}

function validateCheck() {
  const data = checkData();
  if (!data.fields.Person) return "Choose the assistant.";
  if (!data.fields["Entered by"]) return "Choose who entered this.";
  if (!data.status) return "Choose a status.";
  if (data.noUpdates && data.status !== "Received") {
    return "No updates counts only when the status is Received. Otherwise uncheck it.";
  }
  if (!data.fields["Recorded at"]) return "Add the time of this check-in. The page will not invent one.";
  if (!data.fields.Source) return "Say where this check-in was seen.";
  if (data.status === "Received" && !data.noUpdates) {
    const missing = ["Working on", "Completed", "Waiting on", "Blocked", "Recommendation"]
      .filter((key) => !data.fields[key]);
    if (missing.length) return "A received check-in needs all five answers. If one was not given, write that.";
  }
  return "";
}

function checkText(data) {
  const fields = data.fields;
  return [
    "Record type: check-in",
    `Assistant: ${fields.Person}`,
    `Entered by: ${fields["Entered by"]}`,
    `Recorded at: ${fields["Recorded at"]}`,
    `Status: ${fields.Status}`,
    `Source: ${fields.Source}`,
    `Check-in result: ${fields["Check-in result"]}`,
    `1. What are you working on? ${fields["Working on"]}`,
    `2. What have you completed? ${fields.Completed}`,
    `3. What are you waiting on? ${fields["Waiting on"]}`,
    `4. What is blocked? ${fields.Blocked}`,
    `5. What do you recommend next? ${fields.Recommendation}`,
    "",
    "This copy is not stored on the board. It is not a scheduled check-in.",
  ].join("\n");
}

function publicLink(raw) {
  if (!raw) return "";
  let url;
  try {
    url = new URL(raw);
  } catch {
    return "That source link is not a valid URL. Leave it blank if you do not have a public link.";
  }
  if (url.protocol !== "https:") return "A source link needs to be https, or left blank.";
  return "";
}

function findingData() {
  return {
    "Record type": "finding",
    "Title or assignment": value("#finding-title"),
    Person: value("#finding-source"),
    "Recorded at": nowParts().local,
    Source: value("#finding-link") || "No public link",
    Uncertainty: value("#finding-uncertainty"),
    Decision: value("#finding-decision"),
    Notes: value("#finding-notes"),
    "Check-in result": "Not a check-in.",
    "Response time": "Not measured",
  };
}

function validateFinding() {
  const data = findingData();
  if (!data["Title or assignment"]) return "Write a title.";
  if (!data.Person) return "Choose the source.";
  if (!data.Notes && !data.Decision) return "Write the finding or the decision.";
  return publicLink(value("#finding-link"));
}

function findingText(data) {
  return [
    "Record type: finding",
    `Title: ${data["Title or assignment"]}`,
    `Source: ${data.Person}`,
    `Public link: ${data.Source}`,
    `Uncertainty: ${data.Uncertainty}`,
    `Decision: ${data.Decision || "None recorded"}`,
    `Prepared at: ${data["Recorded at"]}`,
    "",
    data.Notes || "None recorded",
    "",
    "This copy is not stored on the board.",
  ].join("\n");
}

function roomText() {
  return [
    "Open Room",
    `Author: ${value("#room-author")}`,
    `Prepared at: ${nowParts().local}`,
    "This line is not posted on the board.",
    "",
    value("#room-body"),
  ].join("\n");
}

function saved(kind) {
  return localStorage.getItem(linkFields[kind].key) || "";
}

function paintLinks() {
  for (const [kind, field] of Object.entries(linkFields)) {
    const url = saved(kind);
    field.open.href = url || field.fallback;
    field.open.textContent = url ? `Open ${field.label}` : `Create ${field.label}`;
    field.state.textContent = url
      ? "Saved in this browser only. Not shared and not published."
      : `No ${field.label} saved in this browser yet.`;
    const input = document.querySelector("#links").elements[kind];
    if (input && !input.value) input.value = url;
  }
}

function dirty() {
  const fields = document.querySelectorAll("textarea, input[type=text], input[type=url]");
  for (const field of fields) {
    if (field.readOnly) continue;
    if (field.value.trim()) return true;
  }
  return false;
}

document.querySelector("#links").addEventListener("submit", (event) => {
  event.preventDefault();
  const rejected = [];
  const savedNames = [];
  for (const [kind, field] of Object.entries(linkFields)) {
    const raw = document.querySelector("#links").elements[kind].value.trim();
    if (!raw) continue;
    let url;
    try {
      url = new URL(raw);
    } catch {
      rejected.push(field.label);
      continue;
    }
    if (url.protocol !== "https:" || !field.test(url)) {
      rejected.push(field.label);
      continue;
    }
    localStorage.setItem(field.key, url.toString());
    savedNames.push(field.label);
  }
  paintLinks();
  const note = document.querySelector("#form-note");
  if (rejected.length) {
    note.textContent = `Not saved: ${rejected.join(" and ")}. Use an https link for that Google file. Nothing was published.`;
    return;
  }
  note.textContent = savedNames.length
    ? `Saved in this browser only: ${savedNames.join(" and ")}. Not shared. Not published.`
    : "Nothing new to save.";
});

document.querySelector("#clear-links").addEventListener("click", () => {
  for (const field of Object.values(linkFields)) localStorage.removeItem(field.key);
  document.querySelector("#links").reset();
  document.querySelector("#form-note").textContent = "Cleared from this browser. Nothing was published.";
  paintLinks();
});

document.querySelector("#show-brief").addEventListener("click", async () => {
  const who = value("#brief-who");
  const note = document.querySelector("#copy-note");
  if (!briefs[who]) {
    note.textContent = "Choose a seat.";
    return;
  }
  await copyText(briefs[who], note, document.querySelector("#brief"));
});

document.querySelector("#relay-form").addEventListener("change", paintRecipientActions);
document.querySelector("#use-draft-title").addEventListener("click", () => {
  const title = value("#relay-title");
  const note = document.querySelector("#reply-note");
  if (!title) {
    note.textContent = "Write the assignment title first.";
    return;
  }
  document.querySelector("#reply-assignment").value = title;
  note.textContent = "Draft title copied into the reply form. Nothing was sent.";
});

document.querySelector("#reply-no-updates").addEventListener("change", (event) => {
  setAnswersDisabled(event.target, ["#reply-body"]);
});

document.querySelector("#stamp-reply-seen").addEventListener("click", () => stamp("#reply-seen"));

document.querySelector("#reply-copy-doc").addEventListener("click", async () => {
  const note = document.querySelector("#reply-note");
  const problem = validateReply();
  if (problem) {
    note.textContent = problem;
    return;
  }
  await copyText(replyText(replyData()), note, document.querySelector("#reply-preview"));
});

document.querySelector("#reply-copy-sheet").addEventListener("click", async () => {
  const note = document.querySelector("#reply-note");
  const problem = validateReply();
  if (problem) {
    note.textContent = problem;
    return;
  }
  await copyText(sheetRow(replyData().fields), note, document.querySelector("#reply-preview"));
});

document.querySelector("#check-no-updates").addEventListener("change", (event) => {
  setAnswersDisabled(event.target, ["#check-q1", "#check-q2", "#check-q3", "#check-q4", "#check-q5"]);
});

document.querySelector("#stamp-check").addEventListener("click", () => stamp("#check-recorded"));

document.querySelector("#check-copy-doc").addEventListener("click", async () => {
  const note = document.querySelector("#check-note");
  const problem = validateCheck();
  if (problem) {
    note.textContent = problem;
    return;
  }
  await copyText(checkText(checkData()), note, document.querySelector("#check-preview"));
});

document.querySelector("#check-copy-sheet").addEventListener("click", async () => {
  const note = document.querySelector("#check-note");
  const problem = validateCheck();
  if (problem) {
    note.textContent = problem;
    return;
  }
  await copyText(sheetRow(checkData().fields), note, document.querySelector("#check-preview"));
});

document.querySelector("#room-copy").addEventListener("click", async () => {
  const note = document.querySelector("#room-note");
  if (!value("#room-author")) {
    note.textContent = "Choose the author.";
    return;
  }
  if (!value("#room-body")) {
    note.textContent = "Write the message.";
    return;
  }
  await copyText(roomText(), note, document.querySelector("#room-preview"));
});

async function copyFinding(asSheet) {
  const note = document.querySelector("#finding-note");
  const problem = validateFinding();
  if (problem) {
    note.textContent = problem;
    return;
  }
  const data = findingData();
  const text = asSheet ? sheetRow(data) : findingText(data);
  await copyText(text, note, document.querySelector("#finding-preview"));
}

document.querySelector("#finding-copy").addEventListener("click", () => copyFinding(false));
document.querySelector("#finding-copy-sheet").addEventListener("click", () => copyFinding(true));

for (const link of document.querySelectorAll(".nav a")) {
  link.addEventListener("click", () => {
    for (const other of document.querySelectorAll(".nav a")) other.removeAttribute("aria-current");
    link.setAttribute("aria-current", "page");
  });
}

window.addEventListener("beforeunload", (event) => {
  if (!dirty()) return;
  event.preventDefault();
  event.returnValue = "";
});

const panelNames = [...document.querySelectorAll("[data-member]")].map((panel) => panel.dataset.member);
const recipientNames = [...document.querySelectorAll("input[name=recipient]")].map((box) => box.value);
if (panelNames.join("\n") !== recipientNames.join("\n")) {
  document.querySelector("#relay-note").textContent = "Roster mismatch. Recipient list does not match the team panels.";
}

try {
  localStorage.removeItem("hideaway-team-calendar");
  paintLinks();
} catch {
  document.querySelector("#form-note").textContent = "This browser is not keeping the Doc or Sheet links. The rest of the page still works. Nothing was published.";
}
paintRecipientActions();
