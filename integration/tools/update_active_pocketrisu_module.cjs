/** Replace the active Krea2 module while preserving its PocketRisu module ID. */

const fs = require('fs');
const path = require('path');

function fail(message) {
  throw new Error(message);
}

function loadRpackDecodeMap(pocketRisuRoot) {
  const assets = path.join(pocketRisuRoot, 'dist', 'assets');
  const bundle = fs.readdirSync(assets).find((name) =>
    name.startsWith('database.svelte-') && name.endsWith('.js'));
  if (!bundle) fail('PocketRisu database bundle was not found.');
  const source = fs.readFileSync(path.join(assets, bundle), 'utf8');
  const pattern = /data:application\/octet-stream;base64,([^`]+)`/g;
  for (const match of source.matchAll(pattern)) {
    let raw;
    try {
      raw = Buffer.from(match[1], 'base64');
    } catch {
      continue;
    }
    if (raw.length !== 512) continue;
    const encodeMap = raw.subarray(0, 256);
    const decodeMap = raw.subarray(256);
    let valid = true;
    for (let value = 0; value < 256; value += 1) {
      if (decodeMap[encodeMap[value]] !== value) {
        valid = false;
        break;
      }
    }
    if (valid) return decodeMap;
  }
  fail('PocketRisu RPack decode map was not found.');
}

function decodeLegacyModule(charxPath, pocketRisuRoot) {
  const { unzipSync } = require(path.join(pocketRisuRoot, 'node_modules', 'fflate'));
  const archive = unzipSync(fs.readFileSync(charxPath));
  const payload = archive['module.risum'];
  if (!payload || payload.length < 7 || payload[0] !== 111 || payload[1] !== 0) {
    fail('The CharX file has no supported module.risum payload.');
  }
  const mainLength = Buffer.from(payload).readUInt32LE(2);
  const encoded = payload.subarray(6, 6 + mainLength);
  const decodeMap = loadRpackDecodeMap(pocketRisuRoot);
  const decoded = Buffer.allocUnsafe(encoded.length);
  for (let index = 0; index < encoded.length; index += 1) {
    decoded[index] = decodeMap[encoded[index]];
  }
  const legacy = JSON.parse(decoded.toString('utf8'));
  if (legacy.type !== 'risuModule' || !legacy.module) {
    fail('The CharX payload is not a Risu module.');
  }
  return legacy.module;
}

async function main() {
  const pocketRisuRoot = path.resolve(process.argv[2] || 'E:/Chatbot/PocketRisu-v1.7.3-win-x64');
  const charxPath = path.resolve(process.argv[3] || '');
  if (!fs.existsSync(charxPath)) fail(`Module artifact does not exist: ${charxPath}`);

  const serverDir = path.join(pocketRisuRoot, 'server', 'node');
  process.chdir(pocketRisuRoot);
  const { kvGet, kvSet, kvCopyValue, checkpointWal } = require(path.join(serverDir, 'db.cjs'));
  const { decodeRisuSave, encodeRisuSaveLegacy } = require(path.join(serverDir, 'utils.cjs'));
  const replacement = decodeLegacyModule(charxPath, pocketRisuRoot);
  const databaseKey = 'database/database.bin';
  const raw = kvGet(databaseKey);
  if (!raw) fail('PocketRisu database was not found.');
  const database = await decodeRisuSave(raw);
  const modules = Array.isArray(database.modules) ? database.modules : [];
  const matches = modules
    .map((module, index) => ({ module, index }))
    .filter(({ module }) => String(module?.name || '').startsWith('🔦라이트보드 🌠 삽화 Krea2 '));
  if (matches.length !== 1) {
    fail(`Expected one active Krea2 illustration module, found ${matches.length}.`);
  }

  const current = matches[0].module;
  const preservedId = current.id;
  replacement.id = preservedId;
  modules[matches[0].index] = replacement;
  database.modules = modules;
  database.enabledModules = Array.isArray(database.enabledModules)
    ? database.enabledModules
    : [];
  if (!database.enabledModules.includes(preservedId)) {
    database.enabledModules.push(preservedId);
  }

  const backupKey = `database/dbbackup-before-krea2-module-${Date.now()}.bin`;
  kvCopyValue(databaseKey, backupKey);
  kvSet(databaseKey, Buffer.from(encodeRisuSaveLegacy(database)));
  checkpointWal();
  process.stdout.write(JSON.stringify({
    success: true,
    previousName: current.name,
    activeName: replacement.name,
    moduleId: preservedId,
    backupKey,
  }, null, 2));
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
