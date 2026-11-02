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
 * 숫자 금액을 한글 금액 표기(예: 50000 -> "금 오만 원 정")로 변환
 */
export function numberToKoreanAmount(numStr) {
  if (!numStr) return '';
  const num = parseInt(String(numStr).replace(/[^0-9]/g, ''), 10);
  if (isNaN(num) || num === 0) return '';

  const units = ['', '만', '억', '조'];
  const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  const subUnits = ['', '십', '백', '천'];

  let result = '';
  let unitIdx = 0;
  let temp = num;

  while (temp > 0) {
    const chunk = temp % 10000;
    if (chunk > 0) {
      let chunkStr = '';
      let subTemp = chunk;
      for (let i = 0; i < 4; i++) {
        const d = subTemp % 10;
        if (d > 0) {
          chunkStr = digits[d] + subUnits[i] + chunkStr;
        }
        subTemp = Math.floor(subTemp / 10);
      }
      result = chunkStr + units[unitIdx] + ' ' + result;
    }
    temp = Math.floor(temp / 10000);
    unitIdx++;
  }

  return `금 ${result.trim()} 원 정`;
}

/**
 * 테니스 구매 상품권 전용 고해상도 렌더러 (만원 지폐 규격 148mm x 68mm)
 */
function drawTennisVoucher(ctx, width, height, data = {}, options = {}) {
  const { clubName = '테친회', customImage = null } = options;
  const theme = data.themeColor || 'green';

  // 1. 테마 색상 팔레트
  const palettes = {
    green: {
      bg1: '#092314', bg2: '#03120a',
      outerBorder: '#d97706', innerBorder: '#15803d',
      tintLine: 'rgba(74, 222, 128, 0.08)',
      waveColor: 'rgba(34, 197, 94, 0.06)',
      cardBg: 'rgba(6, 30, 16, 0.75)',
      gold1: '#fde047', gold2: '#ca8a04',
      primaryText: '#ffffff',
      subText: '#bbf7d0',
      badgeBg: '#14532d',
      accent: '#22c55e',
      stampText: '테친회장인'
    },
    gold: {
      bg1: '#111827', bg2: '#030712',
      outerBorder: '#f59e0b', innerBorder: '#b45309',
      tintLine: 'rgba(251, 191, 36, 0.10)',
      waveColor: 'rgba(245, 158, 11, 0.05)',
      cardBg: 'rgba(15, 23, 42, 0.80)',
      gold1: '#fef08a', gold2: '#d97706',
      primaryText: '#ffffff',
      subText: '#fde68a',
      badgeBg: '#1e293b',
      accent: '#eab308',
      stampText: '테친회장인'
    },
    blue: {
      bg1: '#082f49', bg2: '#021320',
      outerBorder: '#38bdf8', innerBorder: '#0284c7',
      tintLine: 'rgba(56, 189, 248, 0.10)',
      waveColor: 'rgba(14, 165, 233, 0.06)',
      cardBg: 'rgba(7, 36, 61, 0.78)',
      gold1: '#bae6fd', gold2: '#0284c7',
      primaryText: '#ffffff',
      subText: '#7dd3fc',
      badgeBg: '#0369a1',
      accent: '#38bdf8',
      stampText: '테친회장인'
    },
    clay: {
      bg1: '#3c1106', bg2: '#1a0602',
      outerBorder: '#fb923c', innerBorder: '#c2410c',
      tintLine: 'rgba(251, 146, 60, 0.10)',
      waveColor: 'rgba(234, 88, 12, 0.06)',
      cardBg: 'rgba(45, 15, 8, 0.80)',
      gold1: '#ffedd5', gold2: '#ea580c',
      primaryText: '#ffffff',
      subText: '#fdba74',
      badgeBg: '#9a3412',
      accent: '#f97316',
      stampText: '테친회장인'
    }
  };

  const p = palettes[theme] || palettes.green;

  // 2. 배경 그라데이션 및 질감
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, p.bg1);
  bgGrad.addColorStop(0.5, '#05140b');
  bgGrad.addColorStop(1, p.bg2);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 사용자 커스텀 이미지가 있으면 18% 반투명 워터마크로 배경에 은은하게 블렌딩
  if (customImage) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    const imgRatio = customImage.width / customImage.height;
    const canvasRatio = width / height;
    let sW, sH, sx, sy;
    if (imgRatio > canvasRatio) {
      sH = customImage.height; sW = customImage.height * canvasRatio;
      sx = (customImage.width - sW) / 2; sy = 0;
    } else {
      sW = customImage.width; sH = customImage.width / canvasRatio;
      sx = 0; sy = (customImage.height - sH) / 2;
    }
    ctx.drawImage(customImage, sx, sy, sW, sH, 0, 0, width, height);
    ctx.restore();
  }

  // 3. 지폐 보안 기요셰(Guilloche) 미세 파동 곡선 패턴 렌더링
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = p.waveColor;
  for (let y = 0; y < height; y += 14) {
    ctx.beginPath();
    for (let x = 0; x <= width; x += 20) {
      const dy = Math.sin((x + y * 2) * 0.02) * 8 + Math.cos((x - y) * 0.015) * 6;
      if (x === 0) ctx.moveTo(x, y + dy);
      else ctx.lineTo(x, y + dy);
    }
    ctx.stroke();
  }

  // 대각선 미세 보안 격자
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
  for (let x = -height; x < width + height; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height, height);
    ctx.stroke();
  }
  ctx.restore();

  // 4. 지폐 외곽 장식 테두리 (Double Banknote Frame & Corner Ornaments)
  const margin = 26;
  const fW = width - margin * 2;
  const fH = height - margin * 2;

  // 바깥 테두리 (Gold)
  ctx.save();
  ctx.strokeStyle = p.outerBorder;
  ctx.lineWidth = 4;
  roundRect(ctx, margin, margin, fW, fH, 16);
  ctx.stroke();

  // 안쪽 얇은 테두리
  ctx.strokeStyle = p.innerBorder;
  ctx.lineWidth = 1.5;
  roundRect(ctx, margin + 7, margin + 7, fW - 14, fH - 14, 12);
  ctx.stroke();

  // 테두리 사이 해칭 패턴
  ctx.strokeStyle = p.tintLine;
  ctx.lineWidth = 1;
  ctx.strokeRect(margin + 12, margin + 12, fW - 24, fH - 24);

  // 4개 모서리 지폐 장식 로제트 & 코너 액면가
  const drawCornerNumeral = (cx, cy, align, baseline) => {
    ctx.save();
    ctx.fillStyle = p.gold1;
    ctx.font = '900 24px -apple-system, sans-serif';
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 6;
    ctx.fillText('₩', cx, cy);
    ctx.restore();
  };
  drawCornerNumeral(margin + 20, margin + 20, 'left', 'top');
  drawCornerNumeral(width - margin - 20, margin + 20, 'right', 'top');
  drawCornerNumeral(margin + 20, height - margin - 20, 'left', 'bottom');
  drawCornerNumeral(width - margin - 20, height - margin - 20, 'right', 'bottom');
  ctx.restore();

  // 5. 좌측 패널: 테니스 라켓 2자루 X자 교차 + 테니스공 + 테니스 용품 아이콘 아트
  ctx.save();
  const leftCenterX = 230;
  const leftCenterY = 320;

  // 좌측 엠블럼 메달 백그라운드
  const medalGrad = ctx.createRadialGradient(leftCenterX, leftCenterY, 30, leftCenterX, leftCenterY, 150);
  medalGrad.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
  medalGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.35)');
  medalGrad.addColorStop(1, 'rgba(0, 0, 0, 0.70)');
  ctx.fillStyle = medalGrad;
  ctx.beginPath();
  ctx.arc(leftCenterX, leftCenterY, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = p.outerBorder;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 외곽 장식 링
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(leftCenterX, leftCenterY, 142, 0, Math.PI * 2);
  ctx.stroke();

  // 테니스 라켓 그리기 헬퍼
  const drawRacket = (angleDeg) => {
    ctx.save();
    ctx.translate(leftCenterX, leftCenterY);
    ctx.rotate((angleDeg * Math.PI) / 180);

    // 라켓 헤드 (타원)
    const headY = -70;
    const headRx = 46;
    const headRy = 62;

    // 스트링 메쉬
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1;
    for (let sx = -headRx + 12; sx <= headRx - 12; sx += 10) {
      const halfH = Math.sqrt(Math.max(0, 1 - (sx * sx) / (headRx * headRx))) * headRy;
      ctx.beginPath();
      ctx.moveTo(sx, headY - halfH);
      ctx.lineTo(sx, headY + halfH);
      ctx.stroke();
    }
    for (let sy = -headRy + 12; sy <= headRy - 12; sy += 10) {
      const halfW = Math.sqrt(Math.max(0, 1 - (sy * sy) / (headRy * headRy))) * headRx;
      ctx.beginPath();
      ctx.moveTo(-halfW, headY + sy);
      ctx.lineTo(halfW, headY + sy);
      ctx.stroke();
    }

    // 라켓 프레임 (외곽 림)
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(0, headY, headRx, headRy, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, headY, headRx + 2, headRy + 2, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 라켓 목 (V자 스로트)
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-16, headY + headRy - 4);
    ctx.lineTo(-7, headY + headRy + 22);
    ctx.lineTo(0, headY + headRy + 32);
    ctx.lineTo(7, headY + headRy + 22);
    ctx.lineTo(16, headY + headRy - 4);
    ctx.stroke();

    // 샤프트 & 손잡이 (핸들)
    const handleY = headY + headRy + 32;
    const handleH = 75;
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(-7, handleY, 14, handleH);

    // 그립 테이프 대각선 래핑 라인
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    for (let gy = handleY + 6; gy < handleY + handleH; gy += 10) {
      ctx.beginPath();
      ctx.moveTo(-7, gy);
      ctx.lineTo(7, gy + 5);
      ctx.stroke();
    }

    // 버트캡
    ctx.fillStyle = p.outerBorder;
    ctx.fillRect(-8.5, handleY + handleH - 4, 17, 6);

    ctx.restore();
  };

  // 2자루 X자 교차 라켓 렌더링
  drawRacket(-32);
  drawRacket(32);

  // 중앙 형광 테니스공 (3D 광택 & 봉합선)
  const ballR = 36;
  const ballGrad = ctx.createRadialGradient(
    leftCenterX - 10, leftCenterY - 10, 4,
    leftCenterX, leftCenterY, ballR
  );
  ballGrad.addColorStop(0, '#fef08a');
  ballGrad.addColorStop(0.4, '#ccff00');
  ballGrad.addColorStop(0.85, '#a3e635');
  ballGrad.addColorStop(1, '#65a30d');

  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;

  ctx.fillStyle = ballGrad;
  ctx.beginPath();
  ctx.arc(leftCenterX, leftCenterY, ballR, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // 테니스공 흰색 곡선 솔기 (Curved Seam Lines)
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.arc(leftCenterX - 18, leftCenterY, 26, -0.9, 0.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(leftCenterX + 18, leftCenterY, 26, Math.PI - 0.9, Math.PI + 0.9);
  ctx.stroke();

  // 상단 / 하단 리본 라벨
  ctx.fillStyle = p.gold1;
  ctx.font = '800 13px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('★ OFFICIAL TENNIS GEAR ★', leftCenterX, leftCenterY - 165);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = '600 12px "Pretendard", sans-serif';
  ctx.fillText('🎾 라켓 · 👟 슈즈 · 🧵 스트링 · 📦 볼', leftCenterX, leftCenterY + 175);
  ctx.restore();

  // 6. 중앙 메인 섹션: 제목, 금액(대형), 한글 금액, 사용처 및 유효기간
  ctx.save();
  const centerX = 720;

  // 상단 클럽 배지 & 서브타이틀
  ctx.fillStyle = p.gold1;
  ctx.font = 'bold 15px -apple-system, "Pretendard", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`★ ${clubName.toUpperCase()} OFFICIAL GIFT CERTIFICATE ★`, centerX, 88);

  // 메인 제목: 테니스 용품 구매 상품권
  const title = data.title || '테니스 용품 구매 상품권';
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 44px -apple-system, "Pretendard", "Noto Sans KR", sans-serif';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 3;
  ctx.fillText(title, centerX, 146);

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // 영문 서브타이틀
  const subtitle = data.subtitle || 'TENNIS GOODS PURCHASE GIFT CERTIFICATE';
  ctx.fillStyle = p.subText;
  ctx.font = '700 13px -apple-system, sans-serif';
  ctx.fillText(subtitle, centerX, 175);

  // 대형 금액(금 50,000원) 하이라이트 박스
  const amountBoxW = 600;
  const amountBoxH = 155;
  const amountBoxX = centerX - amountBoxW / 2;
  const amountBoxY = 198;

  // 금액 박스 배경
  ctx.fillStyle = 'rgba(0, 0, 0, 0.40)';
  roundRect(ctx, amountBoxX, amountBoxY, amountBoxW, amountBoxH, 16);
  ctx.fill();

  // 금액 박스 테두리 (Gold)
  ctx.strokeStyle = p.outerBorder;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  roundRect(ctx, amountBoxX + 5, amountBoxY + 5, amountBoxW - 10, amountBoxH - 10, 12);
  ctx.stroke();

  // 숫자 금액 표시 (예: ₩ 50,000)
  const rawAmount = String(data.amount || '50,000').replace(/[^0-9]/g, '');
  const numVal = parseInt(rawAmount, 10);
  const formattedAmount = isNaN(numVal) ? (data.amount || '50,000') : numVal.toLocaleString('ko-KR');
  const unit = data.amountUnit || '원';

  // 3D 골드 그라데이션 텍스트
  const amountGrad = ctx.createLinearGradient(amountBoxX, amountBoxY + 20, amountBoxX, amountBoxY + 90);
  amountGrad.addColorStop(0, '#ffffff');
  amountGrad.addColorStop(0.4, p.gold1);
  amountGrad.addColorStop(1, p.outerBorder);

  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;

  ctx.fillStyle = amountGrad;
  ctx.font = '900 68px -apple-system, "Pretendard", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`₩ ${formattedAmount} ${unit}`, centerX, amountBoxY + 84);

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // 한글 금액 표기 (예: 금 오만 원 정)
  const koreanAmount = data.amountText || (isNaN(numVal) ? '금 오만 원 정' : numberToKoreanAmount(numVal));
  ctx.fillStyle = p.gold1;
  ctx.font = '800 21px -apple-system, "Pretendard", "Batang", serif';
  ctx.fillText(`[ ${koreanAmount} ]`, centerX, amountBoxY + 128);

  // 하단 상세 내역 카드 (사용품목, 유효기간, 발행처)
  const detailBoxW = 600;
  const detailBoxH = 145;
  const detailBoxX = centerX - detailBoxW / 2;
  const detailBoxY = 370;

  ctx.fillStyle = p.cardBg;
  roundRect(ctx, detailBoxX, detailBoxY, detailBoxW, detailBoxH, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 상세 필드 줄별 렌더링
  ctx.textAlign = 'left';
  const labelX = detailBoxX + 22;
  const valX = detailBoxX + 110;

  // 1. 사용품목
  ctx.fillStyle = p.subText;
  ctx.font = '700 14px "Pretendard", sans-serif';
  ctx.fillText('🛍️ 사용품목', labelX, detailBoxY + 36);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 15px "Pretendard", sans-serif';
  const targetItems = data.targetItems || '테니스 라켓, 스트링 교체, 테니스화, 테니스공 및 용품 일체';
  ctx.fillText(targetItems.length > 36 ? targetItems.substring(0, 35) + '...' : targetItems, valX, detailBoxY + 36);

  // 2. 유효기간
  ctx.fillStyle = p.subText;
  ctx.font = '700 14px "Pretendard", sans-serif';
  ctx.fillText('📅 유효기간', labelX, detailBoxY + 74);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 15px "Pretendard", sans-serif';
  ctx.fillText(data.validity || '발행일로부터 1년 (2027.12.31까지)', valX, detailBoxY + 74);

  // 3. 발 행 처
  ctx.fillStyle = p.subText;
  ctx.font = '700 14px "Pretendard", sans-serif';
  ctx.fillText('🏢 발 행 처', labelX, detailBoxY + 112);

  ctx.fillStyle = p.gold1;
  ctx.font = '800 16px "Pretendard", sans-serif';
  ctx.fillText(data.issuer || `${clubName} 운영위원회`, valX, detailBoxY + 112);

  // 하단 사용 안내 주석
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.font = '500 12px "Pretendard", sans-serif';
  const notesText = data.notes || '본 상품권은 테니스 용품 구매 및 스트링 작업 시 현금과 동일하게 사용 가능합니다. (액면가의 60% 이상 사용 시 잔액 환불)';
  ctx.fillText(notesText.length > 60 ? notesText.substring(0, 58) + '...' : notesText, centerX, 545);
  ctx.restore();

  // 7. 우측 보안 & 인증 섹션 (골드 홀로그램 인증씰 + 직인 + 바코드 + 시리얼번호)
  ctx.save();
  const rightCenterX = width - 210;

  // A. 골드 홀로그램 로제트 인증씰 (Starburst Rosette)
  const sealY = 205;
  const sealR = 64;

  // 후광 효과
  const haloGrad = ctx.createRadialGradient(rightCenterX, sealY, 20, rightCenterX, sealY, sealR + 15);
  haloGrad.addColorStop(0, 'rgba(251, 191, 36, 0.35)');
  haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = haloGrad;
  ctx.beginPath();
  ctx.arc(rightCenterX, sealY, sealR + 15, 0, Math.PI * 2);
  ctx.fill();

  // 24포인트 톱니바퀴형 스타버스트 로제트
  ctx.save();
  ctx.beginPath();
  const numPoints = 28;
  for (let i = 0; i < numPoints * 2; i++) {
    const r = (i % 2 === 0) ? sealR : sealR - 8;
    const a = (i * Math.PI) / numPoints;
    const px = rightCenterX + Math.cos(a) * r;
    const py = sealY + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();

  const sealGrad = ctx.createRadialGradient(rightCenterX - 15, sealY - 15, 10, rightCenterX, sealY, sealR);
  sealGrad.addColorStop(0, '#fef08a');
  sealGrad.addColorStop(0.35, '#fbbf24');
  sealGrad.addColorStop(0.8, '#d97706');
  sealGrad.addColorStop(1, '#78350f');
  ctx.fillStyle = sealGrad;
  ctx.fill();
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 씰 내부 원
  ctx.beginPath();
  ctx.arc(rightCenterX, sealY, sealR - 14, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 씰 텍스트
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 11px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('★ OFFICIAL ★', rightCenterX, sealY - 24);
  ctx.font = '900 13px -apple-system, sans-serif';
  ctx.fillText('TENNIS', rightCenterX, sealY - 8);
  ctx.font = '900 12px -apple-system, sans-serif';
  ctx.fillText('VOUCHER', rightCenterX, sealY + 8);
  ctx.font = '800 10px -apple-system, sans-serif';
  ctx.fillStyle = p.gold1;
  ctx.fillText('AUTHENTIC', rightCenterX, sealY + 24);

  // 씰 아래 리본 꼬리 2개
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.moveTo(rightCenterX - 24, sealY + sealR - 4);
  ctx.lineTo(rightCenterX - 36, sealY + sealR + 32);
  ctx.lineTo(rightCenterX - 20, sealY + sealR + 24);
  ctx.lineTo(rightCenterX - 8, sealY + sealR + 32);
  ctx.lineTo(rightCenterX - 12, sealY + sealR - 4);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(rightCenterX + 12, sealY + sealR - 4);
  ctx.lineTo(rightCenterX + 8, sealY + sealR + 32);
  ctx.lineTo(rightCenterX + 20, sealY + sealR + 24);
  ctx.lineTo(rightCenterX + 36, sealY + sealR + 32);
  ctx.lineTo(rightCenterX + 24, sealY + sealR - 4);
  ctx.fill();
  ctx.restore();

  // B. 한국 전통 붉은 직인 (Red Stamp Seal)
  const stampX = rightCenterX - 35;
  const stampY = 360;
  const stampSize = 70;

  ctx.save();
  ctx.translate(stampX + stampSize / 2, stampY + stampSize / 2);
  ctx.rotate((-3 * Math.PI) / 180);

  // 직인 외곽 테두리 (Vermilion Red)
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 3.5;
  ctx.fillStyle = 'rgba(220, 38, 38, 0.16)';
  roundRect(ctx, -stampSize / 2, -stampSize / 2, stampSize, stampSize, 10);
  ctx.fill();
  ctx.stroke();

  // 내부 얇은 테두리
  ctx.lineWidth = 1;
  roundRect(ctx, -stampSize / 2 + 4, -stampSize / 2 + 4, stampSize - 8, stampSize - 8, 7);
  ctx.stroke();

  // 직인 문자: 2x2 배치
  ctx.fillStyle = '#dc2626';
  ctx.font = '900 19px "Batang", "Gungsuh", "Noto Serif KR", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const rawStamp = (data.issuer || clubName).replace(/[^가-힣a-zA-Z]/g, '');
  const c1 = rawStamp[0] || '테';
  const c2 = rawStamp[1] || '친';
  const c3 = rawStamp[2] || '회';
  const c4 = '인';

  ctx.fillText(c1, -15, -14);
  ctx.fillText(c2, -15, 16);
  ctx.fillText(c3, 15, -14);
  ctx.fillText(c4, 15, 16);
  ctx.restore();

  // C. 바코드 및 시리얼 번호
  const barcodeX = rightCenterX - 110;
  const barcodeY = 478;
  const barcodeW = 220;
  const barcodeH = 50;

  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.90)';
  const barPattern = [
    2, 1, 3, 1, 1, 2, 4, 1, 2, 3, 1, 1, 3, 2, 1, 4, 1, 2, 1, 3,
    2, 1, 1, 4, 2, 1, 3, 1, 2, 1, 4, 1, 2, 3, 1, 1, 2, 4, 1, 2,
    3, 1, 2, 1, 4, 2, 1, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 1, 4, 2
  ];
  let curBx = barcodeX;
  for (let i = 0; i < barPattern.length && curBx < barcodeX + barcodeW; i++) {
    const barW = barPattern[i] * 1.5;
    if (i % 2 === 0) {
      ctx.fillRect(curBx, barcodeY, barW, barcodeH);
    }
    curBx += barW + 1.2;
  }

  const serialNo = data.serialNumber || 'NO. 2026-TNS-0824';
  ctx.fillStyle = p.gold1;
  ctx.font = '800 13px -apple-system, "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(serialNo, rightCenterX, barcodeY + barcodeH + 20);
  ctx.restore();
}

/**
 * 메인 렌더링 함수
 * @param {HTMLCanvasElement} canvas
 * @param {string} type - 'member' | 'guest' | 'court' | 'fee' | 'voucher'
 * @param {object} data - 폼 데이터
 * @param {object} options - { bgType: 'hard'|'grass'|'clay'|'custom', aspectRatio: '1:1'|'4:5'|'9:16'|'banknote', customImage: HTMLImageElement }
 */
export function renderCardToCanvas(canvas, type, data, options = {}) {
  const { bgType = 'hard', aspectRatio = '1:1', customImage = null, clubName = '테친회' } = options;

  let width = 1080;
  let height = 1080;
  if (type === 'voucher' || aspectRatio === 'banknote') {
    // 만원 지폐 실제 규격 (148mm x 68mm) 10x 고해상도 캔버스
    width = 1480;
    height = 680;
  } else if (aspectRatio === '4:5') {
    height = 1350;
  } else if (aspectRatio === '9:16') {
    height = 1920;
  }

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 테니스 상품권 전용 분기
  if (type === 'voucher') {
    drawTennisVoucher(ctx, width, height, data, { ...options, clubName, customImage });
    return;
  }

  // 1. 코트 배경 렌더링
  drawCourtBackground(ctx, width, height, bgType, customImage);

  // 2. 전체 스케일 및 여백 계산
  const scale = width / 1080;
  const padX = 56 * scale;
  let curY = 42 * scale;

  // 3. 상단 헤더 엠블럼 & 카테고리 태그
  const modeInfo = {
    member: { tag: 'MEMBERSHIP RECRUIT', titleDefault: '2026 신규 회원 모집', icon: '🎾', theme: '#38bdf8' },
    guest: { tag: 'GUEST RECRUIT', titleDefault: '테니스 게스트 모집', icon: '⚡', theme: '#34d399' },
    court: { tag: 'COURT TRANSFER', titleDefault: '테니스 코트 양도', icon: '🎟️', theme: '#f59e0b' },
    fee: { tag: 'MEMBERSHIP DUES', titleDefault: '정기 회비 납부 안내', icon: '💰', theme: '#fbbf24' }
  }[type] || { tag: 'TENNIS MATCH', titleDefault: '테니스 공지', icon: '🎾', theme: '#38bdf8' };

  // 상단 클럽 배지 캡슐 (중앙 정렬)
  const badgeW = 440 * scale;
  const badgeH = 54 * scale;
  const badgeX = (width - badgeW) / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  roundRect(ctx, badgeX, curY, badgeW, badgeH, 27 * scale);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.30)';
  ctx.lineWidth = 1.8 * scale;
  ctx.stroke();

  ctx.fillStyle = modeInfo.theme;
  ctx.font = `bold ${22 * scale}px -apple-system, BlinkMacSystemFont, "Pretendard", "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(`${modeInfo.icon} ${clubName} • ${modeInfo.tag}`, width / 2, curY + 35 * scale);
  ctx.restore();

  curY += badgeH + 18 * scale;

  // 4. 메인 타이틀 (Hero Title) - 중간 정렬 & 글자 크기 +20% (62px)
  const mainTitle = data.title?.trim() || modeInfo.titleDefault;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${62 * scale}px -apple-system, BlinkMacSystemFont, "Pretendard", "Noto Sans KR", sans-serif`;
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 18 * scale;
  ctx.shadowOffsetY = 4 * scale;
  curY = drawWrappedText(ctx, mainTitle, width / 2, curY + 52 * scale, width - padX * 2, 74 * scale, 2);
  ctx.restore();

  curY += 16 * scale;

  // 5. 핵심 정보 그리드 카드 렌더링
  const contentW = width - padX * 2;

  // 정보 박스 그리기 도우미 함수 (글자 크기 +20% & 박스 높이 확대)
  const drawInfoItem = (icon, label, value, subValue = null, highlightColor = null) => {
    if (!value) return 0;
    const itemH = (subValue ? 116 : 96) * scale;

    ctx.save();
    // 글래스 배경
    ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
    roundRect(ctx, padX, curY, contentW, itemH, 18 * scale);
    ctx.fill();
    ctx.strokeStyle = highlightColor ? highlightColor : 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = (highlightColor ? 2.5 : 1.2) * scale;
    ctx.stroke();

    // 아이콘 원형 배지
    const badgeSize = 60 * scale;
    const badgeX = padX + 18 * scale;
    const badgeY = curY + (itemH - badgeSize) / 2;
    ctx.fillStyle = highlightColor ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.14)';
    roundRect(ctx, badgeX, badgeY, badgeSize, badgeSize, 16 * scale);
    ctx.fill();

    ctx.font = `${32 * scale}px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, badgeX + badgeSize / 2, badgeY + badgeSize / 2 + 1);

    // 라벨 (17px -> 20px로 확대)
    const textX = badgeX + badgeSize + 20 * scale;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.70)';
    ctx.font = `600 ${20 * scale}px -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif`;
    ctx.fillText(label, textX, curY + (subValue ? 34 : 36) * scale);

    // 값 (24/26px -> 28/31px로 확대)
    ctx.fillStyle = highlightColor || '#ffffff';
    ctx.font = `800 ${subValue ? 28 * scale : 31 * scale}px -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif`;
    ctx.fillText(value, textX, curY + (subValue ? 70 : 73) * scale);

    if (subValue) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
      ctx.font = `500 ${19 * scale}px -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif`;
      ctx.fillText(subValue, textX, curY + 100 * scale);
    }

    ctx.restore();
    curY += itemH + 10 * scale;
    return itemH + 10 * scale;
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
  } else if (type === 'fee') {
    // 4. 동호회 회비 납부 안내
    drawInfoItem('📅', '납부 대상 및 기간', data.period || '2026년 정기 회비');
    drawInfoItem('💵', '회비 납부 금액', data.feeAmount || '월 30,000원', data.target ? `납부 대상: ${data.target}` : null, '#fbbf24');
    
    // 입금 계좌 및 예금주 (듀얼 라인 강조)
    const bankText = data.bankAccount || '입금 계좌 미등록';
    const holderText = data.accountHolder ? `예금주: ${data.accountHolder}` : null;
    drawInfoItem('🏦', '입금 계좌 정보', bankText, holderText, '#38bdf8');

    drawInfoItem('⏰', '납부 마감 기한', data.dueDate || '기한 내 납부 협조 부탁드립니다', null, '#f87171');

    if (data.unpaidList && data.unpaidList.trim()) {
      drawInfoItem('📋', '미납 안내 / 납부 대상', data.unpaidList.trim(), null, '#facc15');
    }
  }

  // 6. 비고 및 추가 안내 박스 (입력된 경우)
  if (data.notes && data.notes.trim()) {
    const noteH = 88 * scale;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    roundRect(ctx, padX, curY, contentW, noteH, 16 * scale);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1 * scale;
    ctx.stroke();

    ctx.fillStyle = '#f1f5f9';
    ctx.font = `700 ${20 * scale}px -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('💡 안내 / 비고:', padX + 20 * scale, curY + 34 * scale);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.font = `500 ${19 * scale}px -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif`;
    drawWrappedText(ctx, data.notes.trim(), padX + 20 * scale, curY + 64 * scale, contentW - 40 * scale, 26 * scale, 1);
    ctx.restore();
    curY += noteH + 14 * scale;
  } else {
    curY += 8 * scale;
  }

  // 7. 하단 연락처 & 카톡ID 문의 바
  const contactH = 120 * scale;
  const contactY = height - 44 * scale - contactH;

  ctx.save();
  // 하단 프리미엄 컨택트 카드
  const contactGrad = ctx.createLinearGradient(padX, contactY, padX + contentW, contactY);
  contactGrad.addColorStop(0, 'rgba(30, 41, 59, 0.97)');
  contactGrad.addColorStop(1, 'rgba(15, 23, 42, 0.97)');
  ctx.fillStyle = contactGrad;
  roundRect(ctx, padX, contactY, contentW, contactH, 20 * scale);
  ctx.fill();
  ctx.strokeStyle = modeInfo.theme;
  ctx.lineWidth = 2.8 * scale;
  ctx.stroke();

  // 상단 레이블 (16px -> 19px)
  ctx.fillStyle = modeInfo.theme;
  ctx.font = `bold ${19 * scale}px -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif`;
  ctx.textAlign = 'left';
  const contactLabel = type === 'fee' ? '💳 입금 확인 및 회비 문의' : '💬 신청 및 문의하기';
  ctx.fillText(contactLabel, padX + 24 * scale, contactY + 38 * scale);

  // 연락처와 카톡 ID 한 줄 또는 두 열로 표시 (24px -> 29px)
  const phone = data.contact?.trim() || '운영진 문의';
  const kakao = data.kakaoId?.trim() || '';

  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${29 * scale}px -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif`;
  let contactText = `📞 ${phone}`;
  if (kakao) {
    contactText += `   |   💬 카톡: ${kakao}`;
  }
  ctx.fillText(contactText, padX + 24 * scale, contactY + 84 * scale);

  // 우측 바로가기 배지 (16px -> 19px)
  ctx.fillStyle = modeInfo.theme;
  ctx.textAlign = 'right';
  ctx.font = `bold ${19 * scale}px -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif`;
  const rightTag = type === 'fee' ? '기한 내 입금 협조 →' : '빠른 문의 환영 →';
  ctx.fillText(rightTag, padX + contentW - 24 * scale, contactY + 62 * scale);

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

  if (type === 'fee') {
    let t = `💰 [${clubName}] ${data.title || '정기 회비 납부 안내'} 💰\n\n`;
    t += `회원 여러분 안녕하세요! 원활하고 즐거운 클럽 운영을 위해 ${data.period || '정기'} 회비 납부를 안내드립니다.\n\n`;
    t += `📌 납부 기간: ${data.period || '정기 회비'}\n`;
    t += `💵 납부 금액: ${data.feeAmount || '금액 미지정'}${data.target ? ` (대상: ${data.target})` : ''}\n`;
    t += `🏦 입금 계좌: ${data.bankAccount || '계좌 미등록'}\n`;
    if (data.accountHolder) t += `👤 예 금 주: ${data.accountHolder}\n`;
    t += `⏰ 납부 기한: ${data.dueDate || '기한 내 입금'}\n`;
    if (data.unpaidList && data.unpaidList.trim()) {
      t += `\n📋 미납 회원 명단: ${data.unpaidList}\n`;
    }
    if (data.notes) t += `\n💡 안내사항: ${data.notes}\n`;
    if (data.contact) t += `\n📞 문의처: ${data.contact}\n`;
    if (data.kakaoId) t += `💬 카톡ID: ${data.kakaoId}\n`;
    t += `\n코트 예약과 정기 모임의 원활한 운영을 위해 기한 내 입금 부탁드립니다. 감사합니다! 🎾`;
    return t;
  }

  if (type === 'voucher') {
    const rawAmount = String(data.amount || '50,000').replace(/[^0-9]/g, '');
    const numVal = parseInt(rawAmount, 10);
    const formattedAmount = isNaN(numVal) ? (data.amount || '50,000') : numVal.toLocaleString('ko-KR');
    const koreanAmt = data.amountText || (isNaN(numVal) ? '금 오만 원 정' : numberToKoreanAmount(numVal));

    let t = `🎟️ [${data.clubName || clubName}] ${data.title || '테니스 구매 상품권'} 🎟️\n\n`;
    t += `🎾 권면 금액: ₩ ${formattedAmount} ${data.amountUnit || '원'} [ ${koreanAmt} ]\n`;
    t += `🛍️ 사용 품목: ${data.targetItems || '테니스 라켓, 스트링 교체, 테니스화, 테니스공 및 용품 일체'}\n`;
    t += `📅 유효 기간: ${data.validity || '발행일로부터 1년'}\n`;
    t += `🏢 발 행 처: ${data.issuer || data.clubName || clubName}\n`;
    t += `🔢 일련 번호: ${data.serialNumber || 'NO. 2026-TNS-0824'}\n`;
    if (data.notes) t += `\n💡 안내 사항: ${data.notes}\n`;
    t += `\n축하드립니다! 즐겁고 건강한 테니스 라이프를 응원합니다! 🎾✨`;
    return t;
  }

  return '';
}
