# Hooking Manager Krea2 Patch

`patches/0001-krea2-character-lora-routing.patch`는 upstream `comfyui_hooking_server`에 다음 기능을 추가합니다.

- `Krea2 캐릭터 LoRA` 전용 메뉴
- Power LoRA Loader에서 파일명, 강도, 기존 ON/OFF 상태 읽기
- 파일명 읽기 전용 표시
- 쉼표로 구분한 영문 캐릭터명·별칭과 적용 강도 저장
- 모듈의 `[[KREA2_CHARACTER:...]]` 표식 제거
- 등록된 이름 또는 별칭 중 하나와 정확히 일치할 때 LoRA 하나만 적용
- 모듈의 `[[KREA2_MULTI_CHARACTER]]` 표식 제거 및 캐릭터 LoRA 무조건 우회
- 빈칸 또는 불일치 시 동적 LoRA 노드 삭제 및 fedor 경로 우회
- 원본 워크플로 해상도 표시와 가로·세로 오버라이드 저장
- 다음 생성 요청의 `Image Width`·`Image Height` 노드에 저장값 적용
- 모듈의 `[[KREA2_PRESET:X]]` 표식과 후킹 매니저의 프리셋 식별자 연결
- 프리셋별 `캐릭터 매칭`, `선택 LoRA 일괄 적용`, `미적용` 모드
- `프리셋 2D`를 사용할 때 식별자 `2D`로 선택한 그림체 LoRA 일괄 적용

`patches/0002-randomize-krea2-workflow-seeds.patch`는 매 요청마다 워크플로의 숫자형
`seed`와 `noise_seed`를 새 값으로 바꿉니다. 같은 장면을 다시 생성해도 ComfyUI가
전체 실행을 캐시해 빈 `outputs`를 반환하지 않으므로 PocketRisu의 `filename` 오류를
방지합니다.

`patches/0003-pocketrisu-browser-cors.patch`는 PocketRisu가 브라우저에서 보내는
`OPTIONS` 사전 요청과 `Authorization` 헤더를 허용합니다. `/prompt`, `/history`,
`/view`가 포트 또는 터널 주소를 거쳐 호출될 때 CORS로 차단되는 문제를 방지합니다.

`patches/0004-slim-krea2-operator-console.patch`는 후킹 매니저를 Krea2 삽화 전용으로
경량화합니다. 공지·알림, 에셋 생성/업로드, 포즈 편집, 자동 매칭, LoRA 학습처럼
현재 파이프라인과 무관한 백엔드와 UI를 제거하고 다음 세 화면만 유지합니다.

- 생성 기록: 프롬프트 확인, 재생성, 수정, 예약
- Krea2 설정: 해상도 프리셋/수동 입력, 프리셋 라우팅, 캐릭터 LoRA
- 운영·진단: 준비 상태, 삽화 큐, 필수 설정, 최근 로그

외부 접속에 사용하는 Cloudflare 공유 시작/상태/종료와 주소 복사는 전역 헤더에
그대로 유지됩니다. 삭제 판단 근거는 `FEATURE_INVENTORY.md`에 기록되어 있습니다.

## 적용

Hooking Manager 저장소 루트에서 실행합니다.

```powershell
git apply E:\Chatbot\Risu_Krea2\hooking_manager\patches\0001-krea2-character-lora-routing.patch
git apply E:\Chatbot\Risu_Krea2\hooking_manager\patches\0002-randomize-krea2-workflow-seeds.patch
git apply E:\Chatbot\Risu_Krea2\hooking_manager\patches\0003-pocketrisu-browser-cors.patch
git apply E:\Chatbot\Risu_Krea2\hooking_manager\patches\0004-slim-krea2-operator-console.patch
```

로컬 `config.json`은 `config.krea2.example.json`을 참고합니다. 실제 환경에 맞는
실행 워크플로와 LoRA 카탈로그 원본 경로를 사용하세요. 모델이나 ComfyUI 자체는
이 저장소에 포함하지 않습니다.

`config.json`과 `krea2_character_lora_map.json`은 컴퓨터별 로컬 상태이므로 이 저장소에 커밋하지 않습니다. 매핑 파일은 캐릭터 연결, 프리셋별 LoRA 동작, 해상도 오버라이드를 함께 보관합니다.

한 LoRA를 여러 극중 이름에 연결하려면 캐릭터명 칸에 쉼표로 구분해 입력합니다.
예를 들어 `Stella, Song Hee-jin`으로 저장하면 단일 인물 장면의 라우팅명이
`Stella` 또는 `Song Hee-jin`일 때 동일한 LoRA가 적용됩니다. 대소문자와 연속
공백은 무시하지만 부분 일치는 허용하지 않으며, 같은 별칭을 서로 다른 LoRA에
중복 등록할 수 없습니다. 다인 장면은 기존과 같이 모든 캐릭터 LoRA를 우회합니다.

프리셋 식별자는 임의의 별칭이 아닙니다. 모듈 메뉴가 `프리셋 X` 로어북을 선택할 때의
`X`와 정확히 같아야 합니다. 예를 들어 `프리셋 2D`는 후킹 매니저에 `2D`로 등록합니다.

## 검증

```powershell
python -m unittest discover -s tests -v
```

후킹매니저를 다시 시작한 뒤 `http://127.0.0.1:8189/api/krea2_lora/config`에서 카탈로그가 반환되는지 확인합니다.

## 실행

ComfyUI를 먼저 FlashAttention 배치 파일로 실행한 뒤 후킹 매니저의 `run_en.bat`을
실행합니다. 관리자 화면은 `http://127.0.0.1:8189/`입니다. 원격 사용이 필요하면
상단 **공유 시작**을 누르고 표시된 주소를 PocketRisu의 ComfyUI 요청 URL로 사용합니다.
