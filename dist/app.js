import { groups, scan, copySettings } from "./transfer.js";

const panel = document.querySelector("#panel");
const status = document.querySelector("#status");
const guide = document.querySelector("#guide");
const byId = (id) => document.getElementById(id);
byId("help").onclick = () => guide.showModal();
byId("close").onclick = () => guide.close();
const label = (a) => (a.label ? a.label + " · " + a.id : "Friend ID " + a.id);
let folder,
  accounts = [],
  source,
  target,
  choices = new Set(),
  remembered,
  busy = false;
const db = new Promise((resolve, reject) => {
  const request = indexedDB.open("dota-relay", 1);
  request.onupgradeneeded = () => request.result.createObjectStore("folders");
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
}).catch(() => null);

async function memory(method, handle) {
  const connection = await db;
  if (!connection) return;
  return new Promise((resolve, reject) => {
    const tx = connection.transaction(
      "folders",
      method === "put" ? "readwrite" : "readonly",
    );
    const store = tx.objectStore("folders");
    const req =
      method === "put" ? store.put(handle, "steam") : store.get("steam");
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
  }).catch(() => undefined);
}
function step(number) {
  status.textContent = "";
  document.querySelectorAll("[data-step]").forEach((el, i) => {
    el.classList.toggle("active", i === number);
    if (i === number) el.setAttribute("aria-current", "step");
    else el.removeAttribute("aria-current");
  });
}
function notice(error) {
  status.textContent =
    error.name === "NotAllowedError" || error.name === "SecurityError"
      ? "Akses folder belum diberikan. Buka situs langsung di Chrome atau Edge desktop dan izinkan akses ke folder Steam."
      : error.name === "AbortError"
        ? "Folder belum dipilih. Jika jendela pemilih tidak muncul, buka situs ini langsung di Chrome atau Edge desktop, atau seret folder userdata Steam ke panel."
        : error.message;
}
function connect() {
  step(0);
  const supported =
    window.isSecureContext && typeof window.showDirectoryPicker === "function";
  panel.innerHTML =
    '<div class="connect"><div class="foldericon" aria-hidden="true"><i></i></div><div><h2>Hubungkan folder Steam</h2><p>Pilih folder Steam untuk melihat akun Dota 2 di PC ini.</p></div><button class="primary" id="pick">Pilih folder Steam ↗</button></div><div class="actions" id="resume"></div><details class="hint"><summary>Di mana folder Steam saya?</summary><p>Pilih folder instalasi Steam atau subfolder <code>userdata</code>. Lokasi umum Windows adalah <code>C:\\Program Files (x86)\\Steam</code>. Tempel alamatnya di dialog pemilih folder.</p></details>';
  const externalHelp =
    "Buka alamat ini di Chrome atau Edge desktop untuk memilih folder Steam.";
  const dropSupported =
    window.isSecureContext &&
    typeof window.DataTransferItem?.prototype.getAsFileSystemHandle ===
      "function";
  const instructions = panel.querySelector(".connect p");
  instructions.textContent = dropSupported
    ? "Pilih folder Steam, atau seret folder userdata ke panel ini."
    : "Pilih folder Steam untuk melihat akun Dota 2 di PC ini.";
  const recovery = document.createElement("div");
  recovery.className = "hint";
  recovery.hidden = true;
  const address = document.createElement("input");
  address.readOnly = true;
  address.value = location.origin + location.pathname;
  address.setAttribute("aria-label", "Alamat situs");
  address.onclick = () => address.select();
  recovery.append(externalHelp, " ", address);
  byId("resume").after(recovery);
  panel.ondragover = (event) => {
    if (!dropSupported || !event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };
  panel.ondrop = (event) => {
    event.preventDefault();
    if (!dropSupported || busy) return;
    const item = [...event.dataTransfer.items].find(
      (item) => item.kind === "file",
    );
    if (item) openFolder(false, item.getAsFileSystemHandle());
  };
  if (!supported) {
    byId("pick").textContent = "Cara membuka di browser";
    recovery.hidden = false;
  }
  byId("pick").onclick = () => {
    if (supported) openFolder(false);
    else {
      recovery.hidden = false;
      address.focus();
      address.select();
    }
  };
  if (supported && remembered) {
    const btn = document.createElement("button");
    btn.className = "secondary";
    btn.textContent = "Gunakan folder sebelumnya";
    btn.onclick = () => openFolder(true);
    byId("resume").append(btn);
  }
}
async function openFolder(reuse, dropped) {
  if (busy) return;
  busy = true;
  try {
    status.textContent =
      dropped || reuse ? "Menghubungkan folder…" : "Menunggu pemilihan folder…";
    const recovery = panel.querySelector(".hint:has(input[readonly])");
    if (recovery) recovery.hidden = false;
    const handle = dropped
      ? await dropped
      : reuse
        ? remembered
        : await window.showDirectoryPicker({ id: "dota-relay", mode: "read" });
    if (handle?.kind !== "directory")
      throw new Error("Seret folder Steam atau userdata ke panel.");
    if (
      reuse &&
      (await handle.requestPermission({ mode: "read" })) !== "granted"
    )
      throw new DOMException("Akses ditolak", "NotAllowedError");
    status.textContent = "Mencari akun Dota 2…";
    const result = await scan(handle);
    folder = result.data;
    accounts = result.accounts;
    remembered = handle;
    void memory("put", handle);
    source = target = null;
    choices.clear();
    if (accounts.length < 2) {
      connect();
      status.textContent =
        "Ditemukan " +
        accounts.length +
        " akun Dota 2. Buka Dota 2 sekali di kedua akun pada PC ini, lalu pilih ulang folder.";
      return;
    }
    selectAccounts();
  } catch (error) {
    notice(error);
  } finally {
    busy = false;
  }
}
function selectedPaths() {
  return groups.flatMap((group, i) =>
    choices.has(i) ? group.paths.filter((p) => source?.available.has(p)) : [],
  );
}
function selectAccounts() {
  panel.ondragover = panel.ondrop = null;
  step(1);
  panel.innerHTML =
    '<h2>Pilih akun dan pengaturan</h2><p id="found"></p><div class="selects"><label>Akun asal<select id="source"></select></label><label>Akun tujuan<select id="target"></select></label></div><fieldset><legend>Pengaturan yang disalin</legend><div id="groups"></div></fieldset><div class="actions"><button class="primary" id="review">Tinjau transfer →</button><button class="secondary" id="folder">Ganti folder</button></div>';
  byId("found").textContent = accounts.length + " akun Dota 2 ditemukan.";
  for (const [key, current] of [
    ["source", source],
    ["target", target],
  ]) {
    const select = byId(key);
    select.add(
      new Option("Pilih akun " + (key === "source" ? "asal" : "tujuan"), ""),
    );
    for (const account of accounts) {
      const option = new Option(label(account), account.id);
      option.disabled =
        key === "target" ? account === source : !account.available.size;
      select.add(option);
    }
    select.value = current?.id || "";
    select.onchange = () => {
      const value = accounts.find((a) => a.id === select.value);
      if (key === "source") {
        source = value;
        if (target === source) target = null;
        choices = new Set(
          groups
            .map((g, i) =>
              g.paths.some((p) => source?.available.has(p)) ? i : -1,
            )
            .filter((i) => i >= 0),
        );
      } else target = value;
      selectAccounts();
      byId(key).focus();
    };
  }
  for (const [i, group] of groups.entries()) {
    const row = document.createElement("label"),
      input = document.createElement("input");
    input.type = "checkbox";
    input.disabled = !group.paths.some((p) => source?.available.has(p));
    input.checked = choices.has(i);
    input.onchange = () => {
      if (input.checked) choices.add(i);
      else choices.delete(i);
      update();
    };
    row.append(
      input,
      " " + group.name + (source && input.disabled ? " · tidak ditemukan" : ""),
    );
    byId("groups").append(row);
  }
  function update() {
    byId("review").disabled = !source || !target || !selectedPaths().length;
  }
  update();
  byId("review").onclick = review;
  byId("folder").onclick = connect;
}
function review() {
  step(2);
  panel.innerHTML =
    '<h2>Tinjau transfer</h2><p id="route"></p><ul id="files"></ul><p>Tunggu Steam Cloud selesai sinkron, lalu tutup Dota 2 dan Steam sebelum menyalin. File tujuan yang akan diganti dicadangkan terlebih dahulu.</p><div class="actions"><button class="primary" id="copy">Salin pengaturan</button><button class="secondary" id="back">Kembali</button></div>';
  byId("route").textContent = label(source) + " → " + label(target);
  for (const path of selectedPaths()) {
    const li = document.createElement("li");
    li.textContent = path;
    byId("files").append(li);
  }
  byId("back").onclick = selectAccounts;
  byId("copy").onclick = transfer;
}
async function transfer() {
  if (busy) return;
  busy = true;
  byId("copy").disabled = true;
  byId("back").disabled = true;
  try {
    if ((await folder.requestPermission({ mode: "readwrite" })) !== "granted")
      throw new DOMException("Akses tulis ditolak", "NotAllowedError");
    status.textContent = "Memeriksa file, membuat cadangan, dan menyalin…";
    const result = await navigator.locks.request(
      "dota-relay-copy",
      { ifAvailable: true },
      async (lock) => {
        if (!lock) throw new Error("Transfer sedang berjalan di tab lain.");
        return copySettings(source, target, selectedPaths());
      },
    );
    step(2);
    panel.innerHTML =
      '<div class="result"><h2 id="done"></h2><p id="summary"></p><p id="backup"></p><div class="actions"><button class="secondary" id="again">Transfer lainnya</button></div></div>';
    byId("done").textContent = result.count
      ? "Transfer selesai"
      : "Pengaturan sudah sama";
    byId("summary").textContent = result.count
      ? result.count +
        " file disalin dan diverifikasi untuk " +
        label(target) +
        "."
      : "Semua file pilihan sudah sama di kedua akun.";
    if (result.backup)
      byId("backup").textContent = "Cadangan di userdata/" + result.backup;
    byId("again").onclick = () => openFolder(true);
  } catch (error) {
    notice(error);
    byId("copy").disabled = false;
    byId("back").disabled = false;
  } finally {
    busy = false;
  }
}
connect();
memory("get").then((handle) => {
  if (handle && !remembered && !busy && byId("pick") && !status.textContent) {
    remembered = handle;
    connect();
  }
});
