/**
 * Assignment Cover Page Generator
 * Original Format with Optimized Academic Typography
 * Pure Vanilla JS, Zero dependencies.
 */

/* The picker's universities. Each has a data/<id>.json written by
   scrapers/<id>.py, holding its faculties, departments and teachers. A file is
   fetched only when its university is picked, so a BUP student never downloads
   anyone else's directory. */
const UNIVERSITIES = [
  { id: "bup", short: "BUP", name: "Bangladesh University of Professionals" },
  { id: "aiub", short: "AIUB", name: "American International University-Bangladesh" },
  { id: "aust", short: "AUST", name: "Ahsanullah University of Science and Technology" },
  { id: "brac", short: "BRACU", name: "BRAC University" },
  { id: "bau", short: "BAU", name: "Bangladesh Agricultural University" },
  { id: "buet", short: "BUET", name: "Bangladesh University of Engineering and Technology" },
  { id: "butex", short: "BUTEX", name: "Bangladesh University of Textiles" },
  { id: "cu", short: "CU", name: "University of Chittagong" },
  { id: "cuet", short: "CUET", name: "Chittagong University of Engineering & Technology" },
  { id: "diu", short: "DIU", name: "Daffodil International University" },
  { id: "du", short: "DU", name: "University of Dhaka" },
  { id: "ewu", short: "EWU", name: "East West University" },
  { id: "iub", short: "IUB", name: "Independent University, Bangladesh" },
  { id: "iut", short: "IUT", name: "Islamic University of Technology" },
  { id: "jnu", short: "JnU", name: "Jagannath University" },
  { id: "ju", short: "JU", name: "Jahangirnagar University" },
  { id: "ku", short: "KU", name: "Khulna University" },
  { id: "kuet", short: "KUET", name: "Khulna University of Engineering & Technology" },
  { id: "nsu", short: "NSU", name: "North South University" },
  { id: "ru", short: "RU", name: "University of Rajshahi" },
  { id: "ruet", short: "RUET", name: "Rajshahi University of Engineering & Technology" },
  { id: "sust", short: "SUST", name: "Shahjalal University of Science and Technology" },
  { id: "uiu", short: "UIU", name: "United International University" },
  { id: "ulab", short: "ULAB", name: "University of Liberal Arts Bangladesh" },
  { id: "other", short: "Other", name: "Not listed, type it in" },
];
const OTHER = "other"; // has no data file: everything is typed, the crest uploaded

/* Cover formats. "bd" is the decorative cover Bangladeshi universities ask
   for; the rest follow APA 7, MLA 9 and Chicago (Turabian) as their manuals
   print them, plain on purpose, and a UK/Australian-style coursework sheet.
   Each has a template in index.html and a builder in assets/cover-pdf.js. */
const FORMATS = [
  { id: "bd", label: "Bangladeshi", desc: "Crest, masthead, Submitted To and By blocks" },
  { id: "apa", label: "APA 7", desc: "Plain centered title page, double-spaced" },
  { id: "mla", label: "MLA 9", desc: "No cover: a heading on your first page" },
  { id: "chicago", label: "Chicago / Turabian", desc: "Title a third down, your details below" },
  { id: "uk", label: "UK / Australian sheet", desc: "Details table and a signed declaration" },
];

const DEFAULT_DECLARATION = "I confirm that this assignment is my own work, that every source I used is acknowledged, and that it has not been submitted for assessment anywhere else. I understand that plagiarism and collusion are breaches of academic integrity.";

// Sentinel dropdown value: the department is typed rather than picked.
const MANUAL = "__manual";

// "Asst. Prof. Jane Doe" is how covers address a teacher.
const TITLE_PREFIX = {
  "Professor": "Prof.", "Distinguished Professor": "Prof.",
  "Associate Professor": "Assoc. Prof.", "Assistant Professor": "Asst. Prof.",
  "Senior Lecturer": "Sr. Lecturer", "Lecturer": "Lecturer",
};

const DEFAULT_DATA = {
  setupDone: false,
  format: "bd",
  paper: "a4",
  mlaTitlePage: false,
  subtitle: "",
  wordCount: "",
  declaration: DEFAULT_DECLARATION,
  univ: "bup",
  logo: "assets/bup_logo.svg",
  univName: "BANGLADESH UNIVERSITY OF PROFESSIONALS",
  headerCase: "header-caps",
  headerPt: 21,
  univTagline: "Excellence Through Knowledge",
  showTagline: true,
  univAddress: "Mirpur Cantonment, Dhaka-1216, Bangladesh",
  showAddress: true,
  deptManual: false,
  prefix: "Assignment on",
  topic: "Key Concepts of Auditing",
  courseTitle: "Taxation and Auditing",
  courseCode: "MKT-3104",
  teacherName: "Asst. Prof. Anamika Dey",
  teacherDept: "Department of Marketing",
  teacherAffiliation: "Bangladesh University of Professionals",
  submissionMode: "individual",
  members: [
    { name: "Md Fahim Montasir", id: "23251708117" }
  ],
  section: "A",
  session: "2022-2023",
  intake: "",
  studentDept: "Department of Marketing",
  submissionDate: new Date().toISOString().split("T")[0],
  showDate: false,
  font: "font-times",
  topicSize: "topic-lg",
  border: "border-none",
  spacing: "spacing-balanced",
  logoPx: 112
};

const STORAGE_KEY = "bup_cover_original_v4";

let state = { ...DEFAULT_DATA };
let univ = null;          // the picked university's data/<id>.json, once loaded
const univFetches = {};
let currentZoom = 1.0;
let refitPreview = () => {};

const elements = {
  univNameInput: document.getElementById("univNameInput"),
  headerCaseSelect: document.getElementById("headerCaseSelect"),
  headerSizeSelect: document.getElementById("headerSizeSelect"),
  univTaglineInput: document.getElementById("univTaglineInput"),
  showTagline: document.getElementById("showTagline"),
  univAddressInput: document.getElementById("univAddressInput"),
  showAddress: document.getElementById("showAddress"),
  univSelect: document.getElementById("univSelect"),
  formatSelect: document.getElementById("formatSelect"),
  mlaTitlePage: document.getElementById("mlaTitlePage"),
  btnCopyHeading: document.getElementById("btnCopyHeading"),
  subtitle: document.getElementById("subtitle"),
  wordCount: document.getElementById("wordCount"),
  declaration: document.getElementById("declaration"),
  paperSelect: document.getElementById("paperSelect"),
  coverForm: document.getElementById("coverForm"),
  setup: document.getElementById("setup"),
  setupUniv: document.getElementById("setupUniv"),
  setupFormats: document.getElementById("setupFormats"),
  setupDone: document.getElementById("setupDone"),
  pUkCrest: document.getElementById("pUkCrest"),
  pUkRows: document.getElementById("pUkRows"),
  btnCrest: document.getElementById("btnCrest"),
  crestFile: document.getElementById("crestFile"),
  deptPreset: document.getElementById("deptPreset"),
  assignmentPrefix: document.getElementById("assignmentPrefix"),
  assignmentTopic: document.getElementById("assignmentTopic"),
  courseTitle: document.getElementById("courseTitle"),
  courseCode: document.getElementById("courseCode"),
  teacherSearch: document.getElementById("teacherSearch"),
  teacherName: document.getElementById("teacherName"),
  teacherDept: document.getElementById("teacherDept"),
  teacherAffiliation: document.getElementById("teacherAffiliation"),
  modeControl: document.getElementById("submissionMode"),
  membersList: document.getElementById("membersList"),
  membersContainer: document.getElementById("membersContainer"),
  btnAddMember: document.getElementById("btnAddMember"),
  studentSection: document.getElementById("studentSection"),
  studentSession: document.getElementById("studentSession"),
  studentIntake: document.getElementById("studentIntake"),
  studentDept: document.getElementById("studentDept"),
  submissionDate: document.getElementById("submissionDate"),
  showDate: document.getElementById("showDate"),
  fontSelect: document.getElementById("fontSelect"),
  topicSizeSelect: document.getElementById("topicSizeSelect"),
  spacingSelect: document.getElementById("spacingSelect"),
  borderSelect: document.getElementById("borderSelect"),
  logoSize: document.getElementById("logoSize"),
  btnReset: document.getElementById("btnReset"),
  btnClear: document.getElementById("btnClear"),
  btnPrintFloating: document.getElementById("btnPrintFloating"),
  btnMerge: document.getElementById("btnMerge"),
  assignmentFile: document.getElementById("assignmentFile"),
  zoomStepper: document.getElementById("zoomStepper"),
  saveStatus: document.getElementById("saveStatus"),
  a4Sheet: document.getElementById("a4Sheet"),
  pUnivName: document.getElementById("pUnivName"),
  pUnivTagline: document.getElementById("pUnivTagline"),
  pUnivAddress: document.getElementById("pUnivAddress"),
  pLogo: document.getElementById("pLogo"),
  pPrefix: document.getElementById("pPrefix"),
  pTopic: document.getElementById("pTopic"),
  pCourse: document.getElementById("pCourse"),
  pTeacherName: document.getElementById("pTeacherName"),
  pTeacherDept: document.getElementById("pTeacherDept"),
  pTeacherAffil: document.getElementById("pTeacherAffil"),
  pStudentsTable: document.getElementById("pStudentsTable"),
  pSection: document.getElementById("pSection"),
  pBatchWrap: document.getElementById("pBatchWrap"),
  pBatch: document.getElementById("pBatch"),
  pSession: document.getElementById("pSession"),
  pStudentDept: document.getElementById("pStudentDept"),
  pDateWrap: document.getElementById("pDateWrap"),
  pDateLabel: document.getElementById("pDateLabel"),
  pDateValue: document.getElementById("pDateValue")
};

/* A landing page under /u/<id>/ links in as /?u=<id>. Preselect that
   university, but leave the format question alone: picking a university is not
   the same as having set the cover up, and a student arriving this way has
   still chosen nothing else. A returning student with their own saved cover
   keeps it; only the pre-setup default moves. */
function readUniversityLink() {
  const id = new URLSearchParams(location.search).get("u");
  if (!id || !UNIVERSITIES.some(u => u.id === id)) return;
  history.replaceState(null, "", location.pathname + location.hash);
  if (state.setupDone) return;
  state.univ = id;
}

async function init() {
  loadSavedState();
  readUniversityLink();
  const shared = await readShareLink();
  const univItems = UNIVERSITIES.map(u => ({ value: u.id, label: u.short, full: `${u.name} (${u.short})` }));
  elements.univSelect.items = univItems;
  elements.setupUniv.items = univItems;
  elements.formatSelect.items = FORMATS.map(f => ({ value: f.id, label: f.label, full: f.label }));
  elements.setupFormats.innerHTML = FORMATS.map(f => `
    <button type="button" class="format-option" role="radio" data-format="${f.id}">
      <b>${f.label}</b><span>${f.desc}</span>
    </button>`).join("");
  showSetup(!state.setupDone);
  syncFormFromState();
  renderMembersInputs();
  updatePreview();
  showUniversity(state.univ, false);
  attachEventListeners();
  autoScalePreviewOnResize();
  if (shared) showShareNotice(shared);
}

const MINOR_WORDS = new Set(["of", "and", "the", "for", "in", "on", "at", "to", "a", "an"]);

function toNaturalTitleCase(str) {
  if (!str || typeof str !== "string") return "";
  const trimmed = str.trim();
  if (trimmed.length > 3 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    return trimmed.toLowerCase()
      .replace(/(^|\s|-|\.)([a-z]+)/g, (m, p1, w) =>
        p1 + (p1 && MINOR_WORDS.has(w) ? w : w[0].toUpperCase() + w.slice(1)));
  }
  return str;
}

function loadSavedState() {
  try {
    let saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      saved = localStorage.getItem("bup_cover_original_v1");
    }
    if (saved) {
      const parsed = JSON.parse(saved);
      state = Object.assign({}, DEFAULT_DATA, parsed);
      // Saves from before the setup step: these people are past it.
      if (parsed.setupDone === undefined) state.setupDone = true;
      if (state.teacherName) {
        state.teacherName = toNaturalTitleCase(state.teacherName);
      }
      state.univName = (state.univName || "").toUpperCase();
      // The crest used to be three presets; carry those saves over to the
      // variable size so nobody's stored layout jumps.
      if (typeof state.logoPx !== "number") {
        state.logoPx = { "logo-sm": 92, "logo-lg": 132 }[parsed.logoSize] || 112;
      }
      if (typeof state.headerPt !== "number") {
        state.headerPt = { "header-size-md": 19, "header-size-xl": 24 }[parsed.headerSize] || 21;
      }
    }
  } catch (e) {
    console.warn("Could not read localStorage:", e);
  }
}

let saveStatusTimer = null;

function saveState() {
  if (!document.getElementById("shareQr").classList.contains("hidden")) renderShareQr();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    showSaved();
  } catch (e) {
    console.warn("Could not write to localStorage:", e);
  }
}

// Acknowledge the autosave. Re-firing mid-fade just resumes from the current
// opacity rather than restarting, so fast typing never flickers.
function showSaved() {
  if (!elements.saveStatus) return;
  elements.saveStatus.classList.add("is-visible");
  clearTimeout(saveStatusTimer);
  saveStatusTimer = setTimeout(() => {
    elements.saveStatus.classList.remove("is-visible");
  }, 1600);
}

function loadUniversity(id) {
  univFetches[id] ||= fetch(`data/${id}.json`)
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .catch(e => { delete univFetches[id]; throw e; });
  return univFetches[id];
}

/* `fill` is a fresh pick from the dropdown: it overwrites the masthead and the
   affiliation. On page load the saved (possibly hand-edited) values win. */
async function showUniversity(id, fill) {
  let data = null;
  if (id !== OTHER) {
    try { data = await loadUniversity(id); }
    catch (e) { console.warn(`Could not load data/${id}.json:`, e); }
  }
  if (state.univ !== id) return; // another university was picked meanwhile
  univ = data;

  // A listed university that failed to load keeps what is on screen.
  if (fill && (univ || id === OTHER)) Object.assign(state, universityDefaults(univ));
  populateDepartmentDropdown();
  populateTeacherSearch();
  syncFormFromState();
  updatePreview();
  if (fill) saveState();
}

// What picking a university fills in. A share link sends only what differs.
function universityDefaults(data) {
  const dept = data?.faculties[0]?.departments[0] || "";
  return {
    univName: data ? data.name.toUpperCase() : "",
    univTagline: data?.tagline || "",
    showTagline: !!data?.tagline,
    univAddress: data?.address || "",
    logo: data?.logo || "",
    teacherAffiliation: data?.name || "",
    studentDept: dept,
    deptManual: false,
    // The last teacher belonged to the last university.
    teacherName: "",
    teacherDept: dept,
  };
}

function populateDepartmentDropdown() {
  // Sorted by name, not by the faculty order the university's own site uses:
  // nobody scanning for "Marketing" knows which faculty to look under first.
  // Only this display list is sorted. The flat department array in
  // directoryTeachers() is positional, indexed by each teacher's record, and
  // sorting that one would relabel every teacher's department.
  const items = (univ?.faculties || []).flatMap(f => f.departments.map(d => {
    const label = d.replace(/^Department of /, "");
    return { value: d, label, full: `${label} · ${f.short}` };
  })).sort((a, b) => a.label.localeCompare(b.label, "en"));
  items.push({ value: MANUAL, label: "Typed manually", full: "Not listed? Type it manually" });
  elements.deptPreset.items = items;
  // A saved department the directory does not list (renamed, or typed by
  // hand) stays as typed rather than being swapped for a listed one.
  if (!items.some(i => i.value === state.studentDept)) state.deptManual = true;
  elements.deptPreset.value = state.deptManual ? MANUAL : state.studentDept;
  elements.studentDept.hidden = !state.deptManual;
}

function syncFormFromState() {
  if (elements.univNameInput) elements.univNameInput.value = state.univName;
  if (elements.headerCaseSelect) elements.headerCaseSelect.value = state.headerCase || "header-caps";
  if (elements.headerSizeSelect) {
    elements.headerSizeSelect.setAttribute("value", String(state.headerPt || 21));
  }
  if (elements.univTaglineInput) elements.univTaglineInput.value = state.univTagline || "";
  if (elements.showTagline) elements.showTagline.checked = !!state.showTagline;
  if (elements.univAddressInput) elements.univAddressInput.value = state.univAddress || "";
  if (elements.showAddress) elements.showAddress.checked = !!state.showAddress;

  elements.univSelect.value = state.univ;
  elements.setupUniv.value = state.univ;
  elements.formatSelect.value = state.format;
  elements.mlaTitlePage.checked = !!state.mlaTitlePage;
  elements.subtitle.value = state.subtitle || "";
  elements.wordCount.value = state.wordCount || "";
  elements.declaration.value = state.declaration || "";
  elements.paperSelect.value = state.paper;
  applyFormat();
  elements.assignmentPrefix.value = state.prefix || "Assignment on";
  elements.assignmentTopic.value = state.topic || "";
  elements.courseTitle.value = state.courseTitle || "";
  elements.courseCode.value = state.courseCode || "";
  elements.teacherName.value = state.teacherName || "";
  elements.teacherDept.value = state.teacherDept || "";
  elements.teacherAffiliation.value = state.teacherAffiliation;

  elements.studentSection.value = state.section || "";
  elements.studentSession.value = state.session || "";
  elements.studentIntake.value = state.intake || "";
  elements.studentDept.value = state.studentDept || "";
  elements.submissionDate.value = state.submissionDate || "";
  elements.showDate.checked = !!state.showDate;
  if (elements.fontSelect) elements.fontSelect.value = state.font || "font-times";
  if (elements.topicSizeSelect) elements.topicSizeSelect.value = state.topicSize || "topic-lg";
  elements.spacingSelect.value = state.spacing || "spacing-balanced";
  elements.borderSelect.value = state.border || "border-none";
  elements.logoSize.setAttribute("value", String(state.logoPx || 112));

  elements.modeControl.value = state.submissionMode;
}

function activeMembers() {
  return state.submissionMode === "group" ? state.members : state.members.slice(0, 1);
}

function renderMembersInputs() {
  elements.membersList.innerHTML = "";

  const group = state.submissionMode === "group";
  elements.btnAddMember.hidden = !group;
  elements.membersContainer.classList.toggle("is-single", !group);

  activeMembers().forEach((member, index) => {
    const row = document.createElement("div");
    row.className = "member-row";
    row.dataset.index = index;

    row.innerHTML = `
      <input type="text" class="member-name-input" name="member-name-${index}" aria-label="Student Full Name" placeholder="Full Name" value="${escapeHtml(member.name || "")}">
      <input type="text" class="member-id-input" name="member-id-${index}" aria-label="Student ID" placeholder="Student ID" value="${escapeHtml(member.id || "")}">
      <button type="button" class="btn-remove-member" title="Remove student" aria-label="Remove student" data-index="${index}" ${group && state.members.length > 1 ? "" : "hidden"}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    `;

    const nameInput = row.querySelector(".member-name-input");
    const idInput = row.querySelector(".member-id-input");

    nameInput.addEventListener("input", (e) => {
      state.members[index].name = e.target.value;
      updatePreview();
      saveState();
    });

    idInput.addEventListener("input", (e) => {
      state.members[index].id = e.target.value;
      updatePreview();
      saveState();
    });

    const removeBtn = row.querySelector(".btn-remove-member");
    if (removeBtn && !removeBtn.hidden) {
      removeBtn.addEventListener("click", () => {
        state.members.splice(index, 1);
        renderMembersInputs();
        updatePreview();
        saveState();
      });
    }

    elements.membersList.appendChild(row);
  });
}

function updatePreview() {
  const rawUniv = state.univName || "";
  if (state.headerCase === "header-caps") {
    elements.pUnivName.textContent = rawUniv.toUpperCase();
  } else {
    elements.pUnivName.textContent = toNaturalTitleCase(rawUniv);
  }

  if (state.showTagline && state.univTagline && state.univTagline.trim()) {
    elements.pUnivTagline.textContent = state.univTagline.trim();
    elements.pUnivTagline.style.display = "";
  } else {
    elements.pUnivTagline.style.display = "none";
  }

  if (state.showAddress && state.univAddress && state.univAddress.trim()) {
    elements.pUnivAddress.textContent = state.univAddress.trim();
    elements.pUnivAddress.style.display = "";
  } else {
    elements.pUnivAddress.style.display = "none";
  }

  elements.pPrefix.textContent = state.prefix || "Assignment on";
  elements.pTopic.textContent = state.topic || "Untitled Topic";

  const codePart = state.courseCode && state.courseCode.trim() ? ` (${state.courseCode.trim()})` : "";
  elements.pCourse.textContent = (state.courseTitle || "") + codePart;

  elements.pTeacherName.textContent = state.teacherName || "";
  elements.pTeacherDept.textContent = state.teacherDept || "";
  elements.pTeacherAffil.textContent = state.teacherAffiliation;

  const tbody = elements.pStudentsTable.querySelector("tbody");
  tbody.innerHTML = "";

  const filledMembers = activeMembers().filter(m => (m.name && m.name.trim()) || (m.id && m.id.trim()));
  const membersToDisplay = filledMembers.length > 0 ? filledMembers : [{ name: "", id: "" }];

  membersToDisplay.forEach(member => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-name">${escapeHtml(member.name || "")}</td>
      <td class="col-id">${escapeHtml(member.id || "")}</td>
    `;
    tbody.appendChild(tr);
  });

  elements.pSection.textContent = state.section ? `Section: ${state.section}` : "";

  if (state.intake && state.intake.trim()) {
    elements.pBatch.textContent = `Batch/Intake: ${state.intake.trim()}`;
    elements.pBatchWrap.classList.remove("hidden");
  } else {
    elements.pBatchWrap.classList.add("hidden");
  }

  elements.pSession.textContent = state.session ? `Session: ${state.session}` : "";
  elements.pStudentDept.textContent = state.studentDept || "";

  if (state.showDate && state.submissionDate) {
    elements.pDateWrap.classList.remove("hidden");
    const parts = state.submissionDate.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const dateObj = new Date(year, month, day);
      const options = { year: "numeric", month: "long", day: "numeric" };
      elements.pDateValue.textContent = dateObj.toLocaleDateString("en-US", options);
    } else {
      elements.pDateValue.textContent = state.submissionDate;
    }
  } else {
    elements.pDateWrap.classList.add("hidden");
  }

  elements.pUnivName.style.fontSize = `${state.headerPt || 21}pt`;
  // Border and spacing belong to the Bangladeshi layout; the others are fixed.
  const bd = state.format === "bd";
  elements.a4Sheet.className = `a4-sheet ${state.font || "font-times"} ${state.headerCase || "header-caps"} ${state.topicSize || "topic-lg"} ${bd ? state.border || "border-none" : ""} ${state.spacing || "spacing-balanced"}`;

  const template = state.format === "mla" && state.mlaTitlePage ? "mlatp" : state.format;
  elements.a4Sheet.querySelectorAll(".sheet-inner").forEach(el =>
    el.classList.toggle("hidden", el.dataset.format !== template));
  if (!bd) {
    const v = coverValues();
    elements.a4Sheet.querySelectorAll("[data-f]").forEach(el => { el.textContent = v[el.dataset.f] || ""; });
    elements.pUkRows.innerHTML = v.ukRows.map(([k, val]) =>
      `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(val)}</td></tr>`).join("");
    if (state.logo) elements.pUkCrest.src = state.logo;
    else elements.pUkCrest.removeAttribute("src");
  }
  elements.pLogo.parentElement.classList.toggle("hidden", !state.logo);
  if (state.logo && elements.pLogo.getAttribute("src") !== state.logo) elements.pLogo.src = state.logo;
  elements.pLogo.style.height = `${state.logoPx || 112}px`;
}

function attachEventListeners() {
  const pickUniversity = (id) => {
    state.univ = id;
    elements.univSelect.value = id;
    elements.setupUniv.value = id;
    showUniversity(id, true);
  };
  elements.univSelect.addEventListener("change", (e) => pickUniversity(e.target.value));
  elements.setupUniv.addEventListener("change", (e) => pickUniversity(e.target.value));

  elements.formatSelect.addEventListener("change", (e) => pickFormat(e.target.value));
  elements.setupFormats.addEventListener("click", (e) => {
    const option = e.target.closest("[data-format]");
    if (option) pickFormat(option.dataset.format);
  });
  elements.setupDone.addEventListener("click", () => {
    state.setupDone = true;
    showSetup(false);
    saveState();
  });

  elements.paperSelect.addEventListener("change", (e) => {
    state.paper = e.detail.value;
    applyFormat();
    updatePreview();
    saveState();
  });
  elements.mlaTitlePage.addEventListener("change", (e) => {
    state.mlaTitlePage = e.target.checked;
    applyFormat();
    updatePreview();
    saveState();
  });
  elements.btnCopyHeading.addEventListener("click", copyMlaHeading);
  document.getElementById("btnShare").addEventListener("click", copyShareLink);
  document.getElementById("btnQr").addEventListener("click", toggleShareQr);
  document.getElementById("shareUndo").addEventListener("click", undoShare);

  elements.btnCrest.addEventListener("click", () => {
    elements.crestFile.value = "";
    elements.crestFile.click();
  });
  elements.crestFile.addEventListener("change", async () => {
    const file = elements.crestFile.files[0];
    if (!file) return;
    try { state.logo = await shrinkImage(file); }
    catch (e) { console.warn("Could not read that image:", e); return; }
    updatePreview();
    saveState();
  });

  elements.deptPreset.addEventListener("change", (e) => {
    state.deptManual = e.target.value === MANUAL;
    elements.studentDept.hidden = !state.deptManual;
    if (!state.deptManual) {
      state.studentDept = e.target.value;
      elements.studentDept.value = state.studentDept;
      if (!state.teacherDept || state.teacherDept.startsWith("Department")) {
        state.teacherDept = state.studentDept;
        elements.teacherDept.value = state.teacherDept;
      }
    }
    updatePreview();
    saveState();
  });

  elements.teacherSearch.addEventListener("pick", (e) => {
    const t = e.detail.item.data;
    state.teacherName = t.name;
    state.teacherDept = t.dept || state.teacherDept;
    state.teacherAffiliation = univ?.name || state.teacherAffiliation;
    elements.teacherName.value = state.teacherName;
    elements.teacherDept.value = state.teacherDept;
    elements.teacherAffiliation.value = state.teacherAffiliation;
    updatePreview();
    saveState();
  });

  const bind = (el, key) => {
    if (!el) return;
    el.addEventListener("input", (e) => {
      state[key] = e.target.value;
      updatePreview();
      saveState();
    });
  };

  bind(elements.univNameInput, "univName");
  bind(elements.univTaglineInput, "univTagline");
  bind(elements.univAddressInput, "univAddress");

  if (elements.showTagline) {
    elements.showTagline.addEventListener("change", (e) => {
      state.showTagline = e.target.checked;
      updatePreview();
      saveState();
    });
  }

  if (elements.showAddress) {
    elements.showAddress.addEventListener("change", (e) => {
      state.showAddress = e.target.checked;
      updatePreview();
      saveState();
    });
  }

  bind(elements.assignmentPrefix, "prefix");
  bind(elements.assignmentTopic, "topic");
  bind(elements.courseTitle, "courseTitle");
  bind(elements.courseCode, "courseCode");
  bind(elements.subtitle, "subtitle");
  bind(elements.wordCount, "wordCount");
  bind(elements.declaration, "declaration");
  bind(elements.teacherName, "teacherName");
  bind(elements.teacherDept, "teacherDept");
  bind(elements.teacherAffiliation, "teacherAffiliation");
  bind(elements.studentSection, "section");
  bind(elements.studentSession, "session");
  bind(elements.studentIntake, "intake");
  bind(elements.studentDept, "studentDept");
  bind(elements.submissionDate, "submissionDate");

  elements.showDate.addEventListener("change", (e) => {
    state.showDate = e.target.checked;
    updatePreview();
    saveState();
  });

  elements.modeControl.addEventListener("change", (e) => {
    state.submissionMode = e.detail.value;
    if (state.submissionMode === "group" && state.members.length === 1 && state.members[0].name) {
      state.members.push({ name: "", id: "" });
    }
    renderMembersInputs();
    updatePreview();
    saveState();
  });

  elements.btnAddMember.addEventListener("click", () => {
    state.members.push({ name: "", id: "" });
    renderMembersInputs();
    updatePreview();
    saveState();
    const inputs = elements.membersList.querySelectorAll(".member-name-input");
    if (inputs.length > 0) inputs[inputs.length - 1].focus();
  });

  if (elements.headerCaseSelect) {
    elements.headerCaseSelect.addEventListener("change", (e) => {
      state.headerCase = e.target.value;
      updatePreview();
      saveState();
    });
  }

  if (elements.headerSizeSelect) {
    elements.headerSizeSelect.addEventListener("change", (e) => {
      state.headerPt = e.detail.value;
      updatePreview();
      saveState();
    });
  }

  if (elements.fontSelect) {
    elements.fontSelect.addEventListener("change", (e) => {
      state.font = e.target.value;
      updatePreview();
      saveState();
    });
  }

  if (elements.topicSizeSelect) {
    elements.topicSizeSelect.addEventListener("change", (e) => {
      state.topicSize = e.target.value;
      updatePreview();
      saveState();
    });
  }

  elements.spacingSelect.addEventListener("change", (e) => {
    state.spacing = e.target.value;
    updatePreview();
    saveState();
  });

  elements.borderSelect.addEventListener("change", (e) => {
    state.border = e.target.value;
    updatePreview();
    saveState();
  });

  elements.logoSize.addEventListener("change", (e) => {
    state.logoPx = e.detail.value;
    updatePreview();
    saveState();
  });

  // LoadingButton owns the idle -> pending -> success sequence; it only needs
  // the work itself. window.print() blocks until the dialog closes, which is
  // exactly the "pending" window the component reserves width for.
  elements.btnPrintFloating.action = () => window.print();

  const PRINTER_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true"><path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2
      2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12"
      height="8"></rect></svg>`;
  elements.btnPrintFloating.setIdleFace(`${PRINTER_ICON}Print`);
  setupMerge(PRINTER_ICON);

  elements.zoomStepper.addEventListener("change", (e) => applyZoom(e.detail.value / 100));

  // HoldToConfirm replaces confirm(): the hold is the confirmation.
  elements.btnReset.addEventListener("confirm", () => {
    localStorage.removeItem(STORAGE_KEY);
    state = JSON.parse(JSON.stringify(DEFAULT_DATA));
    showSetup(true);
    syncFormFromState();
    renderMembersInputs();
    updatePreview();
    showUniversity(state.univ, false);
  });

  // Clears what changes per assignment. Section, session, department and
  // intake are the details you reuse every week, which is the point of the
  // autosave, so wiping only some of them left rows looking half-filled.
  elements.btnClear.addEventListener("confirm", () => {
    state.topic = "";
    state.courseTitle = "";
    state.courseCode = "";
    state.teacherName = "";
    state.members = [{ name: "", id: "" }];
    syncFormFromState();
    renderMembersInputs();
    updatePreview();
    saveState();
  });
}

function showSetup(on) {
  elements.setup.classList.toggle("hidden", !on);
  elements.coverForm.classList.toggle("hidden", on);
}

// The conventional typeface comes with the format; it stays changeable.
function pickFormat(id) {
  state.format = id;
  state.font = id === "uk" ? "font-arial" : "font-times";
  elements.formatSelect.value = id;
  elements.fontSelect.value = state.font;
  applyFormat();
  updatePreview();
  saveState();
}

/* Everything that depends on the format but is not the sheet's content:
   which form fields apply, the paper, and whether a merge makes sense. */
function applyFormat() {
  const template = state.format === "mla" && state.mlaTitlePage ? "mlatp" : state.format;
  document.querySelectorAll("[data-for]").forEach(el =>
    el.classList.toggle("hidden", !el.dataset.for.split(" ").includes(state.format)));
  elements.setupFormats.querySelectorAll("[data-format]").forEach(el =>
    el.setAttribute("aria-checked", String(el.dataset.format === state.format)));

  const letter = state.paper === "letter";
  document.documentElement.classList.toggle("paper-letter", letter);
  document.getElementById("paperBadge").textContent = letter ? "Live Letter" : "Live A4";
  let pageRule = document.getElementById("pageRule");
  if (!pageRule) {
    pageRule = document.head.appendChild(document.createElement("style"));
    pageRule.id = "pageRule";
  }
  pageRule.textContent = `@page { size: ${letter ? "letter" : "A4"} portrait; margin: 0; }`;
  refitPreview();

  // MLA's heading goes on the student's own first page; there is no cover to
  // put in front of it.
  elements.btnMerge.classList.toggle("hidden", template === "mla");
}

function formatDate(locale) {
  const [y, m, d] = (state.submissionDate || "").split("-").map(Number);
  if (!y || !m || !d) return state.submissionDate || "";
  return new Date(y, m - 1, d).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });
}

// "A, B, and C", the way APA lists co-authors on one line.
function listJoin(names) {
  if (names.length < 3) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/* The text every international template and its PDF builder print, worked
   out once so the screen and the merged file cannot disagree. */
function coverValues() {
  const members = activeMembers();
  const names = members.map(m => (m.name || "").trim()).filter(Boolean);
  const ids = members.map(m => (m.id || "").trim()).filter(Boolean);
  const title = (state.topic || "").trim() || "Untitled";
  const sub = (state.subtitle || "").trim();
  const code = (state.courseCode || "").trim();
  const course = (state.courseTitle || "").trim();
  const univTitle = univ && state.univName === univ.name.toUpperCase()
    ? univ.name : toNaturalTitleCase(state.univName || "");
  const faculty = univ?.faculties.find(f => f.departments.includes(state.studentDept));
  const dateDMY = formatDate("en-GB");
  const fullTitle = sub ? `${title}: ${sub}` : title;
  return {
    fullTitle,
    topicColon: sub ? `${title}:` : title,
    subtitle: sub,
    authorsInline: listJoin(names),
    authorsLines: names.join("\n"),
    affiliation: [state.studentDept, univTitle].filter(Boolean).join(", "),
    courseLine: code && course ? `${code}: ${course}` : code || course,
    teacherName: (state.teacherName || "").trim(),
    dateLong: formatDate("en-US"),
    dateDMY,
    mlaRunHead: `${(names[0] || "").split(/\s+/).pop()} 1`.trim(),
    univTitle,
    faculty: faculty && faculty.name !== state.studentDept ? faculty.name : "",
    declaration: (state.declaration || "").trim(),
    ukRows: [
      [names.length > 1 ? "Student names" : "Student name", names.join("\n")],
      [ids.length > 1 ? "Student IDs" : "Student ID", ids.join("\n")],
      ["Module code and title", [code, course].filter(Boolean).join(" ")],
      ["Assignment title", fullTitle],
      ["Module leader", (state.teacherName || "").trim()],
      ["Submission date", dateDMY],
      ["Word count", (state.wordCount || "").trim()],
    ],
  };
}

async function copyMlaHeading() {
  const v = coverValues();
  const text = [v.authorsLines, v.teacherName, v.courseLine, v.dateDMY, v.fullTitle]
    .filter(Boolean).join("\n");
  const btn = elements.btnCopyHeading;
  const label = btn.textContent;
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = "Copied. Paste it at the top of your document";
  } catch {
    btn.textContent = "Could not copy. Select the heading on the sheet instead";
  }
  setTimeout(() => { btn.textContent = label; }, 2200);
}

// An uploaded crest lives in localStorage as a data URL, so it is redrawn at
// 300px tall first: sharp at the largest crest size, and a few dozen KB
// rather than whatever the original weighed.
async function shrinkImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const nw = img.naturalWidth || 300, nh = img.naturalHeight || 300;
    const h = Math.min(300, nh), w = Math.round(h * nw / nh);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function applyZoom(zoom) {
  currentZoom = zoom;
  elements.zoomStepper.setAttribute("value", String(Math.round(zoom * 100)));
  // CSS zoom (not transform) so the scaled sheet actually occupies layout space:
  // scroll extents stay correct and nothing gets clipped when zoomed in.
  elements.a4Sheet.style.zoom = zoom;
}

function autoScalePreviewOnResize() {
  const updateScale = () => {
    const previewScroll = document.getElementById("previewScroll");
    if (!previewScroll) return;
    const cs = getComputedStyle(previewScroll);
    const containerWidth =
      previewScroll.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const sheetNaturalWidth = (state.paper === "letter" ? 215.9 : 210) * 3.7795275591;
    if (containerWidth < sheetNaturalWidth) {
      const fitZoom = Math.max(0.25, containerWidth / sheetNaturalWidth);
      // floor, never round up: rounding up makes the sheet wider than the container
      applyZoom(Math.floor(fitZoom * 100) / 100);
    } else if (currentZoom < 1.0) {
      applyZoom(1.0);
    }
  };

  window.addEventListener("resize", updateScale);
  refitPreview = updateScale;
  updateScale();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.addEventListener("DOMContentLoaded", init);

// Serves repeat visits from the browser's cache; see sw.js.
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch((e) => console.warn("No offline cache:", e));
}

// Faculty directory search, an <interior-combobox>: the component owns the
// filtering UI, keyboard contract and highlight; this owns what a pick means.
// A directory's teachers as covers address them: "Asst. Prof. Jane Doe".
function directoryTeachers(data) {
  const depts = (data?.faculties || []).flatMap(f => f.departments);
  return (data?.teachers || []).map(([name, t, d]) => {
    const title = data.titles[t];
    const prefix = /^(Dr|Prof)\b/i.test(name) ? "" : TITLE_PREFIX[title];
    return { label: prefix ? `${prefix} ${name}` : name, title, dept: depts[d] };
  });
}

function populateTeacherSearch() {
  const box = elements.teacherSearch;
  box.items = directoryTeachers(univ).map(t => ({
    value: t.label, label: t.label, sub: [t.title, t.dept].filter(Boolean).join(" / "),
    data: { name: t.label, dept: t.dept },
  }));
  const short = UNIVERSITIES.find(u => u.id === state.univ)?.short || "";
  box.$input.placeholder = univ?.teachers.length
    ? `Search ${univ.teachers.length} ${short} teachers by name or department`
    : "No teacher list for this university, type it below";
}

/* ---- Share link -------------------------------------------------------
 * The cover travels in the URL fragment (#s=...), which browsers never send
 * to a server: nothing is stored anywhere and no request is made. To keep it
 * short, only fields that differ from what picking the university gives are
 * sent, keyed by their position in SHARE_FIELDS, then deflated. A directory
 * teacher goes as a hash of their name, found again by searching, so a
 * refreshed directory can't swap in the wrong person.
 *
 * SHARE_FIELDS is append-only: old links decode by position.
 */
const SHARE_FIELDS = [
  "univ", "format", "paper", "mlaTitlePage", "subtitle", "wordCount", "declaration",
  "univName", "headerCase", "headerPt", "univTagline", "showTagline", "univAddress", "showAddress",
  "deptManual", "studentDept", "prefix", "topic", "courseTitle", "courseCode",
  "teacherName", "teacherDept", "teacherAffiliation", "submissionMode",
  "section", "session", "intake", "submissionDate", "showDate",
  "font", "topicSize", "border", "spacing", "logoPx",
];
const SHARE_LIMIT = 64 * 1024; // decoded bytes; a real cover is well under 2 KB

function shortHash(text) { // FNV-1a
  let h = 0x811c9dc5;
  for (const c of text) h = Math.imul(h ^ c.codePointAt(0), 0x01000193);
  return (h >>> 0).toString(36);
}

const toBase64Url = (bytes) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64Url = (text) =>
  Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));

async function pipeBytes(bytes, transform, limit = Infinity) {
  const reader = new Blob([bytes]).stream().pipeThrough(transform).getReader();
  const parts = [];
  let size = 0;
  for (let r; !(r = await reader.read()).done;) {
    size += r.value.length;
    if (size > limit) { reader.cancel(); throw new Error("Share link too large"); }
    parts.push(r.value);
  }
  return new Uint8Array(await new Blob(parts).arrayBuffer());
}

async function buildShareLink() {
  const base = { ...DEFAULT_DATA, ...universityDefaults(univ) };
  const p = {};
  SHARE_FIELDS.forEach((k, i) => { if (state[k] !== base[k]) p[i] = state[k]; });
  const i = (k) => SHARE_FIELDS.indexOf(k);
  const teacher = directoryTeachers(univ).find(t => t.label === state.teacherName);
  if (teacher) {
    delete p[i("teacherName")];
    if (state.teacherDept === teacher.dept) delete p[i("teacherDept")];
    p.t = shortHash(teacher.label);
  }
  p.m = state.members.flatMap(m => [m.name || "", m.id || ""]);
  // An uploaded crest would outweigh everything else; only its absence travels.
  const crestLeftOut = state.logo !== base.logo;
  if (crestLeftOut) p.c = 1;

  const json = new TextEncoder().encode(JSON.stringify(p));
  const packed = "CompressionStream" in window
    ? "z" + toBase64Url(await pipeBytes(json, new CompressionStream("deflate-raw")))
    : "j" + toBase64Url(json);
  return { url: `${location.origin}${location.pathname}#s=${packed}`, crestLeftOut };
}

async function copyShareLink() {
  const note = document.getElementById("shareNote");
  const { url, crestLeftOut } = await buildShareLink();
  const crest = crestLeftOut ? " Your uploaded crest is not in the link, so your friend has to upload it too." : "";
  try {
    await navigator.clipboard.writeText(url);
    note.textContent = `Link copied. It carries every name and ID on this cover, so share it only with your classmates.${crest}`;
  } catch {
    note.textContent = `Copy this link: ${url}${crest}`;
  }
}

// Loaded on first use, like the PDF engine: most visits never need it.
let qrLib = null;
function loadQr() {
  qrLib ||= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "assets/qrcode.min.js";
    s.onload = () => resolve(window.qrcode);
    s.onerror = () => { qrLib = null; reject(new Error("Could not load the QR code engine")); };
    document.head.appendChild(s);
  });
  return qrLib;
}

async function toggleShareQr() {
  const btn = document.getElementById("btnQr");
  const box = document.getElementById("shareQr");
  const open = box.classList.contains("hidden");
  btn.setAttribute("aria-expanded", String(open));
  btn.textContent = open ? "Hide QR code" : "Show QR code";
  box.classList.toggle("hidden", !open);
  if (open) renderShareQr();
}

// Redrawn on every save while it is showing, so it never encodes a stale cover.
async function renderShareQr() {
  try {
    const [qrcode, { url }] = await Promise.all([loadQr(), buildShareLink()]);
    // Medium error correction: still reads through screen glare.
    const qr = qrcode(0, "M");
    qr.addData(url);
    qr.make();
    const box = document.getElementById("qrCode");
    // margin is in the same units as cellSize: 16 is the four-module quiet
    // zone scanners need around the code.
    box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true, alt: "QR code for this cover" });
    // Whole pixels per module: fractional ones render uneven and scan worse.
    const modules = qr.getModuleCount() + 8;
    box.firstElementChild.style.width = `${Math.max(2, Math.floor(260 / modules)) * modules}px`;
  } catch (e) {
    console.warn(e);
    document.getElementById("qrCode").textContent = "The QR code could not be made. Use Copy a link instead.";
  }
}

/* A link is input from anyone: only known fields, of the default's type, in
   range, and for the fields that become class names, one of the offered
   values. The crest is never read from a link. */
function validShareValue(key, value) {
  const fallback = DEFAULT_DATA[key];
  if (typeof value !== typeof fallback) return false;
  if (typeof value === "number") return Number.isFinite(value) && value >= 8 && value <= 200;
  if (typeof value !== "string") return true;
  const choices = {
    format: FORMATS.map(f => f.id), paper: ["a4", "letter"], submissionMode: ["individual", "group"],
    headerCase: elements.headerCaseSelect.items, font: elements.fontSelect.items,
    topicSize: elements.topicSizeSelect.items, border: elements.borderSelect.items,
    spacing: elements.spacingSelect.items,
  }[key];
  if (choices) return choices.some(c => (c.value ?? c) === value);
  return value.length <= 2000;
}

let sharedFrom = null; // the save a shared link replaced, for Undo

async function readShareLink() {
  const match = location.hash.match(/^#s=([zj])([\w-]{1,8000})$/);
  if (!match) return null;
  history.replaceState(null, "", location.pathname + location.search);
  try {
    let bytes = fromBase64Url(match[2]);
    if (match[1] === "z") bytes = await pipeBytes(bytes, new DecompressionStream("deflate-raw"), SHARE_LIMIT);
    const p = JSON.parse(new TextDecoder().decode(bytes));
    if (!p || typeof p !== "object" || Array.isArray(p)) throw new Error("Not a cover");

    const id = UNIVERSITIES.some(u => u.id === p[0]) ? p[0] : DEFAULT_DATA.univ;
    const data = id === OTHER ? null : await loadUniversity(id).catch(() => null);
    const next = { ...JSON.parse(JSON.stringify(DEFAULT_DATA)), ...universityDefaults(data), univ: id, setupDone: true };
    SHARE_FIELDS.forEach((k, i) => {
      if (k !== "univ" && p[i] !== undefined && validShareValue(k, p[i])) next[k] = p[i];
    });

    let teacherMissing = false;
    if (typeof p.t === "string") {
      const t = directoryTeachers(data).find(x => shortHash(x.label) === p.t);
      if (t) {
        next.teacherName = t.label;
        if (p[SHARE_FIELDS.indexOf("teacherDept")] === undefined) next.teacherDept = t.dept;
      } else teacherMissing = true;
    }
    if (Array.isArray(p.m) && p.m.length <= 60 && p.m.every(v => typeof v === "string" && v.length <= 200)) {
      const members = [];
      for (let j = 0; j < p.m.length; j += 2) members.push({ name: p.m[j], id: p.m[j + 1] || "" });
      if (members.length) next.members = members;
    }

    try { sharedFrom = localStorage.getItem(STORAGE_KEY); } catch {}
    state = next;
    saveState();
    return { teacherMissing, crestMissing: p.c === 1 };
  } catch (e) {
    console.warn("Could not read the shared cover:", e);
    return { broken: true };
  }
}

function showShareNotice({ broken, teacherMissing, crestMissing }) {
  const box = document.getElementById("shareNotice");
  const parts = broken
    ? ["This share link is damaged or incomplete, so your own cover is unchanged. Ask for the link again."]
    : ["You opened a cover shared with you. Change the names and IDs to yours before printing."];
  if (teacherMissing) parts.push("The teacher is no longer in the directory; pick them again under Submitted to.");
  if (crestMissing) parts.push("The sender used their own crest; upload it under University.");
  document.getElementById("shareNoticeText").textContent = parts.join(" ");
  document.getElementById("shareUndo").hidden = !!broken;
  box.classList.remove("hidden");
}

function undoShare() {
  try {
    if (sharedFrom) localStorage.setItem(STORAGE_KEY, sharedFrom);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
  location.reload();
}

// Pasting a share link into an open tab changes only the fragment.
addEventListener("hashchange", () => { if (location.hash.startsWith("#s=")) location.reload(); });

/* Cover page + the student's own assignment PDF, as one file.
 *
 * The picker runs before the button enters its pending state, so cancelling
 * the file dialog leaves the button idle instead of reporting a result for
 * work that never started.
 */
function setupMerge() {
  const btn = elements.btnMerge;
  const input = elements.assignmentFile;
  if (!btn || !input) return;

  const MERGE_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <path d="M14 2v6h6"></path><path d="M12 18v-6"></path><path d="M9 15h6"></path></svg>`;

  // The button reserves width for its widest face, so the long label only
  // earns its space where the toolbar has room for it.
  const narrow = matchMedia("(max-width: 600px)");
  const syncMergeLabel = () => {
    const short = narrow.matches;
    btn.setIdleFace(`${MERGE_ICON}${short ? "Merge" : "Merge assignment"}`);
    // Width is reserved for the widest face the button can reach, so the
    // error wording has to shrink with the rest of them.
    btn.setAttribute("label", short ? "Merge" : "Merge assignment");
    btn.setAttribute("error-label", short ? "Failed" : "Could not merge");
  };
  narrow.addEventListener("change", syncMergeLabel);
  syncMergeLabel();

  // The component runs `action` when clicked; here the click only opens the
  // picker, and the run is started once a file actually arrives.
  btn.shadowRoot.querySelector("button").addEventListener("click", (e) => {
    e.stopImmediatePropagation();
    if (btn.pending) return;
    input.value = "";
    input.click();
  }, true);

  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    if (!file) return;
    btn.action = () => mergeWithAssignment(file);
    btn.run();
  });
}

async function mergeWithAssignment(file) {
  const bytes = await file.arrayBuffer();
  const { bytes: merged } = await window.BUPCoverPDF.merge(state, bytes, coverValues());

  const base = (state.topic || "assignment").trim().replace(/[^\w\s-]/g, "").slice(0, 60)
    || "assignment";
  const name = `${base.replace(/\s+/g, "-")}-with-cover.pdf`;

  const url = URL.createObjectURL(new Blob([merged], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
