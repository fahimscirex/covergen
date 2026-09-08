/**
 * BUP Assignment Cover Page Generator
 * Original Format with Optimized Academic Typography
 * Pure Vanilla JS, Zero dependencies.
 */

const BUP_FACULTIES = {
  FBS: {
    short: "FBS",
    full: "Faculty of Business Studies",
    departments: [
      { short: "Marketing", full: "Dept. of Marketing", val: "Department of Marketing" },
      { short: "AIS", full: "Dept. of Accounting & Information Systems", val: "Department of Accounting & Information Systems (AIS)" },
      { short: "Finance", full: "Dept. of Finance & Banking", val: "Department of Finance & Banking" },
      { short: "Management", full: "Dept. of Management Studies", val: "Department of Management Studies" },
      { short: "General BBA", full: "Dept. of Business Administration", val: "Department of Business Administration in General" }
    ]
  },
  FASS: {
    short: "FASS",
    full: "Faculty of Arts & Social Sciences",
    departments: [
      { short: "Economics", full: "Dept. of Economics", val: "Department of Economics" },
      { short: "English", full: "Dept. of English", val: "Department of English" },
      { short: "Sociology", full: "Dept. of Sociology", val: "Department of Sociology" },
      { short: "Pub. Admin", full: "Dept. of Public Administration", val: "Department of Public Administration" },
      { short: "Dev. Studies", full: "Dept. of Development Studies", val: "Department of Development Studies" },
      { short: "Disaster Mgt.", full: "Dept. of Disaster & Human Security", val: "Department of Disaster & Human Security Management" }
    ]
  },
  FST: {
    short: "FST",
    full: "Faculty of Science & Technology",
    departments: [
      { short: "CSE", full: "Dept. of Computer Science & Engineering", val: "Department of Computer Science & Engineering (CSE)" },
      { short: "ICT", full: "Dept. of Information & Communication Technology", val: "Department of Information & Communication Technology (ICT)" },
      { short: "Env. Science", full: "Dept. of Environmental Science", val: "Department of Environmental Science" }
    ]
  },
  FSSS: {
    short: "FSSS",
    full: "Faculty of Security & Strategic Studies",
    departments: [
      { short: "IR", full: "Dept. of International Relations", val: "Department of International Relations (IR)" },
      { short: "Law", full: "Dept. of Law", val: "Department of Law (LL.B)" },
      { short: "Peace & Conflict", full: "Dept. of Peace, Conflict & Human Rights", val: "Department of Peace, Conflict & Human Rights" },
      { short: "MCJ", full: "Dept. of Mass Communication & Journalism", val: "Department of Mass Communication & Journalism" }
    ]
  }
};

const DEFAULT_DATA = {
  univName: "BANGLADESH UNIVERSITY OF PROFESSIONALS",
  headerCase: "header-caps",
  headerPt: 21,
  univTagline: "Excellence Through Knowledge",
  showTagline: true,
  univAddress: "Mirpur Cantonment, Dhaka-1216, Bangladesh",
  showAddress: true,
  faculty: "FBS",
  department: "Department of Marketing",
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
let currentZoom = 1.0;

const elements = {
  univNameInput: document.getElementById("univNameInput"),
  headerCaseSelect: document.getElementById("headerCaseSelect"),
  headerSizeSelect: document.getElementById("headerSizeSelect"),
  univTaglineInput: document.getElementById("univTaglineInput"),
  showTagline: document.getElementById("showTagline"),
  univAddressInput: document.getElementById("univAddressInput"),
  showAddress: document.getElementById("showAddress"),
  facultyPreset: document.getElementById("facultyPreset"),
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
  populateDepartmentDropdown();
  syncFormFromState();
  renderMembersInputs();
  setupFacultyAutocomplete();
  updatePreview();
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

function populateDepartmentDropdown() {
  const selectedFaculty = elements.facultyPreset.value || state.faculty || "FBS";
  const faculty = BUP_FACULTIES[selectedFaculty];
  const items = faculty
    ? faculty.departments.map(d => ({ value: d.val, label: d.short, full: d.full }))
    : [];
  elements.deptPreset.items = items;
  const match = items.find(i => i.value === state.department);
  elements.deptPreset.value = (match || items[0] || {}).value || "";
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

  elements.facultyPreset.value = state.faculty || "FBS";
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
  elements.pLogo.style.height = `${state.logoPx || 112}px`;
}

function attachEventListeners() {
  elements.facultyPreset.addEventListener("change", (e) => {
    state.faculty = e.target.value;
    const first = BUP_FACULTIES[state.faculty]?.departments[0];
    if (first) state.department = first.val;
    populateDepartmentDropdown();
    if (first) {
      state.studentDept = first.val;
      elements.studentDept.value = first.val;
    }
    updatePreview();
    saveState();
  });

  elements.deptPreset.addEventListener("change", (e) => {
    const val = e.target.value;
    if (val) {
      state.department = val;
      state.studentDept = val;
      elements.studentDept.value = val;
      if (!elements.teacherDept.value || elements.teacherDept.value.startsWith("Department")) {
        state.teacherDept = val;
        elements.teacherDept.value = val;
      }
      updatePreview();
      saveState();
    }
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
    populateDepartmentDropdown();
    syncFormFromState();
    renderMembersInputs();
    updatePreview();
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

// Setup search & autocomplete for 387 BUP faculty members
// Faculty directory search, now an <interior-combobox>: the component owns the
// filtering UI, keyboard contract and highlight; this owns what a pick means.
function setupFacultyAutocomplete() {
  const box = elements.teacherSearch;
  if (!box) return;

  box.items = (window.BUP_FACULTY_DATA || []).map((f) => ({
    value: f.formattedName || f.name,
    label: f.formattedName || f.name,
    sub: [f.designation, f.department].filter(Boolean).join(" / "),
    data: f,
  }));

  box.addEventListener("pick", (e) => {
    const f = e.detail.item.data;
    state.teacherName = f.formattedName || f.name;
    state.teacherDept = f.department || state.teacherDept;
    state.teacherAffiliation = "Bangladesh University of Professionals";
    elements.teacherName.value = state.teacherName;
    elements.teacherDept.value = state.teacherDept;
    elements.teacherAffiliation.value = state.teacherAffiliation;
    updatePreview();
    saveState();
  });
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
