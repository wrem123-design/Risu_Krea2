"""Self-contained checks for the artifacts published in this repository."""

from __future__ import annotations

import importlib.util
import json
import py_compile
import unittest
import zipfile
from pathlib import Path


REPOSITORY = Path(__file__).resolve().parents[2]
WORKFLOW = REPOSITORY / "workflow" / "Krea2_turbo_chatbot.json"
BUILDER = REPOSITORY / "integration" / "tools" / "build_krea2_integration.py"
LAUNCHER = REPOSITORY / "integration" / "start_krea2_stack.ps1"
ONE_CLICK_LAUNCHER = REPOSITORY / "integration" / "start_krea2_chatbot.bat"
HOOK_PATCH = (
    REPOSITORY
    / "hooking_manager"
    / "patches"
    / "0001-krea2-character-lora-routing.patch"
)
HOOK_SEED_PATCH = (
    REPOSITORY
    / "hooking_manager"
    / "patches"
    / "0002-randomize-krea2-workflow-seeds.patch"
)
HOOK_CORS_PATCH = (
    REPOSITORY
    / "hooking_manager"
    / "patches"
    / "0003-pocketrisu-browser-cors.patch"
)


def module_path() -> Path:
    """Return the single published Krea2 4.4.12 module artifact."""

    matches = [
        path
        for path in (REPOSITORY / "module").glob("*.module.charx")
        if "Krea2 4.4.12" in path.name
    ]
    if len(matches) != 1:
        raise AssertionError(f"Expected one Krea2 4.4.12 module, found {matches}")
    return matches[0]


class RepositoryArtifactTests(unittest.TestCase):
    """Verify the repository without relying on private models or source installs."""

    def test_workflow_keeps_only_krea2_fedor_and_dynamic_character_lora(self) -> None:
        workflow = json.loads(WORKFLOW.read_text(encoding="utf-8"))
        nodes = {node["id"]: node for node in workflow["nodes"]}
        node_types = {node["type"] for node in workflow["nodes"]}
        serialized = json.dumps(workflow, ensure_ascii=False)

        self.assertEqual(nodes[218]["title"], "긍정프롬프트")
        self.assertEqual(nodes[218]["widgets_values"], ["{{risu_prompt}}"])
        self.assertEqual(nodes[7]["widgets_values"], [""])
        self.assertEqual(nodes[206]["widgets_values"][0], r"krea2\fedor_bypass.safetensors")
        self.assertEqual(nodes[297]["title"], "Krea2 캐릭터 LoRA (동적)")
        self.assertIn("krea2_turbo_int8_convrot.safetensors", serialized)
        self.assertNotIn("Power Lora Loader (rgthree)", node_types)
        self.assertNotIn("DepthAnythingV2Preprocessor", node_types)
        self.assertNotIn("Krea2ControlApply", node_types)
        self.assertEqual(workflow.get("definitions", {}).get("subgraphs", []), [])
        self.assertTrue(any(link[1:5] == [206, 0, 297, 0] for link in workflow["links"]))
        self.assertTrue(any(link[1:5] == [297, 0, 204, 0] for link in workflow["links"]))

    def test_generator_accepts_nonempty_prose_after_validator_repair_attempts(self) -> None:
        spec = importlib.util.spec_from_file_location("krea2_builder", BUILDER)
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)
        builder = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(builder)

        self.assertIn("wordCount(value)", builder.VALIDATOR_LUA)
        self.assertIn("minimumWords", builder.VALIDATOR_LUA)
        self.assertNotIn(
            "wordCount(appearance) < minimumWords.appearance",
            builder.GENERATOR_LUA,
        )
        self.assertNotIn(
            "wordCount(outfit) < minimumWords.outfit",
            builder.GENERATOR_LUA,
        )
        self.assertIn("or appearance == ''", builder.GENERATOR_LUA)
        self.assertIn("or details == ''", builder.GENERATOR_LUA)

    def test_module_generation_controls_are_wired_to_prompt_and_validator(self) -> None:
        """Keep output controls functional instead of exposing decorative toggles."""

        spec = importlib.util.spec_from_file_location("krea2_builder", BUILDER)
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)
        builder = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(builder)

        self.assertIn("lb-xnai.imageCount=생성 장수=select=자동(4~6),1,2,3,4,5,6", builder.MODULE_TOGGLES)
        self.assertIn("lb-xnai.keyVisual=키비주얼=select=자동,항상 포함,사용 안 함", builder.MODULE_TOGGLES)
        self.assertIn(
            "lb-xnai.sceneSelection=장면 선택=select=균형 배치,핵심 장면 우선,후반부 우선",
            builder.MODULE_TOGGLES,
        )
        self.assertIn("toggle_lb-xnai.imageCount", builder.MAIN_INSTRUCTIONS)
        self.assertIn("toggle_lb-xnai.keyVisual", builder.MAIN_INSTRUCTIONS)
        self.assertIn("toggle_lb-xnai.sceneSelection", builder.MAIN_INSTRUCTIONS)
        self.assertIn("resolveImageCountRule", builder.VALIDATOR_LUA)
        self.assertIn("toggle_lb-xnai.imageCount", builder.VALIDATOR_LUA)
        self.assertIn("toggle_lb-xnai.keyVisual", builder.VALIDATOR_LUA)
        self.assertIn("must contain exactly", builder.VALIDATOR_LUA)
        self.assertIn("keyVisualPolicy == '1'", builder.GENERATOR_LUA)
        self.assertIn("keyVisualPolicy == '2'", builder.GENERATOR_LUA)

    def test_missing_images_are_completed_one_at_a_time_before_generation(self) -> None:
        """Complete weak-model one-scene replies without another full rewrite."""

        spec = importlib.util.spec_from_file_location("krea2_builder", BUILDER)
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)
        builder = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(builder)

        self.assertIn("never return only one, two, or three", builder.MAIN_INSTRUCTIONS)
        self.assertNotIn("missing image descriptors", builder.VALIDATOR_LUA)
        self.assertIn("imageCount == 0", builder.VALIDATOR_LUA)
        self.assertIn("completeResponseImageCount", builder.GENERATOR_LUA)
        self.assertIn("Create exactly one additional", builder.GENERATOR_LUA)
        self.assertIn("pcall(axLLM, triggerId, prompt", builder.GENERATOR_LUA)
        self.assertIn("fallbackDescriptor", builder.GENERATOR_LUA)
        self.assertIn("validateResponseImageCount", builder.GENERATOR_LUA)
        self.assertIn("자동(4~6) 설정은 최소 4장", builder.GENERATOR_LUA)

        with zipfile.ZipFile(module_path()) as archive:
            card = json.loads(archive.read("card.json").decode("utf-8"))
        entries = {
            entry["name"]: entry["content"]
            for entry in card["data"]["character_book"]["entries"]
        }
        on_output = entries["lb-xnai.lb.onOutput"]
        self.assertIn("completeResponseAtOutputBoundary", on_output)
        self.assertIn("gen.completeResponseImageCount", on_output)
        self.assertIn("gen.validateResponseImageCount(tid, response)", on_output)
        self.assertIn("설정한 이미지 장수와 맞지 않습니다", on_output)
        self.assertIn("lb-xnai-last-generation-debug", on_output)
        self.assertIn("generatedCount", on_output)
        self.assertIn("return fullChatContent, '<lb-lazy", on_output)
        self.assertNotIn("return nil, '<lb-lazy id=\"lb-xnai\">오류: 설정한 이미지 장수", on_output)

        self.assertIn("lb-xnai.gen.v4412", entries)
        self.assertEqual(entries["lb-xnai.gen.v4412"], entries["lb-xnai.gen"])
        self.assertIn("prelude.import(tid, 'lb-xnai.gen.v4412')", on_output)
        self.assertIn(
            "prelude.import(tid, 'lb-xnai.gen.v4412')",
            entries["lb-xnai.lb.onInput"],
        )

    def test_original_lightboard_backend_is_not_forked(self) -> None:
        """Keep count completion inside the illustration module."""

        spec = importlib.util.spec_from_file_location("krea2_builder", BUILDER)
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)
        builder = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(builder)

        self.assertFalse(hasattr(builder, "build_lightboard_backend"))
        self.assertFalse(
            any("3.4.0.1 Krea2" in path.name for path in (REPOSITORY / "module").iterdir())
        )

    def test_select_indices_and_runtime_safety_are_normalized(self) -> None:
        """Match PocketRisu's stored select indices and guard runtime boundaries."""

        spec = importlib.util.spec_from_file_location("krea2_builder", BUILDER)
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)
        builder = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(builder)

        self.assertIn("`0` means automatic", builder.MAIN_INSTRUCTIONS)
        self.assertIn("`2` forbids keyvis", builder.MAIN_INSTRUCTIONS)
        self.assertIn("`2` favors meaningful moments nearer the end", builder.MAIN_INSTRUCTIONS)
        self.assertIn("resolveKeyVisualPolicy", builder.VALIDATOR_LUA)
        self.assertIn("raw == '2'", builder.VALIDATOR_LUA)
        self.assertIn("maxSaves < 1", builder.GENERATOR_LUA)
        self.assertIn("maxSaves > 20", builder.GENERATOR_LUA)

        with zipfile.ZipFile(module_path()) as archive:
            card = json.loads(archive.read("card.json").decode("utf-8"))
        entries = {
            entry["name"]: entry["content"]
            for entry in card["data"]["character_book"]["entries"]
        }
        on_output = entries["lb-xnai.lb.onOutput"]
        self.assertIn("toggle_lb-xnai.keyVisual", on_output)
        self.assertIn("toggle_lb-xnai.kv.position", on_output)
        self.assertIn("keyVisualPolicy == '2'", on_output)
        self.assertIn("response.keyvis = nil", on_output)
        self.assertIn("return keyVisualNode .. '\\n\\n' .. slotted", on_output)
        self.assertIn("toggle_lb-xnai.generation') == '0'", on_output)
        self.assertIn(
            "toggle_lb-xnai.lazy') or '0'",
            entries["lb-xnai.lb.onInput"],
        )

    def test_extra_character_memory_is_isolated_from_canonical_lorebook(self) -> None:
        """Persist only temporary extra identities without mutating canonical lore."""

        spec = importlib.util.spec_from_file_location("krea2_builder", BUILDER)
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)
        builder = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(builder)

        self.assertIn("{{getvar::lb-xnai-extra-registry-prompt}}", builder.MAIN_INSTRUCTIONS)
        self.assertIn("read-only", builder.MAIN_INSTRUCTIONS)
        self.assertIn("identities[n]", builder.FORMAT_CONTRACT)
        self.assertIn("identity_key:", builder.FORMAT_CONTRACT)
        self.assertIn("source: lorebook", builder.FORMAT_CONTRACT)
        self.assertIn("validateIdentities", builder.VALIDATOR_LUA)
        self.assertIn("lb-xnai-extra-registry-v1", builder.GENERATOR_LUA)
        self.assertIn("lb-xnai-extra-registry-prompt", builder.GENERATOR_LUA)
        self.assertIn("isCanonicalLorebookName", builder.GENERATOR_LUA)
        self.assertIn("identity.source == 'extra'", builder.GENERATOR_LUA)
        self.assertIn("toggle_lb-xnai.extraMemory", builder.GENERATOR_LUA)
        self.assertIn("toggle_lb-xnai.extraMemoryLimit", builder.GENERATOR_LUA)
        self.assertNotIn("setPriorityLoreBook", builder.GENERATOR_LUA)
        self.assertNotIn("setLoreBook", builder.GENERATOR_LUA)
        self.assertIn(
            "characterCount == 1 and isCanonicalLorebookName(triggerId, name)",
            builder.GENERATOR_LUA,
        )
        self.assertIn("lb-xnai.extraMemory=엑스트라 기억=select=사용,사용 안 함", builder.MODULE_TOGGLES)
        self.assertIn("lb-xnai.extraMemoryLimit=기억 인원=text", builder.MODULE_TOGGLES)

        with zipfile.ZipFile(module_path()) as archive:
            card = json.loads(archive.read("card.json").decode("utf-8"))
        entries = {
            entry["name"]: entry["content"]
            for entry in card["data"]["character_book"]["entries"]
        }
        self.assertIn("gen.updateExtraRegistry(tid, response)", entries["lb-xnai.lb.onOutput"])

    def test_module_is_valid_positive_only_krea2_4412_archive(self) -> None:
        with zipfile.ZipFile(module_path()) as archive:
            self.assertIsNone(archive.testzip())
            self.assertIn("module.risum", archive.namelist())
            card = json.loads(archive.read("card.json").decode("utf-8"))

        self.assertEqual(card["data"]["name"], "🔦라이트보드 🌠 삽화 Krea2 4.4.12")
        entries = {
            entry["name"]: entry["content"]
            for entry in card["data"]["character_book"]["entries"]
        }
        self.assertEqual(
            entries["프리셋 1"].strip(),
            "[Positive]\n{appearance}\n\n{outfit}\n\n{background}\n\n{composition}\n\n"
            "shot on smartphone, photorealistic real-world photography, realistic skin texture, "
            "natural optical depth of field, {details}",
        )
        self.assertIn("high-quality anime illustration", entries["프리셋 2D"])
        self.assertIn("rather than a real photograph", entries["프리셋 2D"])
        self.assertNotIn("photorealistic real-world photography", entries["프리셋 2D"])
        self.assertIn("[[KREA2_PRESET:", entries["lb-xnai.gen"])
        self.assertIn("[[KREA2_CHARACTER:", entries["lb-xnai.gen"])
        self.assertIn("[[KREA2_MULTI_CHARACTER]]", entries["lb-xnai.gen"])
        self.assertIn("character_count", entries["lb-xnai.lb.onValidate"])
        self.assertIn(
            "Repair only the underspecified prose fields",
            entries["lb-xnai.lb.onValidate"],
        )
        self.assertIn(
            "Copy every field not listed below exactly",
            entries["lb-xnai.lb.onValidate"],
        )
        self.assertIn("one to three identifiable characters", entries["lb-xnai.lb"].lower())
        self.assertIn("dialogue, eye contact, touch, confrontation", entries["lb-xnai.lb"].lower())
        self.assertIn("undeclared identifiable person beyond `character_count`", entries["lb-xnai.lb"])
        self.assertNotIn("or another identifiable person", entries["lb-xnai.lb"])
        self.assertNotIn("ensurePhotorealistic", entries["lb-xnai.gen"])
        self.assertNotIn("details must explicitly include photorealistic", entries["lb-xnai.lb.onValidate"].lower())
        self.assertIn("negative = ''", entries["lb-xnai.gen"])
        for field in (
            "character_count:",
            "appearance:",
            "outfit:",
            "background:",
            "composition:",
            "details:",
        ):
            self.assertIn(field, entries["lb-xnai.lb.format"])
        self.assertIn(
            "=🌠삽화=group",
            card["data"]["extensions"]["risuai"]["toggles"],
        )
        toggles = card["data"]["extensions"]["risuai"]["toggles"]
        toggle_keys = {
            line.split("=", 1)[0]
            for line in toggles.splitlines()
            if line and not line.startswith("=") and "=" in line
        }
        self.assertEqual(
            toggle_keys,
            {
                "lb-xnai.lazy",
                "lb-xnai.generation",
                "lb-xnai.imageCount",
                "lb-xnai.keyVisual",
                "lb-xnai.sceneSelection",
                "lb-xnai.extraMemory",
                "lb-xnai.extraMemoryLimit",
                "lb-xnai.preset",
                "lb-xnai.kv.position",
                "lb-xnai.maxSaves",
            },
        )
        self.assertNotIn("lb-xnai.nsfw", toggles)
        self.assertNotIn("lb-xnai.supplement", toggles)

    def test_launcher_uses_isolated_flash_attention_runtime(self) -> None:
        launcher = LAUNCHER.read_text(encoding="utf-8")

        self.assertIn("--use-flash-attention", launcher)
        self.assertIn("'--listen', '127.0.0.1'", launcher)
        self.assertIn("'--port', '8190'", launcher)
        self.assertIn("-WindowStyle Hidden", launcher)
        one_click = ONE_CLICK_LAUNCHER.read_text(encoding="utf-8")
        self.assertIn("start_krea2_stack.ps1", one_click)
        self.assertIn("PocketRisu.exe", one_click)

    def test_builder_compiles_and_hook_patch_contains_routing_contract(self) -> None:
        py_compile.compile(str(BUILDER), doraise=True)
        patch = HOOK_PATCH.read_text(encoding="utf-8")
        seed_patch = HOOK_SEED_PATCH.read_text(encoding="utf-8")
        cors_patch = HOOK_CORS_PATCH.read_text(encoding="utf-8")

        self.assertIn("/api/krea2_lora/config", patch)
        self.assertIn("Krea2 캐릭터 LoRA (동적)", patch)
        self.assertIn("normalize_character_name", patch)
        self.assertIn("validate_mapping_entries", patch)
        self.assertIn("route_character_lora", patch)
        self.assertIn("apply_resolution", patch)
        self.assertIn("load_workflow_resolution", patch)
        self.assertIn('id="krea2-resolution-width"', patch)
        self.assertIn('id="krea2-resolution-height"', patch)
        self.assertIn("KREA2_MULTI_CHARACTER", patch)
        self.assertIn("validate_preset_routes", patch)
        self.assertIn("resolve_preset_loras", patch)
        self.assertIn('data-field="preset-id"', patch)
        self.assertIn("2D", patch)
        self.assertIn("randomize_workflow_seeds", seed_patch)
        self.assertIn('(\"seed\", \"noise_seed\")', seed_patch)
        self.assertIn("Krea2 seed 무작위화", seed_patch)
        self.assertIn("cors_middleware", cors_patch)
        self.assertIn("Access-Control-Allow-Origin", cors_patch)
        self.assertIn('request.method == "OPTIONS"', cors_patch)


if __name__ == "__main__":
    unittest.main()
