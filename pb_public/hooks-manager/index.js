const SUPERUSER_TOKEN = JSON.parse(
  localStorage.getItem("pb_admin_auth")
)?.token;

// 1. Auth Guard
if (
  !SUPERUSER_TOKEN ||
  JSON.parse(atob(SUPERUSER_TOKEN.split(".")[1])).exp <
    Math.round(Date.now() / 1000)
) {
  window.location.href = window.location.origin + "/_/#/login";
}

let currentFilePath = "";
let lastSavedContent = "";
const editor = document.getElementById("editor");
const codeLayer = document.getElementById("highlight-code");
const saveBtn = document.getElementById("save-btn");

/**
 * Global Fetch Wrapper
 */
async function pbFetch(url, options = {}) {
  options.headers = { ...options.headers, Authorization: SUPERUSER_TOKEN };
  const res = await fetch(url, options);
  if (res.status === 401 || res.status === 403)
    window.location.href = window.location.origin + "/_/#/login";
  return res;
}

// --- EDITOR UI LOGIC ---

function updateEditor() {
  let content = editor.value;

  // Toggle Save Button State
  if (content === lastSavedContent) {
    saveBtn.disabled = true;
    saveBtn.innerText = "Saved";
  } else {
    saveBtn.disabled = false;
    saveBtn.innerText = "Save Changes";
  }

  // Sync Prism Highlighting
  if (content[content.length - 1] == "\n") content += " ";
  codeLayer.textContent = content;
  Prism.highlightElement(codeLayer);
}

function syncScroll() {
  const pre = document.getElementById("highlight-layer");
  pre.scrollTop = editor.scrollTop;
  pre.scrollLeft = editor.scrollLeft;
}

/**
 * Key Listeners: Tab, Brackets, and Ctrl+S
 */
editor.addEventListener("keydown", function (e) {
  const start = this.selectionStart;
  const end = this.selectionEnd;
  const pairs = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'" };

  if (e.key === "Tab") {
    e.preventDefault();
    this.value =
      this.value.substring(0, start) + "\t" + this.value.substring(end);
    this.selectionStart = this.selectionEnd = start + 1;
    updateEditor();
  }
  if (pairs[e.key]) {
    e.preventDefault();
    this.value =
      this.value.substring(0, start) +
      e.key +
      pairs[e.key] +
      this.value.substring(end);
    this.selectionStart = this.selectionEnd = start + 1;
    updateEditor();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    saveFile();
  }
});

// --- FILE OPERATIONS ---

async function fetchTree() {
  const res = await pbFetch(`/hooks-manager/folder`);
  if (!res.ok) return;
  const data = await res.json();
  renderTree(data, document.getElementById("file-tree"));
}

/**
 * Load File with Auto-Save protection
 */
async function loadFile(path, skipPush = false) {
  // Check if current file has unsaved changes before switching
  if (currentFilePath && editor.value !== lastSavedContent) {
    saveBtn.innerText = "Saving...";
    await saveFile(true); // Silent save
  }

  const res = await pbFetch(`/hooks-manager/file?path=${path}`);
  if (!res.ok) return;

  const content = await res.text();
  currentFilePath = path;
  lastSavedContent = content;

  document.getElementById("current-path").innerText = path;
  editor.value = content;
  document.getElementById("delete-btn").disabled = false;

  // Update URL Query Param
  if (!skipPush) {
    const url = new URL(window.location);
    url.searchParams.set("file", path);
    window.history.pushState({}, "", url);
  }

  await fetchTree(); // Refresh tree to update highlight/routes
  updateEditor();
}

/**
 * Save File logic
 * @param {boolean} silent - If true, skips the tree refresh to speed up navigation
 */
async function saveFile(silent = false) {
  if (!currentFilePath || editor.value === lastSavedContent) return;

  saveBtn.innerText = "Saving...";

  const res = await pbFetch(`/hooks-manager/file?path=${currentFilePath}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: editor.value }),
  });

  if (res.ok) {
    lastSavedContent = editor.value;
    updateEditor();
    if (!silent) await fetchTree();
  }
}

async function createNewFile() {
  let name = prompt("File name:");
  if (!name) return;
  if (!name.endsWith(".pb.js")) name = name.split(".")[0] + ".pb.js";

  const initialContent = `routerAdd("GET", "/api/${
    name.split(".")[0]
  }", (e) => {\n\treturn e.json(200, { "message": "hello" });\n});`;

  await pbFetch(`/hooks-manager/file?path=${name}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: initialContent }),
  });
  fetchTree();
}

async function createNewFolder() {
  const name = prompt("Folder name:");
  if (name) {
    await pbFetch(`/hooks-manager/folder?path=${name}`, { method: "PUT" });
    fetchTree();
  }
}

async function deleteItem(path) {
  const target = path || currentFilePath;
  if (!target || !confirm(`Delete ${target}?`)) return;

  await pbFetch(`/hooks-manager/file?path=${target}`, { method: "DELETE" });

  if (target === currentFilePath) {
    // Reset editor if current file is deleted
    currentFilePath = "";
    lastSavedContent = "";
    editor.value = "";
    const url = new URL(window.location);
    url.searchParams.delete("file");
    window.history.pushState({}, "", url);
    updateEditor();
  }
  fetchTree();
}

// --- TREE RENDERING ---

function renderTree(data, container, parentPath = "") {
  container.innerHTML = "";
  data.forEach((item) => {
    const el = document.createElement("div");

    if (typeof item === "object" && !item.type) {
      // Folder
      const name = Object.keys(item)[0];
      const full = parentPath ? `${parentPath}/${name}` : name;
      el.className = "folder-group";
      el.innerHTML = `
                <div class="folder-header">
                    <span class="folder-label"><svg width='12' height='12' xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16">
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12.667A1.334 1.334 0 0 1 13.667 14H2.333A1.334 1.334 0 0 1 1 12.667V3.333A1.333 1.333 0 0 1 2.333 2H5.5L7 4h6.667A1.333 1.333 0 0 1 15 5.333v7.334Z"/>
</svg> ${name}</span>
                    <button class="btn-icon-small btn-danger" onclick="deleteItem('${full}')"><svg width='12' height='12' xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16">
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5.5 4V2.25A1.25 1.25 0 0 1 6.75 1h2.5a1.25 1.25 0 0 1 1.25 1.25V4M2 4h12m-1 0v9.625A1.375 1.375 0 0 1 11.625 15h-7.25A1.375 1.375 0 0 1 3 13.625V4h10Z"/>
</svg></button>
                </div>
                <div class="folder-children"></div>`;
      renderTree(item[name], el.querySelector(".folder-children"), full);
    } else {
      // File
      const full = parentPath ? `${parentPath}/${item.name}` : item.name;
      const activeClass = currentFilePath === full ? "active" : "";

      let routesHtml = (item.routes || [])
        .map(
          (r) => `
                <div class="route-entry">
                    <span class="method ${r.method.toLowerCase()}">${
            r.method
          }</span>
                    <span>${r.path}</span>
                </div>`
        )
        .join("");

      el.innerHTML = `
                <div class="tree-item ${activeClass}" onclick="loadFile('${full}')"><svg width='12' height='12' xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16">
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 1H3.4A1.4 1.4 0 0 0 2 2.4v11.2A1.4 1.4 0 0 0 3.4 15h9.2a1.4 1.4 0 0 0 1.4-1.4V5m-4-4 4 4m-4-4v4h4"/>
</svg> ${item.name}</div>
                <div class="route-list">${routesHtml}</div>`;
    }
    container.appendChild(el);
  });
}

// Initial Boot
window.onload = async () => {
  await fetchTree();
  const file = new URLSearchParams(window.location.search).get("file");
  if (file) loadFile(file, true); // true skips pushState to avoid duplicate history
};
