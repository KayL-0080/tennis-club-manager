# Implementation Plan - Tennis Bracket UI Reorganization & Advanced Game Type Scheduling

이 계획서는 대진표 만들기 화면의 UX 입력 흐름 개편, 경기 날짜 투표 연동 조건 강화, 그리고 대중적인 복식 형태(남복/혼복/잡복) 세부 게임 수 설정 및 스케줄러 반영을 위한 작업 계획서입니다.

## User Review Required

- **입력 순서 개편**: 기본 설정의 레이블과 입력창 배치 순서가 기존 `기본 설정 -> 참가자 선택`에서 `경기 날짜 선택 -> 참가자 선택 -> 경기 세부 규칙 설정(라운드/코트/남복/혼복/잡복/시간)` 순으로 세련되게 재배치됩니다.
- **참가자 선택 제어**: 경기 날짜에 참석 투표 데이터가 존재하는 경우에만 `🗓️ 참석 투표 불러오기` 버튼이 활성화(Enabled)되며, 투표 데이터가 없을 시에는 비활성화(Disabled) 상태가 됩니다. 단, 날짜만 선택해도 참가자 수동 선택(회원 체크박스 추가 등)은 여전히 진행할 수 있도록 유지하여 유연성을 확보합니다.
- **세부 복식 형태(남복/혼복/잡복) 스케줄러 지원**: 기존의 `혼복 게임 수` 외에 `남복 게임 수` 및 `잡복 게임 수`를 입력받아 스케줄링 알고리즘이 이를 정확히 배정하도록 고도화합니다.

---

## Proposed Changes

### 1. Database & State Schema Updates

#### [MODIFY] [page.js](file:///C:/Users/LGHV/.gemini/antigravity/scratch/tennis-app/app/dashboard/page.js)
- `mensDoublesCount` 및 `jointCount` 상태 추가 (기본값 `0`).
- 대진표 생성 페이로드(`handleScheduleGenerated`, `handleScheduleManual`)에 `mensDoublesCount`, `jointCount` 데이터 추가 저장.

#### [MODIFY] [page.js](file:///C:/Users/LGHV/.gemini/antigravity/scratch/tennis-app/app/editor/[id]/page.js)
- 대진표 로드 및 저장 시 `mensDoublesCount`와 `jointCount` 필드 포함하여 양방향 동기화 처리.

---

### 2. UI Layout Reorganization

#### [MODIFY] [SettingsTab.js](file:///C:/Users/LGHV/.gemini/antigravity/scratch/tennis-app/components/tabs/SettingsTab.js)
- **1단계: 경기 날짜 선택 카드**:
  - 경기 날짜 선택 인풋만 포함하는 깔끔한 카드 상단 배치.
- **2단계: 참가자 선택 카드**:
  - 해당 날짜의 참석 투표(`events.find(e => e.date === matchDate)`) 존재 여부에 따라 `🗓️ 참석 투표 불러오기` 버튼의 `disabled` 속성을 동적으로 바인딩.
  - 참가자 추가 및 테이블 그리드 노출.
- **3단계: 경기 세부 설정 카드**:
  - 라운드 수, 코트 수 설정.
  - **남복 / 혼복 / 잡복 게임 수** 설정 인풋 나열.
    - 총 경기 수 `라운드 × 코트`와 `남복 + 혼복 + 잡복` 게임 수 합계가 일치하는지 실시간 검증 및 가이드 문구 제공.
  - 경기 시작 및 종료 시간 설정.

---

### 3. Scheduler Algorithm High-Performance Upgrade

#### [MODIFY] [scheduler.js](file:///C:/Users/LGHV/.gemini/antigravity/scratch/tennis-app/lib/scheduler.js)
- `tryGenerateOnce` 수정:
  - `opts.mensDoublesCount` 처리 루프 추가: 4명의 남성(M)만으로 구성된 쿼드 생성 및 필요도 차감.
  - `opts.mixedCount` 처리 루프: 남성 2명, 여성 2명으로 구성된 쿼드 생성 및 필요도 차감.
  - `opts.jointCount` 처리 루프: 남복이나 혼복이 아닌 잡복(여성 복식 4F, 남3 여1, 여3 남1 등 남복/혼복 조건을 제외한 나머지 조합) 쿼드 생성 및 필요도 차감.
  - 나머지 경기는 잔여 `freeCount`로 기존과 동일하게 안전 분배.

---

## Verification Plan

### Automated Tests
- `npm run build`를 실행하여 Next.js 및 TypeScript 빌드 무결성 확인.

### Manual Verification
1. 경기 날짜를 투표가 있는 날짜로 변경 시, `🗓️ 참석 투표 불러오기` 버튼이 활성화되는지 확인.
2. 경기 날짜를 투표가 없는 날짜로 변경 시, 해당 버튼이 비활성화되는지 확인.
3. 남복, 혼복, 잡복 게임 수의 합계가 `라운드 × 코트` 수와 일치할 때 대진표 자동 생성이 성공하는지 테스트.
4. 배포 후 Vercel 프로덕션 반영 확인.
