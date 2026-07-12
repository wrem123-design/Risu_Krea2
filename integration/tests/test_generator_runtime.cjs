const fs = require('fs');
const path = require('path');
const { LuaFactory } = require(path.join(
  'E:\\Chatbot\\PocketRisu-v1.7.3-win-x64',
  'node_modules',
  'wasmoon'
));
const { unzipSync } = require(path.join(
  'E:\\Chatbot\\PocketRisu-v1.7.3-win-x64',
  'node_modules',
  'fflate'
));

const builderPath = path.join(__dirname, '..', 'tools', 'build_krea2_integration.py');
const builder = fs.readFileSync(builderPath, 'utf8');
const match = /GENERATOR_LUA = r"""([\s\S]*?)"""\s+def _as_object/.exec(builder);
if (!match) throw new Error('GENERATOR_LUA not found');

const descriptor = (name, outfit, background, composition) => `{
  name = '${name}', character_count = 1,
  identities = {{ identity_key = '${name}', name = '${name}', source = 'lorebook', appearance = '${name} appearance' }},
  appearance = '${name} detailed appearance', outfit = '${outfit}',
  background = '${background}', composition = '${composition}',
  details = '${name} distinct rendering details'
}`;

const harness = `
local queue = {
  ${descriptor('Scene A duplicate', 'white shirt', 'messy dressing room', 'medium reaction shot')},
  ${descriptor('Scene B', 'red coat', 'rainy station', 'wide departure shot')},
  ${descriptor('Scene B duplicate', 'red coat', 'rainy station', 'wide departure shot')},
  ${descriptor('Scene C', 'blue jacket', 'sunlit rooftop', 'low angle confrontation')}
}
function getGlobalVar(_, name)
  if name == 'toggle_lb-xnai.imageCount' then return '4' end
  if name == 'toggle_lb-xnai.keyVisual' then return '2' end
  return ''
end
function getChatVar() return '' end
function axLLM()
  return { success = true, result = '<lb-xnai>candidate</lb-xnai>' }
end
prelude = {
  trim = function(value) return tostring(value or ''):match('^%s*(.-)%s*$') end,
  removeAllNodes = function(value) return value end,
  getPriorityLoreBook = function() return nil end,
  queryNodes = function() return {{ content = 'candidate' }} end,
  toon = { decode = function() return table.remove(queue, 1) end }
}
local function loadGenerator()
${match[1]}
end
local gen = loadGenerator()
local malformed = { name = 'Broken', character_count = 2,
  identities = { identity_key = 'Broken', name = 'Broken', appearance = 'x' } }
local response = {
  keyvis = ${descriptor('Key Scene', 'black suit', 'underground lab', 'centered establishing shot')},
  scenes = {
    malformed,
    ${descriptor('Scene A', 'white shirt', 'messy dressing room', 'medium reaction shot')}
  }
}
local completed = gen.completeResponseImageCount('test', response, 'one\\n\\ntwo\\n\\nthree\\n\\nfour')
assert(completed.keyvis == nil, 'disabled key visual was not converted')
assert(#completed.scenes == 4, 'expected four valid scenes')
for _, scene in ipairs(completed.scenes) do
  assert(scene.appearance and scene.outfit and scene.background and scene.composition and scene.details)
  assert(scene.name ~= 'Broken', 'malformed descriptor survived sanitization')
end
assert(completed.scenes[1].name == 'Scene A')
assert(completed.scenes[2].name == 'Key Scene')
assert(completed.scenes[3].name == 'Scene B')
assert(completed.scenes[4].name == 'Scene C')

queue = {
  ${descriptor('Fresh A', 'gray hoodie', 'night bus stop', 'wide waiting shot')},
  ${descriptor('Fresh B', 'green coat', 'corner store', 'medium conversation shot')},
  ${descriptor('Fresh C', 'navy uniform', 'empty classroom', 'over shoulder reaction shot')},
  ${descriptor('Fresh D', 'brown jacket', 'apartment hallway', 'low angle arrival shot')}
}
local recovered = gen.completeResponseImageCount('test', {
  scenes = { malformed }
}, 'one\\n\\ntwo\\n\\nthree\\n\\nfour')
assert(#recovered.scenes == 4, 'an all-malformed response was not rebuilt')
assert(recovered.scenes[1].name == 'Fresh A', 'fresh seed scene was not requested')
return true
`;

(async () => {
  const factory = new LuaFactory();
  const lua = await factory.createEngine();
  try {
    const result = await lua.doString(harness);
    if (result !== true) throw new Error('runtime harness did not return true');
    const modulePath = path.join(
      __dirname, '..', '..', 'module',
      '🔦라이트보드 🌠 삽화 Krea2 4.4.14.module.charx'
    );
    const archive = unzipSync(fs.readFileSync(modulePath));
    const card = JSON.parse(Buffer.from(archive['card.json']).toString('utf8'));
    const onOutput = card.data.character_book.entries.find(
      (entry) => entry.name === 'lb-xnai.lb.onOutput'
    ).content;
    lua.global.set('onOutputSource', onOutput);
    const syntaxResult = await lua.doString(`
      local compiled, syntaxError = load(onOutputSource)
      assert(compiled, syntaxError)
      return true
    `);
    if (syntaxResult !== true) throw new Error('onOutput syntax check failed');
    process.stdout.write('generator runtime: OK\n');
  } finally {
    lua.global.close();
  }
})().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
