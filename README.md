# Dummy Fight 3D

브라우저에서 실행되는 Three.js 기반 3D 자동 전투 시뮬레이션입니다.

## 전투 규칙

- Red Dummy: short blade
- Blue Dummy: spear
- 설정한 출혈량에 먼저 도달한 더미가 패배
- 머리 / 몸통 / 양팔 / 양다리에 독립 내구도 적용
- 팔·다리 파츠가 파괴되면 3D 부품처럼 분리되어 바닥에 떨어짐
- 오른팔이 분리되면 들고 있던 무기도 떨어지고 무기 공격을 더 이상 사용할 수 없음
- 무기 사용 불가 시 남은 팔 공격으로 전환
- 양팔 사용 불가 시 남은 다리 공격으로 전환
- 다리가 줄어들수록 이동 성능 감소
- 출혈량, 파츠 분리 확률, AI 공격성, 시뮬레이션 속도 조절 가능

## 3D 구현

- Three.js ES Module
- WebGLRenderer + 실시간 조명/그림자
- 관절 피벗 기반 더미 애니메이션
- 검 베기 / 창 찌르기 / 펀치 / 킥 애니메이션
- 분리된 파츠와 떨어진 무기의 간단한 3D 물리
- 충돌 파티클
- 카메라가 전투 중심을 자동 추적

외부 3D 모델 파일 없이 Three.js 기본 Geometry로 더미와 무기를 생성합니다.

## Vercel 배포

이 프로젝트는 빌드 과정이 없는 정적 사이트입니다.

1. Vercel에서 **Add New → Project**
2. GitHub의 `Dummy_fight` 저장소 선택
3. Framework Preset은 **Other**
4. Build Command는 비워둠
5. Output Directory도 비워둠
6. Deploy

루트의 `index.html`이 엔트리 포인트이며 `vercel.json`이 포함되어 있습니다.

## 로컬 실행

```bash
python -m http.server 8000
```

그 후 `http://localhost:8000`에 접속하면 됩니다.

`game.js`는 ES Module이며 Three.js를 CDN에서 가져옵니다.

## 표현 방식

비고어 더미 전투입니다. 파츠는 마네킹/로봇 부품처럼 분리되며 출혈은 실제 상처 표현 없이 수치와 게이지로 표시됩니다.
