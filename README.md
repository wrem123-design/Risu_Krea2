# Risu Krea2 Integration

PocketRisu 삽화 모듈과 Krea2 전용 ComfyUI 워크플로를 연결하는 재현용 저장소입니다.

이 저장소에는 다음 항목만 기록합니다.

- PocketRisu Krea2 삽화 모듈
- Krea2 + FlashAttention + fedor_bypass 워크플로
- 캐릭터별 단일 LoRA 라우팅을 위한 Hooking Manager 패치
- 모듈과 워크플로 빌더, 테스트, 설치 문서

ComfyUI 본체, Python 런타임, 모델 파일, LoRA 파일, 생성 이미지, 로그와 로컬 설정은 포함하지 않습니다.

## 현재 동작

1. 모듈이 장면마다 중심인물 1명과 필요한 보조인물 최대 2명을 구성합니다.
2. Hooking Manager가 원본 Krea2 워크플로의 Power LoRA Loader에서 파일명과 강도를 읽습니다.
3. 전용 메뉴에서 파일별 영문 캐릭터명과 적용 강도를 저장합니다.
4. 1인 장면에서 이름이 정확히 일치하면 해당 LoRA 하나만 적용합니다.
5. 2~3인 장면은 얼굴 전염 방지를 위해 캐릭터 LoRA 노드를 항상 제거합니다.
6. 1인 장면이라도 빈칸이거나 이름이 일치하지 않으면 캐릭터 LoRA를 적용하지 않습니다.
7. 같은 전용 메뉴에서 이미지 가로·세로 해상도를 수정하면 다음 생성 요청부터 적용합니다.

재부팅 후에는 `E:\Chatbot\Start Krea2 Chatbot.bat`를 더블클릭하면 Krea2 ComfyUI,
Hooking Manager와 PocketRisu가 함께 실행됩니다. 현재 4.4.2 모듈은 다섯 개의
개별 문단 토큰을 프리셋에서 조립하며, 실사·2D 같은 렌더링 스타일도 프리셋이
결정하도록 분리되어 있습니다. 대화, 시선 교환, 접촉, 대치가 장면의 핵심이면
필요한 인물을 실제 구도에 포함하고, 무관한 군중은 추가하지 않습니다.

모듈 메뉴는 실제 코드에서 사용하는 발동, 이미지발동, 프리셋, 키비주얼 위치,
저장 개수만 유지하며 사용되지 않는 기존 NAI 옵션은 제거했습니다.

자세한 설치와 검증 방법은 `integration/README.md`와 `hooking_manager/README.md`를 참고하세요.

## 저장소 자체 검증

모델이나 ComfyUI 설치 없이 게시된 모듈, 워크플로, 런처와 Hooking Manager 패치의 계약을 확인할 수 있습니다.

```powershell
python -m unittest discover -s integration/tests -v
```
