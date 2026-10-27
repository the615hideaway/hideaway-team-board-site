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

const relayColumns = [
  "Recorded at",
  "Assignment",
  "AI Name",
  "Row kind",
  "Message or reply",
  "Status",
  "Source",
  "Blocker or follow-up",
  "Entered by",
];

const checkinColumns = [
  "Recorded at",
  "AI Name",
  "Assignment or check-in",
  "Status",
  "Working on",
  "Completed",
  "Waiting on",
  "Blocked",
  "Recommendation",
  "Source",
  "Entered by",
  "Check-in result",
];

const findingColumns = [
  "Recorded at",
  "AI Name",
  "Title",
  "Finding",
  "Source link",
  "Uncertainty",
  "Decision",
  "Decision date",
  "Entered by",
];

const briefs = {
  gb: [
    "You are GB, Chief Coordinator of the 615 Hideaway AI team.",
    "The owner directs the project. You organize priorities, assignments, and progress. Relay carries messages only to the assistants the owner or you select, and brings each reply back under that assistant's name.",
    "Keep every assistant separate. Do not combine ChatGPT (Chad) with Scout. Do not combine Muse #1 with Muse #2. Do not attribute one person's work to another.",
    "The public control room does not contact an assistant. It reads the Sheet only through the web app after the team password is accepted, and it does not write the Sheet. Copying text does not send it. A missing reply is not a completed check-in.",
    "Muse #1 still handles Facebook, Instagram, and Threads. Do not post to those accounts from this board. The owner enters Muse #1's reports by hand.",
    "You and Relay are the only seats the owner said have credential-vault access. Do not put vault contents or private file addresses on the public board or in a repository.",
    "Do not change the615hideaway.com, its repository, its database, or its deployment.",
  ].join("\n\n"),
  relay: [
    "You are Relay, Communications Coordinator of the 615 Hideaway AI team.",
    "The owner or GB prepares the assignment and selects the recipients. Contact only those seats. Bring each reply back under the author's name. A missing reply stays missing.",
    "Do not treat failed, unavailable, waiting, or not requested as a completed check-in. No updates is a real reply only when a reply was actually received. Each reply is its own row, under that assistant's AI Name.",
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

function sheetRow(columnList, fields) {
  return columnList.map((key) => csvField(fields[key] || "")).join(",");
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
  if (status === "received" && noUpdates) return "Completed check-in: no updates.";
  if (status === "received") return "Completed response. This is a received reply, not a missing one.";
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
    "Recorded at": nowParts().local,
    Assignment: value("#relay-title"),
    "AI Name": person,
    "Row kind": "assignment",
    "Message or reply": value("#relay-body"),
    Status: "not requested",
    Source: "Draft prepared on the public control room. Not sent.",
    "Blocker or follow-up": "",
    "Entered by": value("#relay-from"),
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
  const rows = names.map((name) => sheetRow(relayColumns, assignmentFields(name))).join("\n");
  const copied = await copyText(rows, note, document.querySelector("#relay-preview"));
  if (copied) {
    note.textContent = "Copied Relay rows. Status stays not requested. This does not send them, and it does not write the Sheet.";
  }
}

function replyData() {
  const noUpdates = document.querySelector("#reply-no-updates").checked;
  const status = value("#reply-status");
  return {
    noUpdates,
    status,
    fields: {
      "Recorded at": value("#reply-seen").replace("T", " "),
      Assignment: value("#reply-assignment"),
      "AI Name": value("#reply-author"),
      "Row kind": "reply",
      "Message or reply": noUpdates ? "No updates." : value("#reply-body"),
      Status: status,
      Source: value("#reply-source"),
      "Blocker or follow-up": "",
      "Entered by": value("#reply-entered-by"),
      "Check-in result": checkinResult(status, noUpdates),
      "Response time": responseTime(value("#reply-requested"), value("#reply-seen")),
    },
  };
}

function validateReply() {
  const data = replyData();
  if (!data.fields.Assignment) return "Write the assignment this reply belongs to.";
  if (!data.fields["AI Name"]) return "Choose the author of the reply.";
  if (!data.fields["Entered by"]) return "Choose who entered this.";
  if (!data.status) return "Choose a status.";
  if (data.noUpdates && data.status !== "received") {
    return "No updates counts only when the status is received. Otherwise uncheck it.";
  }
  if (data.status === "received" && !data.noUpdates && !data.fields["Message or reply"]) {
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
    `Assignment: ${fields.Assignment}`,
    `AI Name: ${fields["AI Name"]}`,
    `Entered by: ${fields["Entered by"]}`,
    `Reply seen at: ${fields["Recorded at"]}`,
    `Status: ${fields.Status}`,
    `Source: ${fields.Source}`,
    `Check-in result: ${fields["Check-in result"]}`,
    `Response time: ${fields["Response time"]}`,
    "",
    fields["Message or reply"],
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
    return status === "received" ? "" : "No response recorded.";
  };
  return {
    noUpdates,
    status,
    fields: {
      "Recorded at": value("#check-recorded").replace("T", " "),
      "AI Name": value("#check-who"),
      "Assignment or check-in": "Manual check-in",
      Status: status,
      "Working on": read("#check-q1"),
      Completed: read("#check-q2"),
      "Waiting on": read("#check-q3"),
      Blocked: read("#check-q4"),
      Recommendation: read("#check-q5"),
      Source: value("#check-source"),
      "Entered by": value("#check-entered-by"),
      "Check-in result": checkinResult(status, noUpdates),
    },
  };
}

function validateCheck() {
  const data = checkData();
  if (!data.fields["AI Name"]) return "Choose the assistant.";
  if (!data.fields["Entered by"]) return "Choose who entered this.";
  if (!data.status) return "Choose a status.";
  if (data.noUpdates && data.status !== "received") {
    return "No updates counts only when the status is received. Otherwise uncheck it.";
  }
  if (!data.fields["Recorded at"]) return "Add the time of this check-in. The page will not invent one.";
  if (!data.fields.Source) return "Say where this check-in was seen.";
  if (data.status === "received" && !data.noUpdates) {
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
    `AI Name: ${fields["AI Name"]}`,
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
    "Recorded at": nowParts().local,
    "AI Name": value("#finding-source"),
    Title: value("#finding-title"),
    Finding: value("#finding-notes"),
    "Source link": value("#finding-link"),
    Uncertainty: value("#finding-uncertainty"),
    Decision: value("#finding-decision"),
    "Decision date": value("#finding-decision-date"),
    "Entered by": "",
  };
}

function validateFinding() {
  const data = findingData();
  if (!data.Title) return "Write a title.";
  if (!data["AI Name"]) return "Choose the source.";
  if (!data.Finding && !data.Decision) return "Write the finding or the decision.";
  return publicLink(data["Source link"]);
}

function findingText(data) {
  return [
    "Record type: finding",
    `Title: ${data.Title}`,
    `AI Name: ${data["AI Name"]}`,
    `Public link: ${data["Source link"] || "No public link"}`,
    `Uncertainty: ${data.Uncertainty}`,
    `Decision: ${data.Decision || "None recorded"}`,
    `Decision date: ${data["Decision date"] || "None recorded"}`,
    `Prepared at: ${data["Recorded at"]}`,
    "",
    data.Finding || "None recorded",
    "",
    "This copy is not stored on the board, and it does not write the Sheet.",
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
  const fields = document.querySelectorAll("textarea, input[type=text], input[type=url], input[type=password]");
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
  await copyText(sheetRow(relayColumns, replyData().fields), note, document.querySelector("#reply-preview"));
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
  await copyText(sheetRow(checkinColumns, checkData().fields), note, document.querySelector("#check-preview"));
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
  const text = asSheet ? sheetRow(findingColumns, data) : findingText(data);
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

const ENDPOINT_KEY = "hideaway-team-endpoint";
const DEFAULT_ENDPOINT = "https://script.google.com/macros/s/AKfycbwCvUn4sXa0tJZmM0IVMMo1xO40EFNSTl05Bqvt20vYllKrguWDFKeI_WZCHst0VZYOvQ/exec";
const SEATS = [...document.querySelectorAll("[data-member]")].map((panel) => panel.dataset.member);
const KNOWN_NAMES = new Set([...SEATS, "Owner"]);
const STANDING_PRIORITIES = [
  "Test this control room with the real team.",
  "Relay records real replies in the Sheet, one row per assistant.",
  "Keep this project off the615hideaway.com.",
];

const panelDefaults = new Map();
const rosterDefaults = new Map();
let sessionPassword = "";
let lastGood = null;
let boardOpen = false;
let loadingSheet = false;
let requestSerial = 0;

for (const panel of document.querySelectorAll("[data-member]")) {
  const fields = {};
  for (const block of panel.querySelectorAll("dl div")) {
    const dd = block.querySelector("dd");
    fields[block.querySelector("dt").textContent] = {
      text: dd.textContent,
      empty: dd.classList.contains("empty"),
    };
  }
  panelDefaults.set(panel.dataset.member, fields);
}

for (const link of document.querySelectorAll(".roster a")) {
  rosterDefaults.set(link.getAttribute("href"), link.querySelector(".state").textContent);
}

const muse1Note = document.querySelector("#muse1-note").textContent;

function endpointUrl(raw) {
  let url;
  try {
    url = new URL(String(raw || "").trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "script.google.com") return null;
  if (!/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)) return null;
  url.search = "";
  url.hash = "";
  return url;
}

function savedEndpoint() {
  try {
    const parsed = endpointUrl(localStorage.getItem(ENDPOINT_KEY) || "");
    return parsed ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function rememberEndpoint(url) {
  try {
    localStorage.setItem(ENDPOINT_KEY, url.toString());
    return true;
  } catch {
    return false;
  }
}

function validMonth(raw) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(raw || ""));
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

function sheetError(message) {
  const note = document.querySelector("#sheet-error");
  note.classList.add("bad");
  note.textContent = message;
}

function clearSheetError() {
  const note = document.querySelector("#sheet-error");
  note.classList.remove("bad");
  note.textContent = "";
}

function cell(row, key) {
  const item = row[key];
  if (typeof item !== "string" && typeof item !== "number") return "";
  return String(item).trim();
}

function tabState(tab) {
  if (!tab || typeof tab !== "object" || tab.missing) {
    return { missing: true, rows: [], title: tab && tab.title ? String(tab.title) : "" };
  }
  const rows = Array.isArray(tab.rows) ? tab.rows.filter((row) => row && typeof row === "object") : [];
  return { missing: false, rows, title: tab.title ? String(tab.title) : "" };
}

function payloadOk(data) {
  return Boolean(data && data.ok === true && data.tabs && typeof data.tabs === "object");
}

function joinBits(parts) {
  return parts.map((part) => String(part || "").trim()).filter(Boolean).join(" · ");
}

function setField(panel, label, text, isEmpty, kind) {
  for (const block of panel.querySelectorAll("dl div")) {
    if (block.querySelector("dt").textContent !== label) continue;
    const dd = block.querySelector("dd");
    dd.textContent = text;
    dd.classList.toggle("empty", isEmpty);
    dd.classList.remove("is-checkin", "is-missed");
    if (kind) dd.classList.add(kind);
    return;
  }
}

function fillList(id, lines, emptyText) {
  const list = document.querySelector(id);
  list.replaceChildren();
  if (!lines.length) {
    const item = document.createElement("li");
    item.className = "empty";
    item.textContent = emptyText;
    list.append(item);
    return;
  }
  for (const line of lines) {
    const item = document.createElement("li");
    item.textContent = line;
    list.append(item);
  }
}

function personLabel(row) {
  const name = cell(row, "AI Name");
  return name ? `AI Name: ${name}` : "Overall";
}

function boardLine(row) {
  return joinBits([
    personLabel(row),
    cell(row, "Title"),
    cell(row, "Detail"),
    cell(row, "Status"),
    cell(row, "Blocker or follow-up"),
  ]);
}

function received(row) {
  return cell(row, "Status").toLowerCase() === "received";
}

function rowKind(row) {
  const status = cell(row, "Status").toLowerCase();
  if (status === "received") return "is-checkin";
  if (status === "failed" || status === "waiting" || status === "unavailable" || status === "not requested" || status === "no reply") {
    return "is-missed";
  }
  return "";
}

function checkKind(row) {
  return received(row) ? "is-checkin" : "is-missed";
}

function statusLabel(row) {
  const status = cell(row, "Status").toLowerCase();
  if (status === "received") return "Check-in received";
  if (status === "failed") return "Failed. Not a check-in.";
  if (status === "unavailable") return "Unavailable. Not a check-in.";
  if (status === "waiting" || status === "not requested" || status === "no reply" || !status) {
    return "No reply. Not a check-in.";
  }
  return `${cell(row, "Status")}. Not a check-in.`;
}

function restoreStandingPriorities(note) {
  document.querySelector("#priority-note").textContent = note;
  const list = document.querySelector("#priority-list");
  list.replaceChildren();
  for (const line of STANDING_PRIORITIES) {
    const item = document.createElement("li");
    item.textContent = line;
    list.append(item);
  }
}

function restoreClosedBoard() {
  restoreStandingPriorities("Shown from the owner’s instructions. Not loaded from the Sheet.");
  fillList("#progress-list", [], "No confirmed work in progress.");
  fillList("#completed-list", [], "No confirmed completed work.");
  fillList("#waiting-list", [], "No confirmed item waiting on a reply.");
  fillList("#sheet-decisions", [], "No owner-decision rows loaded from the Sheet.");
  fillList("#relay-log", [], "No Relay rows loaded.");
  document.querySelector("#checkin-empty").hidden = false;
  document.querySelector("#checkin-empty").textContent = "No check-ins recorded. A missing reply is not a completed check-in.";
  document.querySelector("#checkin-log").replaceChildren();
  document.querySelector("#finding-empty").hidden = false;
  document.querySelector("#finding-empty").textContent = "No findings, decisions, or assignment history on this page.";
  document.querySelector("#finding-log").replaceChildren();
  document.querySelector("#unmatched").hidden = true;
  document.querySelector("#unmatched").textContent = "";
  document.querySelector("#sheet-live").textContent = "No Sheet records are loaded.";
  const warning = document.querySelector("#sheet-warning");
  warning.classList.remove("bad");
  warning.textContent = "";
  document.querySelector("#muse1-note").textContent = muse1Note;
  for (const [name, fields] of panelDefaults) {
    const panel = [...document.querySelectorAll("[data-member]")].find((item) => item.dataset.member === name);
    for (const [label, saved] of Object.entries(fields)) setField(panel, label, saved.text, saved.empty);
  }
  for (const [href, text] of rosterDefaults) {
    const state = document.querySelector(`.roster a[href="${href}"] .state`);
    if (!state) continue;
    state.textContent = text;
    state.classList.remove("is-checkin", "is-missed");
  }
}

function showBoard() {
  boardOpen = true;
  document.querySelector("#gate").hidden = true;
  document.querySelector("#board").hidden = false;
  document.querySelector(".nav").hidden = false;
  document.querySelector(".skip").setAttribute("href", "#status");
  document.querySelector("#board-month").value = document.querySelector("#sheet-month").value;
  document.querySelector("#source-title").focus();
}

function lockBoard() {
  sessionPassword = "";
  lastGood = null;
  boardOpen = false;
  document.querySelector("#sheet-key").value = "";
  restoreClosedBoard();
  document.querySelector("#board").hidden = true;
  document.querySelector(".nav").hidden = true;
  document.querySelector("#gate").hidden = false;
  document.querySelector(".skip").setAttribute("href", "#gate");
  document.querySelector("#sheet-state").textContent = "Closed. The password was not saved.";
  document.querySelector("#sheet-key").focus();
}

function fillRows(id, rows, emptyText, textFor, kindFor) {
  const list = document.querySelector(id);
  list.replaceChildren();
  if (!rows.length) {
    const item = document.createElement("li");
    item.className = "empty";
    item.textContent = emptyText;
    list.append(item);
    return;
  }
  for (const row of rows) {
    const item = document.createElement("li");
    const kind = kindFor ? kindFor(row) : rowKind(row);
    if (kind) item.className = kind;
    item.textContent = textFor(row);
    list.append(item);
  }
}

function renderLog(listId, emptyId, rows, missingText, emptyText, lineFor) {
  const empty = document.querySelector(emptyId);
  const list = document.querySelector(listId);
  list.replaceChildren();
  if (!rows) {
    empty.hidden = false;
    empty.textContent = missingText;
    return;
  }
  if (!rows.length) {
    empty.hidden = false;
    empty.textContent = emptyText;
    return;
  }
  empty.hidden = true;
  for (const row of rows) {
    const item = document.createElement("li");
    const described = lineFor(row);
    item.className = described.kind || "";
    item.textContent = described.text;
    list.append(item);
  }
}

function renderWorkbook(payload, warning) {
  const month = typeof payload.month === "string" ? payload.month : "";
  const readAt = typeof payload.generatedAt === "string" ? payload.generatedAt : "";
  const live = [
    "Source: Google Sheet.",
    month ? `Month: ${month}.` : "",
    readAt ? `Last successful read: ${readAt}. That time is when the Sheet was read, not a check-in time.` : "",
  ];
  document.querySelector("#sheet-live").textContent = joinBits(live).replaceAll(" · ", " ");
  const warningNote = document.querySelector("#sheet-warning");
  warningNote.classList.toggle("bad", Boolean(warning));
  warningNote.textContent = warning || "";

  const board = tabState(payload.tabs.board);
  const checkins = tabState(payload.tabs.checkins);
  const relay = tabState(payload.tabs.relay);
  const findings = tabState(payload.tabs.findings);
  const boardRows = board.missing ? [] : board.rows;

  if (board.missing) {
    restoreStandingPriorities(`Board — ${month || "this month"} is missing. Another month was not used. Priorities below are the owner’s instructions, not Sheet rows.`);
    fillList("#progress-list", [], "No confirmed work in progress.");
    fillList("#completed-list", [], "No confirmed completed work.");
    fillList("#waiting-list", [], "No confirmed item waiting on a reply.");
  } else {
    const ofType = (type) => boardRows.filter((row) => cell(row, "Record type") === type);
    const priorities = ofType("Priority");
    if (!priorities.length) {
      restoreStandingPriorities("No priority rows in this month. Shown from the owner’s instructions. Not loaded from the Sheet.");
    } else {
      document.querySelector("#priority-note").textContent = "Loaded from the Sheet.";
      fillRows("#priority-list", priorities, "No confirmed priorities.", boardLine);
    }
    fillRows("#progress-list", ofType("In progress"), "No confirmed work in progress.", boardLine);
    fillRows("#completed-list", ofType("Completed"), "No confirmed completed work.", boardLine);
    fillRows("#waiting-list", ofType("Waiting"), "No confirmed item waiting on a reply.", boardLine);
  }

  const decisions = boardRows.filter((row) => cell(row, "Record type") === "Owner decision");
  fillRows("#sheet-decisions", decisions, "No owner-decision rows loaded from the Sheet.", boardLine);

  const unmatched = new Set();
  const namedRows = [...boardRows, ...checkins.rows, ...relay.rows, ...findings.rows];
  for (const row of namedRows) {
    const name = cell(row, "AI Name");
    if (name && !KNOWN_NAMES.has(name)) unmatched.add(name);
  }
  const unmatchedNote = document.querySelector("#unmatched");
  if (unmatched.size) {
    unmatchedNote.hidden = false;
    unmatchedNote.textContent = `Names on the Sheet that are not seats: ${[...unmatched].join(", ")}. They were not added to a panel.`;
  } else {
    unmatchedNote.hidden = true;
    unmatchedNote.textContent = "";
  }

  for (const name of SEATS) {
    const panel = [...document.querySelectorAll("[data-member]")].find((item) => item.dataset.member === name);
    const mine = (rows) => rows.filter((row) => cell(row, "AI Name") === name);
    const myBoard = mine(boardRows);
    const myChecks = mine(checkins.missing ? [] : checkins.rows);
    const myRelay = mine(relay.missing ? [] : relay.rows);
    const inProgress = myBoard.filter((row) => cell(row, "Record type") === "In progress");
    const assignment = inProgress.length ? boardLine(inProgress[inProgress.length - 1]) : "";
    setField(panel, "Current assignment", assignment || "No confirmed assignment", !assignment);

    const defaults = panelDefaults.get(name);
    const latestCheck = myChecks[myChecks.length - 1];
    const statusText = latestCheck ? statusLabel(latestCheck) : (defaults.Status.text);
    const statusKind = latestCheck ? checkKind(latestCheck) : "";
    setField(panel, "Status", statusText, false, statusKind);
    const rosterState = document.querySelector(`.roster a[href="#${panel.id}"] .state`);
    if (rosterState) {
      rosterState.textContent = statusText;
      rosterState.classList.remove("is-checkin", "is-missed");
      if (statusKind) rosterState.classList.add(statusKind);
    }

    const receivedChecks = myChecks.filter(received);
    const latestReceived = receivedChecks[receivedChecks.length - 1];
    const checkLine = latestReceived
      ? joinBits([
        cell(latestReceived, "Recorded at"),
        cell(latestReceived, "Check-in result") || "Received reply.",
        cell(latestReceived, "Source"),
      ])
      : "";
    setField(panel, "Latest confirmed check-in", checkLine || "No confirmed check-in", !checkLine);

    const completed = [];
    for (const row of myBoard) {
      if (cell(row, "Record type") === "Completed") {
        const line = boardLine(row);
        if (line) completed.push(line);
      }
    }
    for (const row of myChecks) {
      if (!received(row)) continue;
      const done = cell(row, "Completed");
      if (done) completed.push(done);
    }
    for (const row of myRelay) {
      if (!received(row) || cell(row, "Row kind").toLowerCase() !== "reply") continue;
      const message = cell(row, "Message or reply");
      if (message) completed.push(message);
    }
    setField(panel, "Completed work", completed.join(" · ") || "No confirmed completed work", !completed.length);

    const needs = [];
    for (const row of myChecks) {
      if (received(row)) {
        const blocked = cell(row, "Blocked");
        const waitingOn = cell(row, "Waiting on");
        if (blocked && blocked !== "No updates.") needs.push(blocked);
        if (waitingOn && waitingOn !== "No updates.") needs.push(waitingOn);
      } else {
        needs.push(joinBits([statusLabel(row), cell(row, "Waiting on"), cell(row, "Blocked")]));
      }
    }
    for (const row of myBoard) {
      const blocker = cell(row, "Blocker or follow-up");
      if (blocker) needs.push(blocker);
    }
    setField(panel, "Blockers or needs", needs.filter(Boolean).join(" · ") || "None recorded", !needs.filter(Boolean).length);

    const recommendations = [];
    for (const row of myChecks) {
      if (!received(row)) continue;
      const recommendation = cell(row, "Recommendation");
      if (recommendation && recommendation !== "No updates.") recommendations.push(recommendation);
    }
    setField(panel, "Recommendations", recommendations.join(" · ") || "None recorded", !recommendations.length);
  }

  const museRows = namedRows.some((row) => cell(row, "AI Name") === "Muse #1");
  document.querySelector("#muse1-note").textContent = museRows
    ? "Rows for Muse #1 on this page come from the Sheet. The board does not post."
    : muse1Note;

  renderLog(
    "#checkin-log",
    "#checkin-empty",
    checkins.missing ? null : checkins.rows,
    "Check-ins tab is missing. Nothing was substituted.",
    "No check-ins recorded. A missing reply is not a completed check-in.",
    (row) => ({
      kind: checkKind(row),
      text: joinBits([
        personLabel(row),
        cell(row, "Recorded at"),
        received(row) ? "Check-in received" : statusLabel(row),
        received(row) ? cell(row, "Check-in result") : "",
        received(row) ? cell(row, "Completed") : "",
      ]),
    }),
  );

  if (relay.missing) {
    fillList("#relay-log", [], "Relay Desk tab is missing. Nothing was substituted.");
  } else if (!relay.rows.length) {
    fillList("#relay-log", [], "No Relay rows loaded.");
  } else {
    fillRows("#relay-log", relay.rows, "No Relay rows loaded.", (row) => joinBits([
      personLabel(row),
      cell(row, "Recorded at"),
      cell(row, "Row kind"),
      received(row) ? "Check-in received" : statusLabel(row),
      cell(row, "Message or reply"),
    ]), checkKind);
  }

  renderLog(
    "#finding-log",
    "#finding-empty",
    findings.missing ? null : findings.rows,
    "Findings and Decisions tab is missing. Nothing was substituted.",
    "No findings, decisions, or assignment history on this page.",
    (row) => ({
      kind: "",
      text: joinBits([
        personLabel(row),
        cell(row, "Title"),
        cell(row, "Finding"),
        cell(row, "Decision"),
        cell(row, "Decision date"),
      ]),
    }),
  );
}

function requestJsonp(url) {
  return new Promise((resolve, reject) => {
    const callback = `hideawayTeam${Math.random().toString(36).slice(2, 12)}`;
    const script = document.createElement("script");
    const timer = window.setTimeout(() => finish(new Error("timeout")), 20000);
    function finish(error, data) {
      window.clearTimeout(timer);
      delete window[callback];
      script.remove();
      if (error) reject(error);
      else resolve(data);
    }
    window[callback] = (data) => finish(null, data);
    const withCallback = new URL(url.toString());
    withCallback.searchParams.set("callback", callback);
    script.src = withCallback.toString();
    script.onerror = () => finish(new Error("jsonp"));
    document.head.append(script);
  });
}

async function requestWorkbook(base, password, month) {
  const url = new URL(base.toString());
  url.searchParams.set("password", password);
  if (month) url.searchParams.set("month", month);
  try {
    const response = await fetch(url.toString(), { method: "GET", redirect: "follow", credentials: "omit" });
    const data = await response.json();
    if (!data || typeof data.ok !== "boolean") throw new Error("bad response");
    return data;
  } catch {
    return requestJsonp(url);
  }
}

async function readSheet(password) {
  const serial = ++requestSerial;
  clearSheetError();
  const parsed = endpointUrl(document.querySelector("#sheet-url").value);
  if (!parsed) {
    sheetError("Use the Apps Script web app address: https://script.google.com/macros/s/.../exec");
    return null;
  }
  if (!password) {
    sheetError("Enter the team password. It is not saved in this browser.");
    return null;
  }
  const monthRaw = value(boardOpen ? "#board-month" : "#sheet-month");
  if (monthRaw && !validMonth(monthRaw)) {
    sheetError("Month has to look like YYYY-MM, or be left blank.");
    return null;
  }
  document.querySelector("#sheet-url").value = parsed.toString();
  rememberEndpoint(parsed);
  let data;
  try {
    data = await requestWorkbook(parsed, password, monthRaw);
  } catch (error) {
    if (serial !== requestSerial) return { stale: true };
    throw error;
  }
  if (serial !== requestSerial) return { stale: true };
  if (!payloadOk(data)) {
    if (data && data.error === "bad month") sheetError("The web app rejected that month. No rows were loaded.");
    else if (data && data.error === "workbook is not configured") sheetError("The web app is not bound to the Sheet. No rows were loaded.");
    else sheetError("The web app refused this password. No rows were loaded.");
    return null;
  }
  return data;
}

document.querySelector("#sheet-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (loadingSheet) return;
  loadingSheet = true;
  const password = document.querySelector("#sheet-key").value;
  try {
    const data = await readSheet(password);
    if (!data || data.stale) return;
    sessionPassword = password;
    document.querySelector("#sheet-key").value = "";
    lastGood = data;
    renderWorkbook(data, "");
    showBoard();
  } catch {
    sheetError("The Sheet did not load. The board was not opened.");
  } finally {
    loadingSheet = false;
  }
});

document.querySelector("#sheet-clear").addEventListener("click", () => {
  try {
    localStorage.removeItem(ENDPOINT_KEY);
  } catch {
    // The address was only on this page.
  }
  document.querySelector("#sheet-url").value = DEFAULT_ENDPOINT;
  document.querySelector("#sheet-state").textContent = "Browser override cleared. The team web app address is filled in. The password was not saved.";
});

document.querySelector("#sheet-refresh").addEventListener("click", async () => {
  if (loadingSheet || !boardOpen || !lastGood || !sessionPassword) return;
  loadingSheet = true;
  const warning = "Refresh failed. Showing the last read from this page session. Reload clears it.";
  try {
    const data = await readSheet(sessionPassword);
    if (data && data.stale) return;
    if (!data) {
      renderWorkbook(lastGood, "Refresh was refused. Showing the last read from this page session. Reload clears it.");
      return;
    }
    lastGood = data;
    renderWorkbook(data, "");
  } catch {
    renderWorkbook(lastGood, warning);
  } finally {
    loadingSheet = false;
  }
});

document.querySelector("#sheet-lock").addEventListener("click", lockBoard);

try {
  localStorage.removeItem("hideaway-team-calendar");
  paintLinks();
  const savedUrl = savedEndpoint();
  document.querySelector("#sheet-url").value = savedUrl || DEFAULT_ENDPOINT;
  document.querySelector("#sheet-state").textContent = savedUrl && savedUrl !== DEFAULT_ENDPOINT
    ? "A different web app address is saved in this browser. The password is not saved. The board stays closed until the password is accepted."
    : "The team web app address is filled in. Enter the team password. It is not saved.";
} catch {
  document.querySelector("#form-note").textContent = "This browser is not keeping the Doc or Sheet links. The rest of the page still works. Nothing was published.";
}
paintRecipientActions();
