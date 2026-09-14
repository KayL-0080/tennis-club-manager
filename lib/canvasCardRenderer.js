// lib/canvasCardRenderer.js — 테니스 홍보 카드/포스터 Canvas 2D 고해상도 렌더러

/**
 * 코트 배경 및 테니스 라인 렌더링
 */
function drawCourtBackground(ctx, width, height, bgType, customImage = null) {
  if (bgType === 'custom' && customImage) {
    // 사용자 업로드 이미지 채우기 (cover 방식)
    const imgRatio = customImage.width / customImage.height;
    const canvasRatio = width / height;
    let sWidth, sHeight, sx, sy;
    if (imgRatio > canvasRatio) {
      sHeight = customImage.height;
      sWidth = customImage.height * canvasRatio;
      sx = (customImage.width - sWidth) / 2;
      sy = 0;
    } else {
      sWidth = customImage.width;
      sHeight = customImage.width / canvasRatio;
      sx = 0;
      sy = (customImage.height - sHeight) / 2;
    }
    ctx.drawImage(customImage, sx, sy, sWidth, sHeight, 0, 0, width, height);

    // 가독성을 위한 감성적인 다크 그라데이션 오버레이
    const darkGrad = ctx.createLinearGradient(0, 0, 0, height);
    darkGrad.addColorStop(0, 'rgba(15, 23, 42, 0.82)');
    darkGrad.addColorStop(0.5, 'rgba(15, 23, 42, 0.75)');
    darkGrad.addColorStop(1, 'rgba(15, 23, 42, 0.92)');
    ctx.fillStyle = darkGrad;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  // 테니스 코트 색상 팔레트
  let outerColor, innerColor, lineOpacity;
  if (bgType === 'grass') {
    // 윔블던 스타일 인조잔디
    outerColor = '#164e2d';
    innerColor = '#1e6f3d';
    lineOpacity = 0.85;
  } else if (bgType === 'clay') {
    // 롤랑가로스 클레이
    outerColor = '#9a3412';
    innerColor = '#c2410c';
    lineOpacity = 0.88;
  } else {
    // US Open 비비드 하드코트 (기본값)
    outerColor = '#0f172a';
    innerColor = '#0284c7';
    lineOpacity = 0.85;
  }

  // 1. 아웃 바운더리 배경 그리기
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, outerColor);
  bgGrad.addColorStop(1, '#090d16');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. 이너 테니스 코트 그리기
  const paddingX = width * 0.08;
  const paddingY = height * 0.06;
  const courtW = width - paddingX * 2;
  const courtH = height - paddingY * 2;

  ctx.save();
  // 부드러운 코트 라운딩
  ctx.fillStyle = innerColor;
  ctx.fillRect(paddingX, paddingY, courtW, courtH);

  // 인조잔디/코트 잔디결 질감 효과
  if (bgType === 'grass') {
    const stripeCount = 14;
    const stripeH = courtH / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.fillRect(paddingX, paddingY + i * stripeH, courtW, stripeH);
      }
    }
  }

  // 3. 테니스 코트 규격 라인 그리기 (화이트)
  ctx.strokeStyle = `rgba(255, 255, 255, ${lineOpacity})`;
  ctx.lineWidth = Math.max(3, width * 0.004);

  // 외곽선 (베이스라인 & 복식 사이드라인)
  ctx.strokeRect(paddingX, paddingY, courtW, courtH);

  // 단식 사이드라인
  const singlesOffset = courtW * 0.12;
  ctx.beginPath();
  ctx.moveTo(paddingX + singlesOffset, paddingY);
  ctx.lineTo(paddingX + singlesOffset, paddingY + courtH);
  ctx.moveTo(paddingX + courtW - singlesOffset, paddingY);
  ctx.lineTo(paddingX + courtW - singlesOffset, paddingY + courtH);
  ctx.stroke();

  // 센터 네트 라인
  const netY = paddingY + courtH / 2;
  ctx.strokeStyle = `rgba(255, 255, 255, ${lineOpacity + 0.1})`;
  ctx.lineWidth = Math.max(4, width * 0.005);
  ctx.beginPath();
  ctx.moveTo(paddingX - 10, netY);
  ctx.lineTo(paddingX + courtW + 10, netY);
  ctx.stroke();

  // 서비스 박스 라인
  const servBoxDist = courtH * 0.24;
  ctx.lineWidth = Math.max(3, width * 0.004);
  ctx.strokeStyle = `rgba(255, 255, 255, ${lineOpacity * 0.7})`;
  ctx.beginPath();
  ctx.moveTo(paddingX + singlesOffset, netY - servBoxDist);
  ctx.lineTo(paddingX + courtW - singlesOffset, netY - servBoxDist);
  ctx.moveTo(paddingX + singlesOffset, netY + servBoxDist);
  ctx.lineTo(paddingX + courtW - singlesOffset, netY + servBoxDist);

  // 센터 서비스 라인
  const centerX = paddingX + courtW / 2;
  ctx.moveTo(centerX, netY - servBoxDist);
  ctx.lineTo(centerX, netY + servBoxDist);
  ctx.stroke();

  ctx.restore();

  // 4. 세련된 비네팅 및 다크 오버레이 (카드 텍스트의 독보적인 가독성을 보장)
  const overlay = ctx.createRadialGradient(
    width / 2, height / 2, width * 0.2,
    width / 2, height / 2, width * 0.75
  );
  overlay.addColorStop(0, 'rgba(10, 15, 29, 0.65)');
  overlay.addColorStop(1, 'rgba(5, 8, 18, 0.90)');
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, width, height);
}

/**
 * 둥근 사각형 경로 생성 헬퍼
 */
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * 텍스트 줄바꿈 렌더링 헬퍼
 */
function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  if (!text) return y;
  const words = text.split('');
  let line = '';
  let linesDrawn = 0;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n];
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      if (linesDrawn === maxLines - 1) {
        ctx.fillText(line + '...', x, y);
        return y + lineHeight;
      }
      ctx.fillText(line, x, y);
      line = words[n];
      y += lineHeight;
      linesDrawn++;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
  return y + lineHeight;
}

/**
 * 메인 렌더링 함수
 * @param {HTMLCanvasElement} canvas
 * @param {string} type - 'member' | 'guest' | 'court'
 * @param {object} data - 폼 데이터
 * @param {object} options - { bgType: 'hard'|'grass'|'clay'|'custom', aspectRatio: '1:1'|'4:5'|'9:16', customImage: HTMLImageElement }
 */
export function renderCardToCanvas(canvas, type, data, options = {}) {
  const { bgType = 'hard', aspectRatio = '1:1', customImage = null, clubName = '테친회' } = options;

  let width = 1080;
  let height = 1080;
  if (aspectRatio === '4:5') {
    height = 1350;
  } else if (aspectRatio === '9:16') {
    height = 1920;
  }

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 1. 코트 배경 렌더링
  drawCourtBackground(ctx, width, height, bgType, customImage);

  // 2. 전체 스케일 및 여백 계산
  const scale = width / 1080;
  const padX = 64 * scale;
  let curY = 56 * scale;

  // 3. 상단 헤더 엠블럼 & 카테고리 태그
  const modeInfo = {
    member: { tag: 'MEMBERSHIP RECRUIT', titleDefault: '2026 신규 회원 모집', icon: '🎾', theme: '#38bdf8' },
    guest: { tag: 'GUEST RECRUIT', titleDefault: '테니스 게스트 모집', icon: '⚡', theme: '#34d399' },
    court: { tag: 'COURT TRANSFER', titleDefault: '테니스 코트 양도', icon: '🎟️', theme: '#f59e0b' }
  }[type] || { tag: 'TENNIS MATCH', titleDefault: '테니스 공지', icon: '🎾', theme: '#38bdf8' };

  // 상단 클럽 배지 캡슐
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  roundRect(ctx, padX, curY, 320 * scale, 42 * scale, 21 * scale);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1.5 * scale;
  ctx.stroke();

  ctx.fillStyle = modeInfo.theme;
  ctx.font = `bold ${16 * scale}px -apple-system, BlinkMacSystemFont, "Pretendard", "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(`${modeInfo.icon} ${clubName} • ${modeInfo.tag}`, padX + 16 * scale, curY + 27 * scale);
  ctx.restore();

  curY += 64 * scale;

  // 4. 메인 타이틀 (Hero Title)
  const mainTitle = data.title?.trim() || modeInfo.titleDefault;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${44 * scale}px -apple-system, BlinkMacSystemFont, "Pretendard", "Noto Sans KR", sans-serif`;
  ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 14 * scale;
  ctx.shadowOffsetY = 4 * scale;
  curY = drawWrappedText(ctx, mainTitle, padX, curY + 40 * scale, width - padX * 2, 54 * scale, 2);
  ctx.restore();

  curY += 16 * scale;

  // 5. 핵심 정보 그리드 카드 렌더링
  const contentW = width - padX * 2;

  // 정보 박스 그리기 도우미 함수
  const drawInfoItem = (icon, label, value, subValue = null, highlightColor = null) => {
    if (!value) return 0;
    const itemH = (subValue ? 88 : 72) * scale;

    ctx.save();
    // 글래스 배경
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    roundRect(ctx, padX, curY, contentW, itemH, 16 * scale);
    ctx.fill();
    ctx.strokeStyle = highlightColor ? highlightColor : 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = (highlightColor ? 2 : 1) * scale;
    ctx.stroke();

    // 아이콘 원형 배지
    const badgeSize = 44 * scale;
    const badgeX = padX + 16 * scale;
    const badgeY = curY + (itemH - badgeSize) / 2;
    ctx.fillStyle = highlightColor ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.12)';
    roundRect(ctx, badgeX, badgeY, badgeSize, badgeSize, 12 * scale);
    ctx.fill();

    ctx.font = `${22 * scale}px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, badgeX + badgeSize / 2, badgeY + badgeSize / 2 + 1);

    // 라벨
    const textX = badgeX + badgeSize + 16 * scale;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = `600 ${15 * scale}px -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif`;
    ctx.fillText(label, textX, curY + 28 * scale);

    // 값
    ctx.fillStyle = highlightColor || '#ffffff';
    ctx.font = `800 ${subValue ? 20 * scale : 22 * scale}px -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif`;
    ctx.fillText(value, textX, curY + (subValue ? 54 * scale : 52 * scale));

    if (subValue) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.font = `500 ${14 * scale}px -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif`;
      ctx.fillText(subValue, textX, curY + 74 * scale);
    }

    ctx.restore();
    curY += itemH + 12 * scale;
    return itemH + 12 * scale;
  };

  // 모드별 필드 렌더링
  if (type === 'member') {
    // 1. 신규 회원 모집
    drawInfoItem('📍', '정기 활동 장소', data.place || '올림픽공원 테니스코트');
    drawInfoItem('⏰', '정기 모임 일시', data.schedule || '매주 일요일 07:00 ~ 11:00');
    drawInfoItem('👥', '모집 대상', data.target || '남/여 무관, 구력 2년 이상 (동배/은배 이상 환영)');
    
    // 회비 정보 (가입비 + 월/분기 회비 듀얼 표기)
    const feeText = `가입비: ${data.joinFee || '없음'} / 정기회비: ${data.monthlyFee || '월 40,000원'}`;
    drawInfoItem('💰', '회비 안내', feeText, null, '#38bdf8');

  } else if (type === 'guest') {
    // 2. 게스트 모집
    drawInfoItem('📍', '코트 위치', data.place || '올림픽공원 실내코트 3번');
    drawInfoItem('📅', '참석 일시', data.dateTime || '2026.09.20 (일) 08:00 ~ 11:00 (3시간)');
    drawInfoItem('👥', '게스트 모집 대상', data.target || '남/여 무관 (NTRP 3.0+ / 구력 2년 이상)');
    drawInfoItem('💵', '게스트 참가비', data.cost || '15,000원 (공/음료 포함)', null, '#34d399');

  } else if (type === 'court') {
    // 3. 코트 양도
    drawInfoItem('📍', '양도 코트 장소', data.place || '올림픽공원 테니스경기장');
    drawInfoItem('📅', '이용 일시 & 시간', `${data.date || '2026.09.21 (월)'} ${data.time ? `• ${data.time}` : ''}`);
    drawInfoItem('🎾', '코트 상세 정보', data.courtInfo || '실내 하드 2코트 (냉난방 완비)');
    drawInfoItem('🎟️', '양도 금액', data.price || '40,000원 (원가 양도)', null, '#f59e0b');
  }

  // 6. 비고 및 추가 안내 박스 (입력된 경우)
  if (data.notes && data.notes.trim()) {
    const noteH = 68 * scale;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    roundRect(ctx, padX, curY, contentW, noteH, 14 * scale);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1 * scale;
    ctx.stroke();

    ctx.fillStyle = '#f1f5f9';
    ctx.font = `600 ${15 * scale}px -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('💡 안내 / 비고:', padX + 16 * scale, curY + 26 * scale);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = `500 ${14 * scale}px -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif`;
    drawWrappedText(ctx, data.notes.trim(), padX + 16 * scale, curY + 48 * scale, contentW - 32 * scale, 20 * scale, 1);
    ctx.restore();
    curY += noteH + 16 * scale;
  } else {
    curY += 10 * scale;
  }

  // 7. 하단 연락처 & 카톡ID 문의 바
  const contactH = 92 * scale;
  const contactY = height - padX - contactH;

  ctx.save();
  // 하단 눈에 띄는 프리미엄 컨택트 카드
  const contactGrad = ctx.createLinearGradient(padX, contactY, padX + contentW, contactY);
  contactGrad.addColorStop(0, 'rgba(30, 41, 59, 0.95)');
  contactGrad.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
  ctx.fillStyle = contactGrad;
  roundRect(ctx, padX, contactY, contentW, contactH, 18 * scale);
  ctx.fill();
  ctx.strokeStyle = modeInfo.theme;
  ctx.lineWidth = 2 * scale;
  ctx.stroke();

  // 상단 레이블
  ctx.fillStyle = modeInfo.theme;
  ctx.font = `bold ${14 * scale}px -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText('💬 신청 및 문의하기', padX + 20 * scale, contactY + 28 * scale);

  // 연락처와 카톡 ID 한 줄 또는 두 열로 표시
  const phone = data.contact?.trim() || '운영진 문의';
  const kakao = data.kakaoId?.trim() || '';

  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${20 * scale}px -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif`;
  let contactText = `📞 ${phone}`;
  if (kakao) {
    contactText += `   |   💬 카톡: ${kakao}`;
  }
  ctx.fillText(contactText, padX + 20 * scale, contactY + 62 * scale);

  // 우측 바로가기 배지
  ctx.fillStyle = modeInfo.theme;
  ctx.textAlign = 'right';
  ctx.font = `bold ${14 * scale}px -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif`;
  ctx.fillText('빠른 문의 환영 →', padX + contentW - 20 * scale, contactY + 48 * scale);

  ctx.restore();
}

/**
 * 캔버스를 고해상도 PNG Blob으로 변환
 */
export function exportCanvasAsBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/png', 1.0);
  });
}

/**
 * 캔버스를 DataURL로 변환
 */
export function exportCanvasAsDataURL(canvas) {
  return canvas.toDataURL('image/png', 1.0);
}

/**
 * SNS/카카오톡/당근마켓 맞춤형 텍스트 공지문 자동 생성
 */
export function generateShareText(type, data, clubName = '테친회') {
  if (type === 'member') {
    let t = `🎾 [${clubName}] 신규 회원 모집 안내 🎾\n\n`;
    t += `📌 제목: ${data.title || `${clubName} 신규 회원 모집`}\n`;
    t += `📍 장소: ${data.place || '정기 활동 코트'}\n`;
    t += `⏰ 일시: ${data.schedule || '정기 모임 일정'}\n`;
    t += `👥 모집대상: ${data.target || '남/여 동호인 환영'}\n`;
    t += `💰 회비안내: 가입비 ${data.joinFee || '없음'} / 회비 ${data.monthlyFee || '협의'}\n`;
    if (data.contact) t += `📞 연락처: ${data.contact}\n`;
    if (data.kakaoId) t += `💬 카톡ID: ${data.kakaoId}\n`;
    if (data.notes) t += `\n💡 비고: ${data.notes}\n`;
    t += `\n함께 즐겁게 테니스 치실 분들의 많은 관심과 연락 부탁드립니다! 😊`;
    return t;
  }

  if (type === 'guest') {
    let t = `⚡ [${clubName}] 게스트 모집 공지 ⚡\n\n`;
    t += `📌 제목: ${data.title || '테니스 게스트 모집'}\n`;
    t += `📍 장소: ${data.place || '코트 장소'}\n`;
    t += `📅 일시: ${data.dateTime || '참석 일시'}\n`;
    t += `👥 모집대상: ${data.target || '남/여 무관'}\n`;
    t += `💵 참가비: ${data.cost || '15,000원'}\n`;
    if (data.contact) t += `📞 연락처: ${data.contact}\n`;
    if (data.kakaoId) t += `💬 카톡ID: ${data.kakaoId}\n`;
    if (data.notes) t += `\n💡 안내: ${data.notes}\n`;
    t += `\n매너 좋고 활기찬 경기 함께해요! 편하게 연락주세요 🎾`;
    return t;
  }

  if (type === 'court') {
    let t = `🎟️ [코트 양도] 테니스 코트 양도합니다 🎟️\n\n`;
    t += `📌 제목: ${data.title || '테니스 코트 양도'}\n`;
    t += `📍 장소: ${data.place || '코트 장소'}\n`;
    t += `📅 일시: ${data.date || '이용 날짜'}${data.time ? ` (${data.time})` : ''}\n`;
    t += `🎾 코트정보: ${data.courtInfo || '코트 번호 및 정보'}\n`;
    t += `💰 양도금액: ${data.price || '원가 양도'}\n`;
    if (data.contact) t += `📞 연락처: ${data.contact}\n`;
    if (data.kakaoId) t += `💬 카톡ID: ${data.kakaoId}\n`;
    if (data.notes) t += `\n💡 비고: ${data.notes}\n`;
    t += `\n입금 확인 후 즉시 예약 정보 전달해드립니다. 감사합니다!`;
    return t;
  }

  return '';
}
