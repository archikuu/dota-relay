export const groups = [
  {
    name: "Hotkey dan quickcast",
    paths: ["user_keys.vcfg", "cfg/dotakeys_personal.lst"],
  },
  { name: "Opsi permainan", paths: ["user_convars.vcfg"] },
  { name: "Susunan hero", paths: ["cfg/hero_grid_config.json"] },
];

async function optional(action) {
  try {
    return await action();
  } catch (error) {
    if (error.name === "NotFoundError") return null;
    throw error;
  }
}

async function parentOf(root, path, create = false) {
  const parts = path.split("/");
  const name = parts.pop();
  for (const part of parts)
    root = await root.getDirectoryHandle(part, { create });
  return { dir: root, name };
}

async function read(root, path) {
  return optional(async () => {
    const { dir, name } = await parentOf(root, path);
    return (await dir.getFileHandle(name)).getFile();
  });
}

async function put(root, path, blob) {
  const { dir, name } = await parentOf(root, path, true);
  const file = await dir.getFileHandle(name, { create: true });
  const stream = await file.createWritable();
  try {
    await stream.write(blob);
    await stream.close();
  } catch (error) {
    await stream.abort().catch(() => {});
    throw error;
  }
}

async function digest(blob) {
  if (!blob) return null;
  const bytes = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

async function personaNames(root) {
  const names = new Map();
  const file = await read(root, "config/loginusers.vdf");
  if (!file) return names;
  const contents = await file.text();
  for (const match of contents.matchAll(
    /"(\d{17})"\s*\{((?:[^"}]|"(?:\\.|[^"\\])*")*)\}/g,
  )) {
    const name = /"PersonaName"\s*"((?:\\.|[^"\\])*)"/i.exec(match[2]);
    if (name)
      names.set(
        String(BigInt(match[1]) - 76561197960265728n),
        name[1].replace(/\\(["\\])/g, "$1"),
      );
  }
  return names;
}

export async function scan(root) {
  const direct = root.name.toLowerCase() === "userdata";
  const data = direct
    ? root
    : await optional(() => root.getDirectoryHandle("userdata"));
  if (!data)
    throw new Error(
      "Pilih folder Steam yang berisi userdata, atau pilih folder userdata langsung.",
    );
  const names = direct ? new Map() : await personaNames(root);
  const accounts = [];
  for await (const dir of data.values()) {
    if (dir.kind !== "directory" || !/^\d+$/.test(dir.name)) continue;
    const game = await optional(() => dir.getDirectoryHandle("570"));
    const remote =
      game && (await optional(() => game.getDirectoryHandle("remote")));
    if (!remote) continue;
    const available = new Set();
    for (const path of groups.flatMap((g) => g.paths))
      if (await read(remote, path)) available.add(path);
    accounts.push({
      id: dir.name,
      label: names.get(dir.name) || "",
      game,
      remote,
      available,
    });
  }
  return {
    data,
    accounts: accounts.sort((a, b) =>
      (a.label || a.id).localeCompare(b.label || b.id),
    ),
  };
}

export async function copySettings(from, to, paths) {
  if (!from || !to || from.id === to.id)
    throw new Error("Pilih dua akun yang berbeda.");
  const allowed = groups.flatMap((group) => group.paths);
  if (!paths.length || paths.some((p) => !allowed.includes(p)))
    throw new Error("Pilihan file tidak valid.");
  const entries = [];
  for (const path of new Set(paths)) {
    const src = await read(from.remote, path);
    if (!src) throw new Error("File asal berubah. Pilih ulang folder Steam.");
    const old = await read(to.remote, path);
    const nextHash = await digest(src),
      oldHash = await digest(old);
    if (nextHash !== oldHash)
      entries.push({ path, src, old, nextHash, oldHash });
  }
  if (!entries.length) return { count: 0 };
  const backupName =
    "relay-backup-" +
    new Date().toISOString().replace(/[:.]/g, "-") +
    "-" +
    crypto.randomUUID().slice(0, 8);
  const backup = await to.game.getDirectoryHandle(backupName, { create: true });
  for (const item of entries)
    if (item.old) {
      await put(backup, item.path, item.old);
      if ((await digest(await read(backup, item.path))) !== item.oldHash)
        throw new Error("Verifikasi cadangan gagal. Silakan ulangi transfer.");
    }
  const manifest = entries.map(({ path, oldHash, nextHash }) => ({
    path,
    previous: oldHash,
    copied: nextHash,
  }));
  await put(
    backup,
    "backup.json",
    new Blob([
      JSON.stringify(
        { source: from.id, target: to.id, files: manifest },
        null,
        2,
      ),
    ]),
  );
  const changed = [];
  try {
    for (const item of entries) {
      if ((await digest(await read(to.remote, item.path))) !== item.oldHash)
        throw new Error("File tujuan berubah selama transfer.");
      changed.push(item);
      await put(to.remote, item.path, item.src);
      if ((await digest(await read(to.remote, item.path))) !== item.nextHash)
        throw new Error("Verifikasi file tujuan gagal.");
    }
  } catch (error) {
    let restored = true;
    for (const item of changed.reverse()) {
      try {
        if ((await digest(await read(to.remote, item.path))) === item.oldHash)
          continue;
        if (item.old) {
          await put(to.remote, item.path, await read(backup, item.path));
        } else {
          const { dir, name } = await parentOf(to.remote, item.path);
          await dir.removeEntry(name);
        }
        if ((await digest(await read(to.remote, item.path))) !== item.oldHash)
          restored = false;
      } catch {
        restored = false;
      }
    }
    throw new Error(
      error.message +
        " " +
        (restored
          ? "File tujuan kembali seperti semula."
          : "Pemulihan belum lengkap. Periksa cadangan.") +
        " Cadangan di " +
        to.id +
        "/570/" +
        backupName,
    );
  }
  return { count: entries.length, backup: to.id + "/570/" + backupName };
}
