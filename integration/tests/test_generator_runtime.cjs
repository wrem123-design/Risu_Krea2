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
local states = {}
local chatVars = {}
local capturedImagePrompt = ''
function getGlobalVar(_, name)
  if name == 'toggle_lb-xnai.imageCount' then return '4' end
  if name == 'toggle_lb-xnai.keyVisual' then return '2' end
  if name == 'toggle_lb-xnai.sceneSelection' then return sceneSelectionValue end
  return ''
end
function getChatVar(_, name) return chatVars[name] or '' end
function setChatVar(_, name, value) chatVars[name] = value end
function getState(_, name) return states[name] end
function setState(_, name, value) states[name] = value end
function generateImage(_, positive)
  capturedImagePrompt = positive
  return { await = function() return '{{inlay::identity-test}}' end }
end
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
Oh Deok-gu canonical physical appearance with a round face, thick round glasses, and a chubby build.

### Stella, Song Hee-jin / 스텔라, 송희진
Song Hee-jin canonical physical appearance with a small oval face and long dark hair.]] }
    end
    if name == '프리셋 1' then
      return { content = [[[Positive]
{appearance}

{outfit}

{background}

{composition}

{details}]] }
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
states['lb-xnai-extra-registry-v1'] = {
  { identity_key = 'extra-song-hee-jin-1', name = 'Song Hee-jin', appearance = 'stale conflicting appearance' },
  { identity_key = 'extra-kang-hyejeong-1', name = '강혜정', appearance = 'stable extra appearance' }
}
local refreshedRegistry = gen.refreshExtraRegistry('test')
assert(#refreshedRegistry == 1, 'canonical collision was not removed before planning')
assert(refreshedRegistry[1].name == '강혜정', 'a real extra was removed with the canonical collision')
assert(not chatVars['lb-xnai-extra-registry-prompt']:find('Song Hee%-jin'),
  'canonical collision remained in the planner registry prompt')
assert(chatVars['lb-xnai-extra-registry-prompt']:find('강혜정', 1, true),
  'the surviving extra was not exposed to the planner')
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
local meetingScene = {
  name = '강혜정', character_count = 2,
  identities = {
    { identity_key = 'extra-kang-hyejeong-1', name = '강혜정', source = 'extra', appearance = 'stable extra appearance' },
    { identity_key = 'Song Hee-jin', name = '송희진', source = 'lorebook', appearance = 'canonical Song Hee-jin appearance' }
  },
  appearance = '강혜정 and 송희진 have distinct complete physical appearances',
  outfit = '강혜정 wears a dark silk dress while 송희진 wears an ivory tailored jacket',
  background = 'a quiet private gallery lounge with velvet partitions and a tea table',
  composition = 'the two women sit opposite each other and exchange a tense direct gaze',
  details = 'soft gallery lighting separates both faces and preserves realistic material detail', slot = 2
}
assert(gen.descriptorGroundedAtSlot('test', meetingScene, groundingStory) == true,
  'a grounded extra and canonical character meeting scene was rejected')

queue = {
  { scenes = {{
    name = 'Broken retry scene', character_count = 1,
    identities = {{ identity_key = 'Broken retry scene', name = 'Broken retry scene', source = 'extra', appearance = 'fixed appearance' }},
    appearance = 'complete physical appearance', outfit = '',
    background = 'quiet test room', composition = 'centered test framing',
    details = 'soft test lighting', slot = 0
  }} },
  ${descriptor('Retry Scene', 'black coat', 'quiet test room', 'centered test framing', 0)}
}
local retryCandidate, retryFailure = gen.requestOneDescriptor(
  'test', { scenes = {} }, 'Retry Scene appears in the quiet test room.', false)
assert(retryCandidate and retryCandidate.name == 'Retry Scene',
  'a focused descriptor retry did not recover with the valid second candidate')
assert(retryFailure == '', 'a successful focused retry retained a failure state')
assert(lastPromptText:find('Previous candidate rejection:', 1, true),
  'the second focused retry did not receive the exact first rejection reason')
assert(lastPromptText:find('outfit', 1, true),
  'the focused retry prompt did not identify the missing outfit field')

local oneOfTwoIdentities = {
  scenes = {{
    name = '성진', character_count = 2,
    identities = {{
      identity_key = 'Oh Deok-gu', name = '덕규', source = 'lorebook',
      appearance = '오덕규 canonical physical appearance'
    }},
    appearance = '성진 and 덕규 have clearly distinct complete physical appearances',
    outfit = '성진 wears a plain shirt while 덕규 wears a stretched anime T-shirt',
    background = 'a humid underground workshop filled with computers and loose components',
    composition = '성진 points at the antigravity sphere while 덕규 turns toward him from a chair',
    details = 'blue monitor light preserves both faces and the reflective metal sphere', slot = 0
  }}
}
local repairedTwoIdentities = {
  scenes = {{
    name = '성진', character_count = 2,
    identities = {
      {
        identity_key = 'extra-seongjin-1', name = '성진', source = 'extra',
        appearance = '성진 stable physical appearance established from the story'
      },
      {
        identity_key = 'Oh Deok-gu', name = '덕규', source = 'lorebook',
        appearance = '오덕규 canonical physical appearance'
      }
    },
    appearance = '성진 and 덕규 have clearly distinct complete physical appearances',
    outfit = '성진 wears a plain shirt while 덕규 wears a stretched anime T-shirt',
    background = 'a humid underground workshop filled with computers and loose components',
    composition = '성진 points at the antigravity sphere while 덕규 turns toward him from a chair',
    details = 'blue monitor light preserves both faces and the reflective metal sphere', slot = 0
  }}
}
local changedOneOfTwoIdentities = {
  scenes = {{
    name = '성진', character_count = 2,
    identities = {{
      identity_key = 'Oh Deok-gu', name = '덕규', source = 'lorebook',
      appearance = '오덕규 canonical physical appearance'
    }},
    appearance = 'an unwanted rewritten appearance paragraph',
    outfit = 'an unwanted rewritten outfit paragraph',
    background = 'an unwanted rewritten background paragraph',
    composition = 'an unwanted rewritten composition paragraph',
    details = 'an unwanted rewritten details paragraph', slot = 0
  }}
}
queue = { oneOfTwoIdentities, changedOneOfTwoIdentities, repairedTwoIdentities }
local cardinalityCandidate, cardinalityFailure = gen.requestOneDescriptor(
  'test', { scenes = {} },
  '성진은 덕규가 앉은 의자 앞으로 다가가 반중력 구체를 가리켰다. 그 천재의 이름은 오덕규였다.', false)
assert(cardinalityCandidate and #cardinalityCandidate.identities == 2,
  'an identity-count-only third repair did not recover the two-person scene')
assert(cardinalityCandidate.outfit ==
  '성진 wears a plain shirt while 덕규 wears a stretched anime T-shirt',
  "the identity-only repair did not preserve the first candidate's valid prose")
assert(cardinalityCandidate.identities[1].name == '성진' and
  cardinalityCandidate.identities[1].source == 'extra',
  'the unlisted story participant was not repaired as a source extra identity')
assert(cardinalityCandidate.identities[2].name == '덕규' and
  cardinalityCandidate.identities[2].source == 'lorebook',
  'the canonical participant was not retained as a lorebook identity')
assert(cardinalityFailure == '',
  'a successful identity-count-only repair retained a failure state')
assert(lastPromptText:find('Identity cardinality repair:', 1, true),
  'the third repair did not receive the identity-cardinality-specific instruction')
assert(lastPromptText:find('exactly 2 identity records', 1, true),
  'the identity-cardinality retry did not state the required record count')
assert(lastPromptText:find('Rejected descriptor snapshot:', 1, true),
  'the identity-cardinality retry did not include the rejected descriptor')
assert(lastPromptText:find('오덕규 canonical physical appearance', 1, true),
  'the retry omitted the already valid canonical identity from the rejected descriptor')
assert(lastPromptText:find(
  '성진 points at the antigravity sphere while 덕규 turns toward him from a chair', 1, true),
  'the retry omitted the two-person composition used to identify the missing person')
assert(lastPromptText:find('Canonical character appearances:', 1, true),
  'the identity repair did not retain canonical profile context')
assert(lastPromptText:find('Previously established temporary extras:', 1, true),
  'the identity repair did not retain temporary extra context')

local stagedExtraScene = {
  name = 'Han Hye-jeong introduction', character_count = 1,
  identities = {{
    identity_key = 'extra-han-hye-jeong-1', name = 'Han Hye-jeong', source = 'extra',
    appearance = 'Han Hye-jeong has a narrow oval face, shoulder-length chestnut hair, and warm brown eyes'
  }},
  appearance = 'Han Hye-jeong watches the workshop doorway with a cautious expression',
  outfit = 'Han Hye-jeong wears a fitted cream cardigan over a charcoal blouse and dark trousers',
  background = 'a quiet entrance corridor outside the humid underground electronics workshop',
  composition = 'a medium solo arrival shot with Han Hye-jeong framed beside the half-open door',
  details = 'cool fluorescent light preserves her face, chestnut hair, and realistic knit fabric', slot = 0
}
local sameResponseExtraMismatch = {
  scenes = {{
    name = 'Han Hye-jeong and Oh Deok-gu', character_count = 2,
    identities = {{
      identity_key = 'oh_deok_gu', name = 'Oh Deok-gu', source = 'lorebook',
      appearance = 'Oh Deok-gu canonical physical appearance'
    }},
    appearance = 'Han Hye-jeong studies Oh Deok-gu while he answers with an awkward expression',
    outfit = 'Han Hye-jeong wears her cream cardigan while Oh Deok-gu wears a stretched anime T-shirt',
    background = 'inside the cluttered underground workshop near a desk of loose electronic components',
    composition = 'Han Hye-jeong stands opposite Oh Deok-gu as they exchange a guarded direct gaze',
    details = 'blue monitor light separates both faces and preserves realistic skin and fabric texture', slot = 1
  }}
}
local directStagedBackfill = gen.backfillKnownIdentities(
  'test', sameResponseExtraMismatch.scenes[1], { scenes = { stagedExtraScene } })
assert(directStagedBackfill and #directStagedBackfill.identities == 2,
  'the identity backfill helper could not see a valid extra from the current response')
sameResponseExtraMismatch.scenes[1].identities = {{
  identity_key = 'oh_deok_gu', name = 'Oh Deok-gu', source = 'lorebook',
  appearance = 'Oh Deok-gu canonical physical appearance'
}}
queue = {
  sameResponseExtraMismatch, sameResponseExtraMismatch,
  sameResponseExtraMismatch, sameResponseExtraMismatch
}
local stagedExtraCandidate, stagedExtraFailure = gen.requestOneDescriptor(
  'test', { scenes = { stagedExtraScene } },
  'Han Hye-jeong entered the workshop corridor.\\n\\nHan Hye-jeong faced Oh Deok-gu inside the workshop.\\n\\nThe monitor light flickered behind them.', false)
assert(stagedExtraCandidate and #stagedExtraCandidate.identities == 2,
  'a new extra established earlier in the same response was unavailable to the next scene repair: ' ..
    tostring(stagedExtraFailure))
assert(stagedExtraFailure == '', 'same-response extra backfill retained a failure state')
assert(#queue == 3, 'same-response extra backfill unnecessarily repeated the descriptor request')
assert(stagedExtraCandidate.identities[2].name == 'Han Hye-jeong' and
  stagedExtraCandidate.identities[2].source == 'extra',
  'same-response extra backfill did not restore the missing new participant')
assert(stagedExtraCandidate.identities[2].appearance == stagedExtraScene.identities[1].appearance,
  'same-response extra backfill did not preserve the appearance established on first sight')
for _, saved in ipairs(states['lb-xnai-extra-registry-v1'] or {}) do
  assert(saved.name ~= 'Han Hye-jeong',
    'an unvalidated same-response extra was persisted before output planning completed')
end

states['lb-xnai-extra-registry-v1'] = {
  {
    identity_key = 'kim_do_hee', name = 'Kim Do-hee',
    appearance = 'Kim Do-hee stable extra appearance with an athletic build and tied-back hair'
  }
}
gen.refreshExtraRegistry('test')
local knownExtraMismatch = {
  scenes = {{
    name = 'Oh Deok-gu and Kim Do-hee', character_count = 2,
    identities = {{
      identity_key = 'oh_deok_gu', name = 'Oh Deok-gu', source = 'lorebook',
      appearance = 'Oh Deok-gu canonical physical appearance'
    }},
    appearance = 'Oh Deok-gu studies Kim Do-hee with an analytical expression',
    outfit = 'Oh Deok-gu wears a gray hoodie while Kim Do-hee wears black athletic clothing',
    background = 'a bright private Pilates studio with cream walls and exercise equipment',
    composition = 'Oh Deok-gu faces Kim Do-hee while she blocks his raised smartphone',
    details = 'clean afternoon light preserves both faces and realistic fabric texture', slot = 0
  }}
}
queue = { knownExtraMismatch, knownExtraMismatch, knownExtraMismatch, knownExtraMismatch }
local knownExtraCandidate, knownExtraFailure = gen.requestOneDescriptor(
  'test', { scenes = {} },
  'Oh Deok-gu entered the studio. Kim Do-hee blocked his smartphone and ordered him to leave.', false)
assert(knownExtraCandidate and #knownExtraCandidate.identities == 2,
  'a known temporary extra was not deterministically backfilled into the malformed scene')
assert(knownExtraFailure == '', 'known-extra backfill retained a failure state')
assert(#queue == 3, 'known-extra backfill unnecessarily asked the weak model to repeat the descriptor')
assert(knownExtraCandidate.identities[1].name == 'Oh Deok-gu',
  'known-extra backfill replaced the existing canonical identity')
assert(knownExtraCandidate.identities[2].name == 'Kim Do-hee' and
  knownExtraCandidate.identities[2].source == 'extra',
  'known-extra backfill did not use the matching chat-scoped registry profile')
assert(knownExtraCandidate.identities[2].appearance:find('stable extra appearance', 1, true),
  'known-extra backfill dropped the saved immutable appearance')
assert(knownExtraCandidate.composition ==
  'Oh Deok-gu faces Kim Do-hee while she blocks his raised smartphone',
  'known-extra backfill rewrote valid scene prose')

local knownCanonicalMismatch = {
  scenes = {{
    name = 'Kim Do-hee and Song Hee-jin', character_count = 2,
    identities = {{
      identity_key = 'kim_do_hee', name = 'Kim Do-hee', source = 'extra',
      appearance = 'Kim Do-hee stable extra appearance'
    }},
    appearance = 'Kim Do-hee watches Song Hee-jin enter with a guarded expression',
    outfit = 'Kim Do-hee wears black athletic clothing while Song Hee-jin wears an ivory jacket',
    background = 'a quiet private studio lounge with a glass entrance',
    composition = 'Kim Do-hee stands in profile as Song Hee-jin walks through the doorway',
    details = 'soft window light separates both faces and realistic clothing textures', slot = 0
  }}
}
queue = { knownCanonicalMismatch, knownCanonicalMismatch, knownCanonicalMismatch, knownCanonicalMismatch }
local knownCanonicalCandidate, knownCanonicalFailure = gen.requestOneDescriptor(
  'test', { scenes = {} },
  'Kim Do-hee waited near the entrance. Song Hee-jin walked into the studio lounge.', false)
assert(knownCanonicalCandidate and #knownCanonicalCandidate.identities == 2,
  'a known canonical identity was not deterministically backfilled into the malformed scene')
assert(knownCanonicalFailure == '', 'canonical backfill retained a failure state')
assert(#queue == 3, 'canonical backfill unnecessarily asked the weak model to repeat the descriptor')
assert(knownCanonicalCandidate.identities[2].name == 'Song Hee-jin' and
  knownCanonicalCandidate.identities[2].source == 'lorebook',
  'canonical backfill did not use the matching lorebook profile')
assert(knownCanonicalCandidate.identities[2].appearance:find(
  'Song Hee-jin canonical physical appearance', 1, true),
  'canonical backfill dropped the lorebook appearance')

local unresolvedMismatch = {
  scenes = {{
    name = 'Oh Deok-gu and Unknown Visitor', character_count = 2,
    identities = {{
      identity_key = 'oh_deok_gu', name = 'Oh Deok-gu', source = 'lorebook',
      appearance = 'Oh Deok-gu canonical physical appearance'
    }},
    appearance = 'Oh Deok-gu looks toward an unknown visitor',
    outfit = 'Oh Deok-gu wears a gray hoodie while the visitor wears an unspecified coat',
    background = 'a plain test hallway',
    composition = 'Oh Deok-gu stands opposite Unknown Visitor',
    details = 'neutral light and realistic textures', slot = 0
  }}
}
queue = { unresolvedMismatch, unresolvedMismatch, unresolvedMismatch, unresolvedMismatch }
local unresolvedCandidate, unresolvedFailure = gen.requestOneDescriptor(
  'test', { scenes = {} },
  'Oh Deok-gu saw an Unknown Visitor in the hallway.', false)
assert(unresolvedCandidate == nil,
  'an unknown identity was invented or character_count was silently reduced')
assert(unresolvedFailure:find('identities', 1, true),
  'an unresolved unknown identity lost the cardinality failure reason')
assert(#queue == 0, 'an unresolved unknown identity bypassed the existing focused retry path')

local canonicalHelmetScene = {
  name = 'The Frankenstein Helmet', character_count = 1,
  identities = {{
    identity_key = 'oh_deok_gu', name = 'Oh Deok-gu', source = 'lorebook',
    appearance = 'Korean man with a slightly chubby physique, a round face, thick-rimmed round glasses, and messy black hair.'
  }},
  appearance = 'Oh Deok-gu leans over the desk with an intensely focused expression while soldering.',
  outfit = 'an oversized stained grey cotton t-shirt',
  background = 'a cluttered warehouse workshop filled with electronic scrap',
  composition = 'close-up shot of his concentrated face and hands working on a helmet',
  details = 'realistic skin texture, solder smoke, and shallow optical depth of field', slot = 49
}
local generated = gen.generate('test', canonicalHelmetScene)
assert(generated == '{{inlay::identity-test}}', 'the canonical appearance test did not reach image generation')
assert(capturedImagePrompt:find('slightly chubby physique', 1, true),
  'the final prompt dropped the immutable identity appearance')
assert(capturedImagePrompt:find('thick-rimmed round glasses', 1, true),
  'the final prompt dropped canonical face accessories')
assert(capturedImagePrompt:find('intensely focused expression', 1, true),
  'the final prompt dropped useful scene-level appearance state')
assert(capturedImagePrompt:find('[[KREA2_CHARACTER:Oh Deok-gu]]', 1, true),
  'the single-person route used the scene title instead of the identity name')
assert(not capturedImagePrompt:find('[[KREA2_CHARACTER:The Frankenstein Helmet]]', 1, true),
  'the single-person route retained the invalid scene-title identity')

local multiIdentityScene = {
  name = 'The Feast of the Engineers', character_count = 2,
  identities = {
    { identity_key = 'oh_deok_gu', name = 'Oh Deok-gu', source = 'lorebook', appearance = 'canonical Deok-gu appearance' },
    { identity_key = 'seong_jin', name = '성진', source = 'extra', appearance = 'stable Seong-jin appearance' }
  },
  appearance = 'both men eat with contrasting expressions',
  outfit = 'Deok-gu wears a white t-shirt and 성진 wears a dark hoodie',
  background = 'a dim warehouse workshop',
  composition = 'wide two-person shot',
  details = 'realistic practical lighting', slot = 35
}
gen.generate('test', multiIdentityScene)
assert(capturedImagePrompt:find('canonical Deok-gu appearance', 1, true),
  'the multi-person final prompt dropped the first identity appearance')
assert(capturedImagePrompt:find('stable Seong-jin appearance', 1, true),
  'the multi-person final prompt dropped the second identity appearance')
assert(capturedImagePrompt:find('[[KREA2_MULTI_CHARACTER]]', 1, true),
  'multi-person LoRA suppression marker changed')
assert(not capturedImagePrompt:find('[[KREA2_CHARACTER:', 1, true),
  'a character LoRA route leaked into a multi-person prompt')
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
      '🔦라이트보드 🌠 삽화 Krea2 4.4.22.module.charx'
    );
    const archive = unzipSync(fs.readFileSync(modulePath));
    const card = JSON.parse(Buffer.from(archive['card.json']).toString('utf8'));
    const onOutput = card.data.character_book.entries.find(
      (entry) => entry.name === 'lb-xnai.lb.onOutput'
    ).content;
    const onInput = card.data.character_book.entries.find(
      (entry) => entry.name === 'lb-xnai.lb.onInput'
    ).content;
    lua.global.set('onOutputSource', onOutput);
    lua.global.set('onInputSource', onInput);
    const syntaxResult = await lua.doString(`
      local compiled, syntaxError = load(onOutputSource)
      assert(compiled, syntaxError)
      local inputCompiled, inputSyntaxError = load(onInputSource)
      assert(inputCompiled, inputSyntaxError)
      return true
    `);
    if (syntaxResult !== true) throw new Error('onOutput syntax check failed');
    const partialResult = await lua.doString(`
      local savedState = {}
      local savedDebug = ''
      function getGlobalVar(_, name)
        if name == 'toggle_lb-xnai.generation' then return '0' end
        if name == 'toggle_lb-xnai.keyVisual' then return '2' end
        if name == 'toggle_lb-xnai.imageCount' then return '3' end
        return ''
      end
      function getState(_, name)
        if name == 'lb-xnai-stack' then return savedState end
        return nil
      end
      function setState(_, name, value)
        if name == 'lb-xnai-stack' then savedState = value end
      end
      function setChatVar(_, name, value)
        if name == 'lb-xnai-last-generation-debug' then savedDebug = value end
      end
      local response = {
        scenes = {
          { name = 'A', slot = 0 },
          { name = 'B', slot = 1 },
          { name = 'C', slot = 2 },
        }
      }
      local genMock = {
        sanitizeResponseDescriptors = function(value) return value end,
        completeResponseImageCount = function() return response, {} end,
        validateResponseImageCount = function() return true, '' end,
        updateExtraRegistry = function() end,
        generate = function(_, descriptor)
          if descriptor.name == 'B' then
            error('simulated ComfyUI timeout <script>alert(1)</script>')
          end
          return '{{inlay::success-' .. descriptor.name:lower() .. '}}'
        end,
        persistStateAndHistory = function(_, state)
          savedState = state
          return state, ''
        end,
        insertSlots = function()
          return '[Slot 0]\\n\\nParagraph A\\n\\n[Slot 1]\\n\\nParagraph B\\n\\n[Slot 2]\\n\\nParagraph C'
        end,
      }
      prelude = {
        queryNodes = function() return {{ content = 'decoded' }} end,
        toon = { decode = function() return response end },
        import = function() return genMock end,
        extractTagName = function() return nil end,
        escMatch = function(value) return value end,
      }
      local compiled, compileError = load(onOutputSource)
      assert(compiled, compileError)
      local onOutput = compiled()
      local rendered, lazy = onOutput('test', '<lb-xnai>decoded</lb-xnai>',
        'Paragraph A\\n\\nParagraph B\\n\\nParagraph C', 7)
      assert(rendered:find('{{inlay::success-a}}', 1, true),
        'the first successful image was discarded after a later failure')
      assert(rendered:find('{{inlay::success-c}}', 1, true),
        'a successful image after the failed image was discarded')
      assert(rendered:find('이미지 2 생성 실패', 1, true),
        'the failed image did not leave an inline error at its story slot')
      assert(rendered:find('simulated ComfyUI timeout', 1, true),
        'the inline image error omitted the detailed failure reason')
      assert(rendered:find('&lt;script&gt;', 1, true)
          and not rendered:find('<script>', 1, true),
        'the detailed failure reason was not escaped before HTML rendering')
      assert(not rendered:find('<lb-xnai scene="1" />', 1, true),
        'the failed image left a silent empty placeholder')
      assert(lazy == '<lb-lazy id="lb-xnai" />',
        'a per-image failure still replaced the full result with a global error')
      assert(#savedState == 1, 'partial generation state was not persisted')
      assert(savedDebug:find('generated=2', 1, true) and savedDebug:find('failed=1', 1, true),
        'partial generation diagnostics were not recorded')

      savedState = {}
      response = { scenes = {
        { name = 'A', slot = 0 },
        { name = 'B', slot = 1 },
      } }
      genMock.completeResponseImageCount = function()
        return response, {{
          kind = 'scene', ordinal = 3,
          reason = '필수 필드 outfit이 비어 있어 두 번의 보완 요청이 거절되었습니다.',
        }}
      end
      genMock.generate = function(_, descriptor)
        return '{{inlay::planned-' .. descriptor.name:lower() .. '}}'
      end
      local plannedRendered, plannedLazy = onOutput(
        'test', '<lb-xnai>decoded</lb-xnai>',
        'Paragraph A\\n\\nParagraph B\\n\\nParagraph C', 8)
      assert(plannedRendered:find('{{inlay::planned-a}}', 1, true)
          and plannedRendered:find('{{inlay::planned-b}}', 1, true),
        'valid planned scenes were discarded when the third descriptor repair failed')
      assert(plannedRendered:find('이미지 3 생성 실패', 1, true),
        'the missing third descriptor did not leave a final inline error')
      assert(plannedRendered:find('필수 필드 outfit', 1, true),
        'the planning failure did not expose its exact rejection reason')
      assert(plannedLazy == '<lb-lazy id="lb-xnai" />',
        'a focused planning failure still replaced partial output with a global error')
      return true
    `);
    if (partialResult !== true) throw new Error('partial output preservation check failed');
    process.stdout.write('generator runtime: OK\n');
  } finally {
    lua.global.close();
  }
})().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
