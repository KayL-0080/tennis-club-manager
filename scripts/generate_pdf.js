const fs = require('fs');
const { mdToPdf } = require('md-to-pdf');

(async () => {
  const manualMd = `
# 🎾 Tennis Match Manager 사용자 매뉴얼

본 매뉴얼은 **테니스 매치(Tennis Match)** 웹 애플리케이션의 사용 방법을 안내합니다.  
현재 버전은 모든 사용자가 로그인 없이 주요 정보를 조회하고 참가 투표를 할 수 있도록 개방되어 있습니다.

---

## 1. 첫 화면 (대진표 대시보드)

앱에 접속하면 가장 먼저 **대진표 대시보드**가 나타납니다.

<img src="./public/manual-dashboard.png" width="800" />

- **비로그인 사용자:** 기존에 만들어진 대진표 목록을 볼 수 있으며, 대진표 카드를 클릭하여 오늘의 상세 대진과 경기 결과, 개인 순위표를 확인할 수 있습니다.
- **관리자 (운영진):** 로그인 후에는 상단의 \`+ 대진표 만들기\` 버튼이 활성화되어 새로운 대진표를 생성할 수 있습니다.

---

## 2. 참석 투표 (누구나 가능)

상단 메뉴의 **참석투표**를 누르면 정기 모임 일정이 나타납니다.

<img src="./public/manual-votes.png" width="800" />

- **참석 여부 투표:** 다가오는 일정을 클릭하여 자신의 이름 옆에 참석(Y) / 불참(N)을 선택할 수 있습니다.
- **조회 기능:** 이번 주 모임에 누가 참석하는지, 총 몇 명인지 한눈에 확인할 수 있습니다.

---

## 3. 회원 관리 (명단 조회)

상단 메뉴의 **회원관리**에서는 클럽의 회원 명단과 실력 등급(NTRP)을 확인할 수 있습니다.

<img src="./public/manual-members.png" width="800" />

- **비로그인 사용자:** 회원의 이름, 성별, 등급(NTRP)을 조회할 수 있습니다.
- **관리자:** 회원의 정보를 수정하거나, 새로운 회원을 추가/삭제할 수 있는 버튼이 활성화됩니다.

---

## 4. 통계 대시보드

상단 메뉴의 **통계 대시보드**에서는 월별/전체 기간의 회원 활동 통계를 볼 수 있습니다.

<img src="./public/manual-stats.png" width="800" />

- **Top 3 랭킹:** 해당 기간 동안 승률이 가장 높은 Top 3 선수를 메달과 함께 보여줍니다.
- **개인별 통계:** 각 회원별 총 경기 수, 승리, 패배, 승률, 득실차를 표 형태로 제공합니다.

---

## 5. 관리자 기능 (로그인)

운영진은 우측 상단의 **[관리자 로그인]**을 통해 구글 계정으로 로그인할 수 있습니다.
- **권한 부여:** 최고 관리자(회장)는 '운영진 관리' 메뉴에서 다른 운영진의 이메일을 추가하여 관리자 권한을 부여할 수 있습니다.
- **점수 기록:** 대진표 상세 화면에서 각 코트의 경기 점수를 직접 입력하고 저장할 수 있습니다. (현재 버전에서는 원활한 테스트를 위해 누구나 점수 입력을 체험해볼 수 있게 개방되어 있습니다.)

`;

  fs.writeFileSync('manual.md', manualMd);
  console.log('manual.md written.');

  try {
    const pdf = await mdToPdf({ path: 'manual.md' }, {
      dest: 'public/manual.pdf',
      launch_options: { args: ['--no-sandbox'] },
      pdf_options: {
        format: 'A4',
        margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
        printBackground: true
      }
    });
    console.log('PDF generated at public/manual.pdf');
  } catch (err) {
    console.error('PDF generation failed:', err);
  }
})();
