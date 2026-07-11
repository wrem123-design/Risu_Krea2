"""Self-contained checks for the artifacts published in this repository."""

from __future__ import annotations

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


def module_path() -> Path:
    """Return the single published Krea2 4.4.1 module artifact."""

    matches = [
        path
        for path in (REPOSITORY / "module").glob("*.module.charx")
        if "Krea2 4.4.1" in path.name
    ]
    if len(matches) != 1:
        raise AssertionError(f"Expected one Krea2 4.4.1 module, found {matches}")
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

    def test_module_is_valid_positive_only_krea2_441_archive(self) -> None:
        with zipfile.ZipFile(module_path()) as archive:
            self.assertIsNone(archive.testzip())
            self.assertIn("module.risum", archive.namelist())
            card = json.loads(archive.read("card.json").decode("utf-8"))

        self.assertEqual(card["data"]["name"], "🔦라이트보드 🌠 삽화 Krea2 4.4.1")
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
        self.assertIn("[[KREA2_CHARACTER:", entries["lb-xnai.gen"])
        self.assertNotIn("ensurePhotorealistic", entries["lb-xnai.gen"])
        self.assertNotIn("details must explicitly include photorealistic", entries["lb-xnai.lb.onValidate"].lower())
        self.assertIn("negative = ''", entries["lb-xnai.gen"])
        for field in ("appearance:", "outfit:", "background:", "composition:", "details:"):
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

        self.assertIn("/api/krea2_lora/config", patch)
        self.assertIn("Krea2 캐릭터 LoRA (동적)", patch)
        self.assertIn("normalize_character_name", patch)
        self.assertIn("validate_mapping_entries", patch)
        self.assertIn("route_character_lora", patch)
        self.assertIn("apply_resolution", patch)
        self.assertIn("load_workflow_resolution", patch)
        self.assertIn('id="krea2-resolution-width"', patch)
        self.assertIn('id="krea2-resolution-height"', patch)


if __name__ == "__main__":
    unittest.main()
