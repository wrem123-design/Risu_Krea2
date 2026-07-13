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

const descriptor = (name, outfit, background, composition, slot = 0, source = 'extra') => `{
  name = '${name}', character_count = 1,
  identities = {{ identity_key = '${name}', name = '${name}', source = '${source}', appearance = '${name} appearance' }},
  appearance = '${name} detailed appearance', outfit = '${outfit}',
  background = '${background}', composition = '${composition}',
  details = '${name} distinct rendering details', slot = ${slot}
}`;

const harness = `
local queue = {
  ${descriptor('Scene A duplicate', 'white shirt', 'messy dressing room', 'medium reaction shot', 0)},
  ${descriptor('Scene B', 'red coat', 'rainy station', 'wide departure shot', 1)},
  ${descriptor('Scene B duplicate', 'red coat', 'rainy station', 'wide departure shot', 1)},
  ${descriptor('Scene C', 'blue jacket', 'sunlit rooftop', 'low angle confrontation', 2)},
  ${descriptor('Scene C duplicate', 'blue jacket', 'sunlit rooftop', 'low angle confrontation', 2)},
  ${descriptor('Scene D', 'brown jacket', 'apartment hallway', 'low angle arrival shot', 3)}
}
local sceneSelectionValue = '1'
function getGlobalVar(_, name)
  if name == 'toggle_lb-xnai.imageCount' then return '4' end
  if name == 'toggle_lb-xnai.keyVisual' then return '2' end
  if name == 'toggle_lb-xnai.sceneSelection' then return sceneSelectionValue end
  return ''
end
function getChatVar() return '' end
local lastPromptText = ''
function axLLM(_, prompt)
  lastPromptText = prompt[2].content
  return { success = true, result = '<lb-xnai>candidate</lb-xnai>' }
end
prelude = {
  trim = function(value) return tostring(value or ''):match('^%s*(.-)%s*$') end,
  removeAllNodes = function(value) return value end,
  getPriorityLoreBook = function(_, name)
    if name == 'lb-xnai.lb.extra' then
      return { content = [[## Oh Deok-gu / 오덕규
Canonical appearance

### Stella, Song Hee-jin / 스텔라, 송희진
Shared aliases]] }
    end
    return nil
  end,
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
    ${descriptor('Scene A', 'white shirt', 'messy dressing room', 'medium reaction shot', 0)}
  }
}
local completed = gen.completeResponseImageCount('test', response, 'Scene A waits.\\n\\nScene B leaves.\\n\\nScene C argues.\\n\\nScene D arrives.\\n\\nThe story ends.')
assert(completed.keyvis == nil, 'disabled key visual was not converted')
assert(#completed.scenes == 4, 'expected four valid scenes')
for _, scene in ipairs(completed.scenes) do
  assert(scene.appearance and scene.outfit and scene.background and scene.composition and scene.details)
  assert(scene.name ~= 'Broken', 'malformed descriptor survived sanitization')
end
assert(completed.scenes[1].name == 'Scene A')
assert(completed.scenes[2].name == 'Scene B')
assert(completed.scenes[3].name == 'Scene C')
assert(completed.scenes[4].name == 'Scene D')
assert(completed.scenes[1].slot == 0 and completed.scenes[2].slot == 1 and completed.scenes[3].slot == 2 and completed.scenes[4].slot == 3)

queue = {
  ${descriptor('Fresh A', 'gray hoodie', 'night bus stop', 'wide waiting shot', 0)},
  ${descriptor('Fresh B', 'green coat', 'corner store', 'medium conversation shot', 1)},
  ${descriptor('Fresh C', 'navy uniform', 'empty classroom', 'over shoulder reaction shot', 2)},
  ${descriptor('Fresh D', 'brown jacket', 'apartment hallway', 'low angle arrival shot', 3)}
}
local recovered = gen.completeResponseImageCount('test', {
  scenes = { malformed }
}, 'Fresh A waits.\\n\\nFresh B speaks.\\n\\nFresh C reacts.\\n\\nFresh D arrives.\\n\\nThe story ends.')
assert(#recovered.scenes == 4, 'an all-malformed response was not rebuilt')
assert(recovered.scenes[1].name == 'Fresh A', 'fresh seed scene was not requested')
assert(lastPromptText:find('strongest visually consequential', 1, true), 'scene selection policy missing from repair prompt')
assert(lastPromptText:find('Existing cast coverage:', 1, true), 'cast coverage missing from repair prompt')

sceneSelectionValue = '0'
queue = {
  ${descriptor('Spread A', 'black coat', 'first room', 'early establishing shot', 1)},
  ${descriptor('Spread B', 'white coat', 'second room', 'middle interaction shot', 5)},
  ${descriptor('Spread C', 'red coat', 'third room', 'later confrontation shot', 8)},
  ${descriptor('Spread D', 'blue coat', 'final room', 'ending reaction shot', 10)}
}
local clustered = { scenes = {
  ${descriptor('Ordinal A', 'a coat', 'room a', 'shot a', 0)},
  ${descriptor('Ordinal B', 'b coat', 'room b', 'shot b', 1)},
  ${descriptor('Ordinal C', 'c coat', 'room c', 'shot c', 2)},
  ${descriptor('Ordinal D', 'd coat', 'room d', 'shot d', 3)}
} }
local longStory = table.concat({
  'p1','Spread A appears','p3','p4','p5','Spread B appears','p7','p8',
  'Spread C appears','p10','Spread D appears','p12','p13'
}, '\\n\\n')
local spread = gen.completeResponseImageCount('test', clustered, longStory)
assert(spread.scenes[1].name == 'Spread A', 'ordinal top cluster was not rebuilt')
assert(spread.scenes[2].slot == 5 and spread.scenes[3].slot == 8 and spread.scenes[4].slot == 10)

local wrongKnownCharacter = ${descriptor('Oh Deok-gu', 'gray suit', 'hotel lounge', 'medium portrait', 0, 'lorebook')}
local wrongKnownCharacterAsExtra = ${descriptor('Oh Deok-gu', 'gray suit', 'hotel lounge', 'medium portrait', 0, 'extra')}
local realExtra = {
  name = '강혜정', character_count = 1,
  identities = {{ identity_key = 'extra-kang-hyejeong-1', name = '강혜정', source = 'extra', appearance = '강혜정 fixed physical appearance' }},
  appearance = '강혜정 detailed appearance', outfit = 'cream jacket and dark trousers',
  background = 'quiet hotel lounge', composition = 'seated conversation portrait',
  details = 'soft practical lighting and realistic material detail', slot = 0
}
local groundingStory = table.concat({
  '강혜정은 창가에 앉아 송희진을 기다렸다.', '송희진이 라운지로 들어왔다.',
  '두 사람은 서로를 바라봤다.', 'filler four', 'filler five', 'filler six',
  '오덕규의 기술에 관한 소문이 나중에 언급되었다.'
}, '\\n\\n')
assert(gen.descriptorGroundedAtSlot('test', wrongKnownCharacter, groundingStory) == false,
  'a canonical character absent from the selected scene was accepted')
assert(gen.descriptorGroundedAtSlot('test', wrongKnownCharacterAsExtra, groundingStory) == false,
  'a canonical character bypassed grounding by claiming source extra')
assert(gen.descriptorGroundedAtSlot('test', realExtra, groundingStory) == true,
  'an unlisted named extra copied from the story was rejected')
local provisionalExtra = ${descriptor('Kang Hye-jeong', 'cream jacket', 'hotel lounge', 'medium portrait', 0, 'extra')}
assert(gen.descriptorGroundedAtSlot('test', provisionalExtra, groundingStory) == true,
  'a complete first-appearance extra was blocked before it could enter temporary memory')
assert(gen.isCanonicalLorebookName('test', 'Song Hee-jin') == true,
  'comma-separated English lorebook aliases were not recognized')
assert(gen.isCanonicalLorebookName('test', '송희진') == true,
  'comma-separated Korean lorebook aliases were not recognized')
assert(gen.isCanonicalLorebookName('test', 'Oh Deok-gu') == true,
  'a canonical profile using a level-two lorebook heading was not recognized')
local shortNameStory = table.concat({
  '송희진은 라운지에 도착했다.', 'filler two', 'filler three', 'filler four',
  'filler five', '희진은 은색 포크를 집어 들었다.', 'filler seven', 'filler eight'
}, '\\n\\n')
local shortNameScene = ${descriptor('Song Hee-jin', 'ivory jacket', 'private lounge', 'medium seated portrait', 5, 'lorebook')}
assert(gen.descriptorGroundedAtSlot('test', shortNameScene, shortNameStory) == true,
  'a Korean full name introduced earlier did not ground its nearby given-name mention')
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
      '🔦라이트보드 🌠 삽화 Krea2 4.4.19.module.charx'
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
