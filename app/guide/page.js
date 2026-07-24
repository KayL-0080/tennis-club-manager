'use client';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import styles from './guide.module.css';

export default function GuidePage() {
  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.header}>
          <Link href="/" className={styles.backBtn}>← 메인으로 돌아가기</Link>
          <h1 className={styles.title}>Tennis Club Manager 서비스 가이드</h1>
          <p className={styles.sub}>
            클럽 생성부터 대진표 자동 매칭까지, 스마트하게 테니스 모임을 운영하는 방법을 알아보세요.
          </p>
        </div>

        <div className={styles.contentWrapper}>
          <aside className={styles.sidebar}>
            <h3 className={styles.navTitle}>목차</h3>
            <ul className={styles.navList}>
              <li className={styles.navItem}><a href="#intro" onClick={(e) => { e.preventDefault(); scrollTo('intro'); }} className={styles.navLink}>1. 서비스 소개</a></li>
              <li className={styles.navItem}><a href="#getting-started" onClick={(e) => { e.preventDefault(); scrollTo('getting-started'); }} className={styles.navLink}>2. 시작하기 (가입/생성)</a></li>
              <li className={styles.navItem}><a href="#bracket" onClick={(e) => { e.preventDefault(); scrollTo('bracket'); }} className={styles.navLink}>3. 대진표 자동 생성</a></li>
              <li className={styles.navItem}><a href="#manage" onClick={(e) => { e.preventDefault(); scrollTo('manage'); }} className={styles.navLink}>4. 점수 입력 및 순위표</a></li>
            </ul>
          </aside>

          <article className={styles.article}>
            <section id="intro" className={styles.section}>
              <h2 className={styles.sectionTitle}>1. 서비스 소개</h2>
              <p className={styles.text}>
                <strong>Tennis Club Manager</strong>는 테니스 동호회 및 소모임 운영진을 위한 종합 관리 플랫폼입니다.
                복잡한 대진표 작성과 점수 기록, 누적 순위표 관리를 손쉽게 자동화하여 모임 운영의 번거로움을 덜어드립니다.
              </p>
              <ul className={styles.list}>
                <li><span className={styles.highlight}>회원 관리</span>: 클럽 회원을 등록하고 각자의 성별/NTRP 점수를 관리합니다.</li>
                <li><span className={styles.highlight}>대진표 자동 생성</span>: 남복/여복/혼복/잡복 비율을 설정하면 클릭 한 번에 최적의 밸런스(NTRP 및 중복 페어 방지)로 대진표가 만들어집니다.</li>
                <li><span className={styles.highlight}>랭킹 시스템</span>: 매 라운드 입력된 점수를 바탕으로 승점과 득실차를 계산하여 일일 순위와 누적 랭킹을 제공합니다.</li>
              </ul>
            </section>

            <section id="getting-started" className={styles.section}>
              <h2 className={styles.sectionTitle}>2. 시작하기 (회원가입 및 클럽 생성)</h2>
              <h3 className={styles.subTitle}>회원가입 및 로그인</h3>
              <p className={styles.text}>
                서비스 메인 화면 우측의 <strong>회원가입</strong> 버튼을 눌러 이메일 주소와 이름, 비밀번호를 입력하면 바로 가입할 수 있습니다.
                Google 계정을 사용하여 더욱 간편하게 시작할 수도 있습니다.
              </p>
              
              <h3 className={styles.subTitle}>새로운 클럽 만들기 (운영진)</h3>
              <p className={styles.text}>
                로그인 후 메인 화면 하단의 <strong>➕ 새 클럽 만들기</strong> 버튼을 누르면 새로운 모임 공간이 생성됩니다.
                클럽을 생성한 사람은 자동으로 해당 클럽의 <span className={styles.highlight}>관리자(Admin)</span> 권한을 부여받습니다.
              </p>
              
              <h3 className={styles.subTitle}>클럽 가입하기 (일반 회원)</h3>
              <p className={styles.text}>
                기존에 운영 중인 클럽에 가입하려면, 메인 화면의 <strong>클럽 찾기</strong> 검색창에서 클럽 이름을 검색하세요. 
                검색된 클럽 카드 우측 하단의 <strong>가입 신청하기</strong> 버튼을 누르면, 해당 클럽의 관리자에게 가입 요청이 전달됩니다. 
                관리자가 승인하면 클럽 대시보드에 접근할 수 있습니다.
              </p>
            </section>

            <section id="bracket" className={styles.section}>
              <h2 className={styles.sectionTitle}>3. 대진표 자동 생성하기</h2>
              <p className={styles.text}>
                클럽 대시보드 상단의 <strong>+ 대진표 만들기</strong> 버튼을 눌러 대진표 생성 마법사로 진입합니다.
              </p>
              
              <h3 className={styles.subTitle}>참가자 선택</h3>
              <p className={styles.text}>
                '회원 전체 추가' 버튼을 누르거나 목록에서 개별적으로 선택하여 오늘 참석할 인원을 확정합니다.
                비회원 게스트가 있다면 <strong>+ 게스트 추가</strong> 버튼을 통해 임시 인원을 추가할 수 있습니다.
              </p>
              
              <h3 className={styles.subTitle}>경기 세부 설정</h3>
              <ul className={styles.list}>
                <li><strong>라운드 수 및 코트 수</strong>: 오늘 진행할 경기 라운드와 사용 가능한 코트 면수를 입력합니다.</li>
                <li><strong>경기 조건</strong>: 전체 경기 수(라운드 × 코트 수) 내에서 남복, 여복, 혼복, 잡복을 각각 몇 게임씩 진행할지 지정합니다.</li>
              </ul>
              
              <div className={styles.tipBox}>
                <div className={styles.tipTitle}>💡 목표 게임수 자동 균등배분 기능</div>
                <p className={styles.text} style={{ margin: 0, fontSize: '0.95rem' }}>
                  참가자들이 각각 몇 게임을 뛸지 정하는 <strong>목표 게임수</strong>는 대진표 생성의 핵심입니다. 
                  하단의 <span className={styles.highlight}>⚖️ 목표 게임수 자동 균등배분</span> 버튼을 누르면, 총 경기 수에 맞춰 모든 인원이 공평하게 경기에 참여할 수 있도록 게임 수가 자동으로 계산 및 배분됩니다.
                </p>
              </div>

              <p className={styles.text}>
                설정을 마친 후 맨 아래 <strong>🎾 자동으로 대진표 생성</strong> 버튼을 클릭하면, 참가자들의 실력(NTRP) 차이를 최소화하고 이전에 만났던 페어가 중복 배정되지 않도록 알고리즘이 대진표를 설계합니다.
              </p>
            </section>

            <section id="manage" className={styles.section}>
              <h2 className={styles.sectionTitle}>4. 점수 입력 및 순위표</h2>
              <p className={styles.text}>
                대진표 생성이 완료되면 <strong>📋 오늘 대진표</strong> 탭으로 이동하게 됩니다. 
                이곳에서 실시간으로 경기 진행 상황을 기록할 수 있습니다.
              </p>
              <h3 className={styles.subTitle}>결과 기록</h3>
              <p className={styles.text}>
                각 경기 셀 중앙의 스코어 입력란에서 드롭다운을 통해 A팀과 B팀의 획득 게임(점수)을 각각 입력하면 해당 결과가 즉시 저장됩니다.
                경기 당일 불참자 발생 등 예기치 못한 상황이 생긴 경우, 대진표 셀 내의 선수 이름 드롭다운을 클릭하여 다른 선수로 <strong>직접 교체</strong>할 수도 있습니다.
              </p>
              <h3 className={styles.subTitle}>개인 순위표</h3>
              <p className={styles.text}>
                스코어를 입력할 때마다 화면 하단의 <strong>오늘 개인 순위표</strong>가 실시간으로 업데이트됩니다.
                승률, 득실차, 포인트(승 3점, 무 1점, 패 -3점)가 자동 계산되어 당일의 1위부터 꼴찌까지의 랭킹을 한눈에 확인할 수 있습니다.
                지난 모임의 기록과 전체 누적 순위는 <strong>🏆 기록 · 순위</strong> 탭에서 언제든 열람할 수 있습니다.
              </p>
            </section>
          </article>
        </div>
      </main>
    </div>
  );
}
