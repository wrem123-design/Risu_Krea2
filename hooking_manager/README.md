# Hooking Manager Krea2 Patch

`patches/0001-krea2-character-lora-routing.patch`는 upstream `comfyui_hooking_server`에 다음 기능을 추가합니다.

- `Krea2 캐릭터 LoRA` 전용 메뉴
- Power LoRA Loader에서 파일명, 강도, 기존 ON/OFF 상태 읽기
- 파일명 읽기 전용 표시
- 영문 캐릭터명과 적용 강도 저장
- 모듈의 `[[KREA2_CHARACTER:...]]` 표식 제거
- 영문 이름 정확 일치 시 LoRA 하나만 적용
- 모듈의 `[[KREA2_MULTI_CHARACTER]]` 표식 제거 및 캐릭터 LoRA 무조건 우회
- 빈칸 또는 불일치 시 동적 LoRA 노드 삭제 및 fedor 경로 우회
- 원본 워크플로 해상도 표시와 가로·세로 오버라이드 저장
- 다음 생성 요청의 `Image Width`·`Image Height` 노드에 저장값 적용

## 적용

Hooking Manager 저장소 루트에서 실행합니다.

```powershell
git apply E:\Chatbot\Risu_Krea2\hooking_manager\patches\0001-krea2-character-lora-routing.patch
```

로컬 `config.json`에는 다음 키를 추가합니다. 실제 환경에 맞는 원본 Krea2 워크플로 경로를 사용하세요.

```json
{
  "krea2_lora_catalog_source_path": "E:\\Chatbot\\comfypack\\ComfyUI_windows_portable\\ComfyUI\\user\\default\\workflows\\Krea2_turbo_chatbot.json"
}
```

`config.json`과 `krea2_character_lora_map.json`은 컴퓨터별 로컬 상태이므로 이 저장소에 커밋하지 않습니다. 매핑 파일은 캐릭터 연결과 함께 해상도 오버라이드도 보관합니다.

## 검증

```powershell
python -m unittest discover -s tests -v
```

후킹매니저를 다시 시작한 뒤 `http://127.0.0.1:8189/api/krea2_lora/config`에서 카탈로그가 반환되는지 확인합니다.
