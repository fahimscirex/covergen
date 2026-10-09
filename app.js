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
  { id: "ruet", short: "RUET", name: "Rajshahi University of Engineering & Technology" },
  { id: "uiu", short: "UIU", name: "United International University" },
  { id: "ulab", short: "ULAB", name: "University of Liberal Arts Bangladesh" },
];

// Sentinel dropdown value: the department is typed rather than picked.
const MANUAL = "__manual";

// "Asst. Prof. Jane Doe" is how covers address a teacher.
const TITLE_PREFIX = {
  "Professor": "Prof.", "Distinguished Professor": "Prof.",
  "Associate Professor": "Assoc. Prof.", "Assistant Professor": "Asst. Prof.",
  "Senior Lecturer": "Sr. Lecturer", "Lecturer": "Lecturer",
};

const DEFAULT_DATA = {
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

const elements = {
  univNameInput: document.getElementById("univNameInput"),
  headerCaseSelect: document.getElementById("headerCaseSelect"),
  headerSizeSelect: document.getElementById("headerSizeSelect"),
  univTaglineInput: document.getElementById("univTaglineInput"),
  showTagline: document.getElementById("showTagline"),
  univAddressInput: document.getElementById("univAddressInput"),
  showAddress: document.getElementById("showAddress"),
  univSelect: document.getElementById("univSelect"),
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

function init() {
  loadSavedState();
  elements.univSelect.items = UNIVERSITIES.map(u => ({ value: u.id, label: u.short, full: `${u.name} (${u.short})` }));
  syncFormFromState();
  renderMembersInputs();
  updatePreview();
  showUniversity(state.univ, false);
  attachEventListeners();
  autoScalePreviewOnResize();
}

function toNaturalTitleCase(str) {
  if (!str || typeof str !== "string") return "";
  const trimmed = str.trim();
  if (trimmed.length > 3 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    return trimmed.toLowerCase().replace(/(^|\s|-|\.)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());
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
      if (state.teacherName) {
        state.teacherName = toNaturalTitleCase(state.teacherName);
      }
      state.univName = (state.univName || "BANGLADESH UNIVERSITY OF PROFESSIONALS").toUpperCase();
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
  try { data = await loadUniversity(id); }
  catch (e) { console.warn(`Could not load data/${id}.json:`, e); }
  if (state.univ !== id) return; // another university was picked meanwhile
  univ = data;

  if (fill && univ) {
    state.univName = univ.name.toUpperCase();
    state.univTagline = univ.tagline;
    state.showTagline = !!univ.tagline;
    state.univAddress = univ.address;
    state.logo = univ.logo;
    state.teacherAffiliation = univ.name;
    state.studentDept = univ.faculties[0]?.departments[0] || "";
    // The last teacher belonged to the last university.
    state.teacherName = "";
    state.teacherDept = state.studentDept;
    state.deptManual = false;
  }
  populateDepartmentDropdown();
  populateTeacherSearch();
  syncFormFromState();
  updatePreview();
  if (fill) saveState();
}

function populateDepartmentDropdown() {
  const items = (univ?.faculties || []).flatMap(f => f.departments.map(d => {
    const label = d.replace(/^Department of /, "");
    return { value: d, label, full: `${label} · ${f.short}` };
  }));
  items.push({ value: MANUAL, label: "Typed manually", full: "Not listed? Type it manually" });
  elements.deptPreset.items = items;
  // A saved department the directory does not list (renamed, or typed by
  // hand) stays as typed rather than being swapped for a listed one.
  if (!items.some(i => i.value === state.studentDept)) state.deptManual = true;
  elements.deptPreset.value = state.deptManual ? MANUAL : state.studentDept;
  elements.studentDept.hidden = !state.deptManual;
}

function syncFormFromState() {
  if (elements.univNameInput) elements.univNameInput.value = state.univName || "BANGLADESH UNIVERSITY OF PROFESSIONALS";
  if (elements.headerCaseSelect) elements.headerCaseSelect.value = state.headerCase || "header-caps";
  if (elements.headerSizeSelect) {
    elements.headerSizeSelect.setAttribute("value", String(state.headerPt || 21));
  }
  if (elements.univTaglineInput) elements.univTaglineInput.value = state.univTagline || "";
  if (elements.showTagline) elements.showTagline.checked = !!state.showTagline;
  if (elements.univAddressInput) elements.univAddressInput.value = state.univAddress || "";
  if (elements.showAddress) elements.showAddress.checked = !!state.showAddress;

  elements.univSelect.value = state.univ;
  elements.assignmentPrefix.value = state.prefix || "Assignment on";
  elements.assignmentTopic.value = state.topic || "";
  elements.courseTitle.value = state.courseTitle || "";
  elements.courseCode.value = state.courseCode || "";
  elements.teacherName.value = state.teacherName || "";
  elements.teacherDept.value = state.teacherDept || "";
  elements.teacherAffiliation.value = state.teacherAffiliation || "Bangladesh University of Professionals";

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
  const rawUniv = state.univName || "BANGLADESH UNIVERSITY OF PROFESSIONALS";
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
  elements.pTeacherAffil.textContent = state.teacherAffiliation || "Bangladesh University of Professionals";

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
  elements.a4Sheet.className = `a4-sheet ${state.font || "font-times"} ${state.headerCase || "header-caps"} ${state.topicSize || "topic-lg"} ${state.border || "border-none"} ${state.spacing || "spacing-balanced"}`;
  if (elements.pLogo.getAttribute("src") !== state.logo) elements.pLogo.src = state.logo;
  elements.pLogo.style.height = `${state.logoPx || 112}px`;
}

function attachEventListeners() {
  elements.univSelect.addEventListener("change", (e) => {
    state.univ = e.target.value;
    showUniversity(state.univ, true);
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
    const sheetNaturalWidth = 210 * 3.7795275591;
    if (containerWidth < sheetNaturalWidth) {
      const fitZoom = Math.max(0.25, containerWidth / sheetNaturalWidth);
      // floor, never round up: rounding up makes the sheet wider than the container
      applyZoom(Math.floor(fitZoom * 100) / 100);
    } else if (currentZoom < 1.0) {
      applyZoom(1.0);
    }
  };

  window.addEventListener("resize", updateScale);
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
function populateTeacherSearch() {
  const box = elements.teacherSearch;
  const depts = (univ?.faculties || []).flatMap(f => f.departments);
  box.items = (univ?.teachers || []).map(([name, t, d]) => {
    const title = univ.titles[t];
    const prefix = /^(Dr|Prof)\b/i.test(name) ? "" : TITLE_PREFIX[title];
    const label = prefix ? `${prefix} ${name}` : name;
    return { value: label, label, sub: [title, depts[d]].filter(Boolean).join(" / "), data: { name: label, dept: depts[d] } };
  });
  const short = UNIVERSITIES.find(u => u.id === state.univ)?.short || "";
  box.$input.placeholder = univ
    ? `Search ${univ.teachers.length} ${short} teachers by name or department`
    : "Directory unavailable, type the teacher below";
}

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
  const { bytes: merged } = await window.BUPCoverPDF.merge(state, bytes);

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
