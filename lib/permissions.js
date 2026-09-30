// lib/permissions.js — 클럽 기능별 권한 카탈로그 및 기본 설정

export const PERMISSION_CATEGORIES = [
  {
    id: 'schedules',
    name: '대진표 관리',
    icon: '📋',
    desc: '정기 모임 당일 대진 생성, 선수 배정 및 스코어 입력 권한',
    items: [
      {
        key: 'editMatchScore',
        name: '경기 스코어(점수) 실시간 입력 및 수정',
        desc: '진행 중인 경기 세트별 스코어(게임 승패)를 일반 회원이 직접 입력/수정할 수 있도록 허용합니다.',
        adminText: '🟢 항상 허용 (무제한)',
        defaultOpen: false,
      },
      {
        key: 'editMatchPlayer',
        name: '대진표 선수 교체 및 슬롯 배정',
        desc: '대진표에 배정된 선수를 다른 선수로 교체하거나 결원/추가 회원을 코트에 배정할 수 있습니다.',
        adminText: '🟢 항상 허용 (무제한)',
        defaultOpen: false,
      },
      {
        key: 'createSchedule',
        name: '새 대진표 생성 및 마법사 이용',
        desc: '새로운 날짜의 정기 대진표를 개설하거나 자동 생성 마법사를 실행할 수 있습니다.',
        adminText: '🟢 항상 허용 (무제한)',
        defaultOpen: false,
      },
    ]
  },
  {
    id: 'votes',
    name: '참석 투표 관리',
    icon: '🗳️',
    desc: '정기모임 참석 투표 개설, 마감 후 대리 수정 및 자동 생성 규칙 설정',
    items: [
      {
        key: 'createVote',
        name: '신규 참석 투표 개설 및 수동 등록',
        desc: '특정 날짜 및 시간대의 정기모임 또는 번개모임 참석 투표 게시글을 직접 개설합니다.',
        adminText: '🟢 항상 허용 (무제한)',
        defaultOpen: false,
      },
      {
        key: 'voteClosedOverride',
        name: '마감된 투표 대리 입력 및 상태 변경',
        desc: '전날 18:00 기준 마감된 투표 일정에 대해 본인 또는 타 회원의 참석 상태를 수정합니다.',
        adminText: '🟢 항상 허용 (무제한)',
        defaultOpen: false,
      },
      {
        key: 'voteSettings',
        name: '클럽 모임 규칙 (자동 요일/시간/장소)',
        desc: '매월 투표를 자동 생성하는 정기 모임 요일, 시간대, 코트 장소 기본 규칙을 수정합니다.',
        adminText: '🟢 항상 허용 (무제한)',
        defaultOpen: false,
      },
    ]
  },
  {
    id: 'tournaments',
    name: '정기 대회 관리',
    icon: '🏆',
    desc: '자체 토너먼트 대회 개설, 팀 드래프트 편성 및 경기 운영',
    items: [
      {
        key: 'manageTournament',
        name: '대회 개설, 드래프트 및 스코어 관리',
        desc: '자체 대회 생성, 팀 드래프트 편성, 대진표 생성 및 토너먼트 경기 결과를 관리합니다.',
        adminText: '🟢 항상 허용 (무제한)',
        defaultOpen: false,
      },
    ]
  },
  {
    id: 'members',
    name: '회원 및 회비 관리',
    icon: '👥',
    desc: '회원 명부 등록/수정, 월회비 납부 현황 및 코트비 정산',
    items: [
      {
        key: 'editMember',
        name: '회원 정보(직책/연락처/NTRP) 등록 및 수정',
        desc: '신규 회원을 등록하거나 기존 회원의 등급(정회원/준회원/게스트), NTRP, 직책을 수정합니다.',
        adminText: '🟢 항상 허용 (무제한)',
        defaultOpen: false,
      },
      {
        key: 'manageFee',
        name: '회비 납부 상태 관리 및 계좌 설정',
        desc: '회원별 월회비 납부 여부(완납/미납) 체크 및 클럽 입금 계좌번호 정보를 변경합니다.',
        adminText: '🟢 항상 허용 (무제한)',
        defaultOpen: false,
      },
      {
        key: 'courtFinance',
        name: '코트비 정산 & 최적 인원 산출기 이용',
        desc: '월별 대관 코트비 지출을 기록하고 클럽 재정 및 최적 적정 인원/회비를 산출합니다.',
        adminText: '🟢 항상 허용 (무제한)',
        defaultOpen: false,
      },
      {
        key: 'viewBylaws',
        name: '동호회 공식 회칙 및 개정 이력 열람',
        desc: '클럽 운영 규정 및 역대 개정 히스토리 모달을 일반 회원에게 공개합니다.',
        adminText: '🟢 항상 허용 (무제한)',
        defaultOpen: true, // 기본값 열람 오픈
      },
      {
        key: 'editBylaws',
        name: '동호회 회칙 제·개정 편집 및 조항 수정',
        desc: '동호회 공식 회칙 조항을 직접 수정하거나 신규 개정안을 등록합니다.',
        adminText: '🟢 항상 허용 (무제한)',
        defaultOpen: false,
      },
    ]
  },
  {
    id: 'stats',
    name: '통계 및 순위 규칙',
    icon: '📊',
    desc: '승점 산정 공식, 출석 가산점 및 순위 정렬 기준',
    items: [
      {
        key: 'rankingRules',
        name: '승점 및 순위 산정 기준/규칙 설정',
        desc: '승/무/패 포인트, 일별 출석 보너스 점수 및 평균/누적합 정렬 방식을 변경합니다.',
        adminText: '🟢 항상 허용 (무제한)',
        defaultOpen: false,
      },
    ]
  }
];

// 기본 디폴트 권한 객체 (key: boolean)
export const DEFAULT_PERMISSIONS = PERMISSION_CATEGORIES.flatMap(c => c.items).reduce((acc, item) => {
  acc[item.key] = item.defaultOpen;
  return acc;
}, {});
