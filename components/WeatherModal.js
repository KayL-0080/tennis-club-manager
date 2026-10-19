'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';

// 대한민국 주요 지역 좌표 사전 (위도, 경도)
export const KOREA_REGIONS = [
  { key: 'seoul', name: '서울특별시', shortName: '서울', lat: 37.5665, lon: 126.9780, keywords: ['서울', '강남', '서초', '송파', '강동', '양재', '올림픽', '장충', '목동', '여의도', '마포', '용산', '성동', '광진', '노원', '도봉', '강북', '성북', '중랑', '동대문', '종로', '중구', '은평', '서대문', '강서', '양천', '구로', '금천', '영등포', '동작', '관악', '고척', '잠실', '뚝섬', '반포', '난지', '응봉', '마곡', '보라매'] },
  { key: 'gyeonggi_south', name: '경기 남부 (성남·수원·용인·안양)', shortName: '경기남부', lat: 37.3219, lon: 127.0700, keywords: ['수원', '성남', '분당', '판교', '용인', '수지', '기흥', '안양', '평촌', '과천', '의왕', '군포', '산본', '화성', '동탄', '오산', '평택', '안성', '이천', '여주', '광명', '시흥', '안산', '광주', '하남', '미사', '탄천', '만석'] },
  { key: 'gyeonggi_north', name: '경기 북부 (고양·파주·의정부·남양주)', shortName: '경기북부', lat: 37.6584, lon: 126.8320, keywords: ['고양', '일산', '덕양', '파주', '운정', '김포', '부천', '의정부', '양주', '동두천', '포천', '연천', '남양주', '다산', '별내', '구리', '가평', '양평', '대화'] },
  { key: 'incheon', name: '인천광역시', shortName: '인천', lat: 37.4563, lon: 126.7052, keywords: ['인천', '송도', '청라', '부평', '구월', '연수', '계양', '영종', '열우물', '가좌'] },
  { key: 'busan', name: '부산광역시', shortName: '부산', lat: 35.1796, lon: 129.0756, keywords: ['부산', '해운대', '센텀', '광안리', '서면', '동래', '사직', '기장', '강서', '사하', '금정', '남구', '수영', '연제', '스포원', '삼락', '화명', '다대포'] },
  { key: 'daegu', name: '대구광역시', shortName: '대구', lat: 35.8714, lon: 128.6014, keywords: ['대구', '수성', '달서', '동구', '북구', '달성', '두류', '유니버시아드'] },
  { key: 'daejeon', name: '대전광역시', shortName: '대전', lat: 36.3504, lon: 127.3845, keywords: ['대전', '유성', '둔산', '서구', '대덕', '충남대', '관저', '한밭'] },
  { key: 'gwangju', name: '광주광역시', shortName: '광주', lat: 35.1595, lon: 126.8526, keywords: ['광주광역시', '상무', '첨단', '수완', '진월', '염주'] },
  { key: 'ulsan', name: '울산광역시', shortName: '울산', lat: 35.5384, lon: 129.3114, keywords: ['울산', '문수', '태화강', '울주', '남구', '동구'] },
  { key: 'sejong', name: '세종특별자치시', shortName: '세종', lat: 36.4800, lon: 127.2890, keywords: ['세종', '조치원', '보람', '다정', '어진'] },
  { key: 'gangwon', name: '강원도 (춘천·원주·강릉)', shortName: '강원', lat: 37.8813, lon: 127.7298, keywords: ['강원', '춘천', '원주', '강릉', '속초', '동해', '삼척', '태백', '홍천', '횡성', '평창'] },
  { key: 'chungbuk', name: '충청북도 (청주·충주)', shortName: '충북', lat: 36.6424, lon: 127.4890, keywords: ['충북', '청주', '오창', '오송', '충주', '제천', '진천', '음성'] },
  { key: 'chungnam', name: '충청남도 (천안·아산·당진)', shortName: '충남', lat: 36.8151, lon: 127.1139, keywords: ['충남', '천안', '아산', '배방', '탕정', '당진', '서산', '논산', '공주', '보령', '홍성', '내포'] },
  { key: 'jeonbuk', name: '전라북도 (전주·익산·군산)', shortName: '전북', lat: 35.8242, lon: 127.1480, keywords: ['전북', '전주', '완산', '덕진', '익산', '군산', '정읍', '남원', '김제', '완주'] },
  { key: 'jeonnam', name: '전라남도 (여수·순천·목포)', shortName: '전남', lat: 34.9506, lon: 127.4872, keywords: ['전남', '여수', '순천', '광양', '목포', '나주', '무안', '해남'] },
  { key: 'gyeongbuk', name: '경상북도 (포항·구미·경주·안동)', shortName: '경북', lat: 36.0190, lon: 129.3435, keywords: ['경북', '포항', '구미', '경주', '경산', '안동', '김천', '영주', '영천', '상주', '문경'] },
  { key: 'gyeongnam', name: '경상남도 (창원·김해·진주·양산)', shortName: '경남', lat: 35.2280, lon: 128.6811, keywords: ['경남', '창원', '마산', '진해', '김해', '진주', '양산', '거제', '통영', '사천', '밀양'] },
  { key: 'jeju', name: '제주특별자치도', shortName: '제주', lat: 33.4996, lon: 126.5312, keywords: ['제주', '서귀포', '애월', '조천', '성산', '한림'] },
];

// 장소명(location)과 선호 지역키(preferredRegionKey)를 바탕으로 최적 좌표 반환
export function resolveRegionForLocation(locationText = '', preferredRegionKey = 'seoul') {
  if (locationText) {
    const clean = locationText.trim();
    for (const region of KOREA_REGIONS) {
      if (region.keywords.some(kw => clean.includes(kw))) {
        return region;
      }
    }
  }
  return KOREA_REGIONS.find(r => r.key === preferredRegionKey) || KOREA_REGIONS[0];
}

// WMO 날씨 코드 -> 날씨 유형 및 색상/라벨 매핑
export function getWeatherMeta(wmoCode, isNight = false) {
  const code = Number(wmoCode);
  if (code === 0) {
    return {
      type: isNight ? 'clear_night' : 'clear',
      category: '맑음',
      label: '맑음',
      desc: isNight ? '구름 없이 맑은 밤하늘' : '구름 없이 쾌청하고 맑음',
      bg: '#fffbeb',
      border: '#fde68a',
      text: '#b45309',
      badgeBg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
      accent: '#f59e0b',
      severity: 0,
    };
  }
  if (code === 1) {
    return {
      type: isNight ? 'mostly_clear_night' : 'mostly_clear',
      category: '맑음',
      label: '대체로 맑음',
      desc: '구름이 조금 있으나 대체로 맑음',
      bg: '#f0f9ff',
      border: '#bae6fd',
      text: '#0369a1',
      badgeBg: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
      accent: '#0284c7',
      severity: 1,
    };
  }
  if (code === 2) {
    return {
      type: isNight ? 'partly_cloudy_night' : 'partly_cloudy',
      category: '구름조금',
      label: '구름조금',
      desc: '구름이 다소 끼어 있는 날씨',
      bg: '#f0f9ff',
      border: '#bae6fd',
      text: '#0284c7',
      badgeBg: 'linear-gradient(135deg, #e0f2fe 0%, #dbeafe 100%)',
      accent: '#0284c7',
      severity: 2,
    };
  }
  if (code === 3) {
    return {
      type: 'cloudy',
      category: '흐림',
      label: '흐림',
      desc: '하늘 전체에 구름이 많은 흐린 날씨',
      bg: '#f1f5f9',
      border: '#cbd5e1',
      text: '#334155',
      badgeBg: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
      accent: '#64748b',
      severity: 3,
    };
  }
  if (code === 45 || code === 48) {
    return {
      type: 'fog',
      category: '흐림',
      label: '안개/박무',
      desc: '안개가 끼어 시야가 흐릴 수 있음',
      bg: '#f1f5f9',
      border: '#cbd5e1',
      text: '#475569',
      badgeBg: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
      accent: '#64748b',
      severity: 4,
    };
  }
  if (code >= 51 && code <= 57) {
    return {
      type: 'drizzle',
      category: '비',
      label: '이슬비/약한비',
      desc: '약한 이슬비가 내릴 가능성 있음',
      bg: '#eff6ff',
      border: '#93c5fd',
      text: '#1d4ed8',
      badgeBg: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
      accent: '#2563eb',
      severity: 6,
    };
  }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    const isHeavy = code === 65 || code === 82;
    const isShower = code >= 80 && code <= 82;
    return {
      type: isHeavy ? 'heavy_rain' : 'rain',
      category: '비',
      label: isShower ? '소나기' : isHeavy ? '강한 비' : '비',
      desc: isShower ? '돌발적인 소나기 예보' : '우천 예보로 코트 상태 확인 필요',
      bg: '#eff6ff',
      border: '#60a5fa',
      text: '#1e40af',
      badgeBg: 'linear-gradient(135deg, #dbeafe 0%, #93c5fd 100%)',
      accent: '#2563eb',
      severity: isHeavy ? 8 : 7,
    };
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return {
      type: 'snow',
      category: '눈',
      label: '눈',
      desc: '눈 예보로 코트 결빙 및 미끄럼 주의',
      bg: '#f0f9ff',
      border: '#7dd3fc',
      text: '#0369a1',
      badgeBg: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
      accent: '#0284c7',
      severity: 8,
    };
  }
  if (code >= 95) {
    return {
      type: 'thunderstorm',
      category: '비',
      label: '뇌우/번개',
      desc: '천둥·번개를 동반한 강한 비 주의',
      bg: '#faf5ff',
      border: '#c084fc',
      text: '#6b21a8',
      badgeBg: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)',
      accent: '#9333ea',
      severity: 9,
    };
  }
  return {
    type: 'partly_cloudy',
    category: '구름조금',
    label: '구름조금',
    desc: '무난한 날씨',
    bg: '#f8fafc',
    border: '#e2e8f0',
    text: '#475569',
    badgeBg: '#f1f5f9',
    accent: '#64748b',
    severity: 2,
  };
}

// 세련된 벡터 SVG 날씨 아이콘 컴포넌트 (맑음, 구름조금, 흐림, 비, 눈, 뇌우 완벽 구분)
export function WeatherSvgIcon({ type = 'clear', size = 22, style = {} }) {
  const s = size;
  switch (type) {
    case 'clear':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0, ...style }}>
          <circle cx="16" cy="16" r="7.5" fill="url(#sunGrad)" />
          <g stroke="#f59e0b" strokeWidth="2.3" strokeLinecap="round">
            <line x1="16" y1="3" x2="16" y2="5.5" />
            <line x1="16" y1="26.5" x2="16" y2="29" />
            <line x1="3" y1="16" x2="5.5" y2="16" />
            <line x1="26.5" y1="16" x2="29" y2="16" />
            <line x1="6.8" y1="6.8" x2="8.6" y2="8.6" />
            <line x1="23.4" y1="23.4" x2="25.2" y2="25.2" />
            <line x1="25.2" y1="6.8" x2="23.4" y2="8.6" />
            <line x1="8.6" y1="23.4" x2="6.8" y2="25.2" />
          </g>
          <defs>
            <linearGradient id="sunGrad" x1="10" y1="10" x2="22" y2="22" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fbbf24" />
              <stop offset="1" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
        </svg>
      );

    case 'clear_night':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0, ...style }}>
          <path
            d="M21.5 19.8A9 9 0 0 1 12.2 10.5a9.1 9.1 0 0 1 .7-3.5A9 9 0 1 0 24.9 19.1a9.1 9.1 0 0 1-3.4.7Z"
            fill="url(#moonGrad)"
            stroke="#f59e0b"
            strokeWidth="1.2"
          />
          <circle cx="24" cy="8" r="1.3" fill="#fbbf24" />
          <circle cx="26.5" cy="12.5" r="1" fill="#fcd34d" />
          <defs>
            <linearGradient id="moonGrad" x1="8" y1="7" x2="24" y2="25" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fde68a" />
              <stop offset="1" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
        </svg>
      );

    case 'mostly_clear':
    case 'partly_cloudy':
    case 'mostly_clear_night':
    case 'partly_cloudy_night':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0, ...style }}>
          {/* Sun behind cloud */}
          <circle cx="12" cy="12" r="5.5" fill="#fbbf24" />
          <g stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round">
            <line x1="12" y1="3.5" x2="12" y2="5" />
            <line x1="3.5" y1="12" x2="5" y2="12" />
            <line x1="6" y1="6" x2="7.2" y2="7.2" />
            <line x1="18" y1="6" x2="16.8" y2="7.2" />
          </g>
          {/* Cloud foreground */}
          <path
            d="M11 25h11.5a5.5 5.5 0 0 0 .6-10.97A7 7 0 0 0 9.6 12.3 4.8 4.8 0 0 0 11 25Z"
            fill="url(#partlyCloudGrad)"
            stroke="#93c5fd"
            strokeWidth="1.2"
          />
          <defs>
            <linearGradient id="partlyCloudGrad" x1="8" y1="11" x2="24" y2="25" gradientUnits="userSpaceOnUse">
              <stop stopColor="#ffffff" />
              <stop offset="1" stopColor="#dbeafe" />
            </linearGradient>
          </defs>
        </svg>
      );

    case 'cloudy':
    case 'fog':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0, ...style }}>
          {/* Back cloud */}
          <path
            d="M13 20h11a4.5 4.5 0 0 0 .5-8.97A5.8 5.8 0 0 0 13.4 9.5 4 4 0 0 0 13 20Z"
            fill="#cbd5e1"
          />
          {/* Front cloud */}
          <path
            d="M8.5 24.5h13a5.5 5.5 0 0 0 .6-10.97 7 7 0 0 0-13.5-1.73A4.8 4.8 0 0 0 8.5 24.5Z"
            fill="url(#cloudyGrad)"
            stroke="#94a3b8"
            strokeWidth="1.2"
          />
          <defs>
            <linearGradient id="cloudyGrad" x1="6" y1="11" x2="24" y2="25" gradientUnits="userSpaceOnUse">
              <stop stopColor="#f8fafc" />
              <stop offset="1" stopColor="#cbd5e1" />
            </linearGradient>
          </defs>
        </svg>
      );

    case 'drizzle':
    case 'rain':
    case 'heavy_rain':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0, ...style }}>
          <path
            d="M8.5 21h13.5a5 5 0 0 0 .5-9.97 6.5 6.5 0 0 0-12.6-1.6A4.5 4.5 0 0 0 8.5 21Z"
            fill="url(#rainCloudGrad)"
            stroke="#60a5fa"
            strokeWidth="1.2"
          />
          <g stroke="#2563eb" strokeWidth="2" strokeLinecap="round">
            <line x1="11" y1="23.5" x2="9.5" y2="28" />
            <line x1="16" y1="23.5" x2="14.5" y2="28" />
            <line x1="21" y1="23.5" x2="19.5" y2="28" />
          </g>
          <defs>
            <linearGradient id="rainCloudGrad" x1="6" y1="8" x2="24" y2="21" gradientUnits="userSpaceOnUse">
              <stop stopColor="#dbeafe" />
              <stop offset="1" stopColor="#93c5fd" />
            </linearGradient>
          </defs>
        </svg>
      );

    case 'snow':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0, ...style }}>
          <path
            d="M8.5 21h13.5a5 5 0 0 0 .5-9.97 6.5 6.5 0 0 0-12.6-1.6A4.5 4.5 0 0 0 8.5 21Z"
            fill="#e0f2fe"
            stroke="#7dd3fc"
            strokeWidth="1.2"
          />
          <circle cx="11" cy="25.5" r="1.6" fill="#0284c7" />
          <circle cx="16" cy="27" r="1.6" fill="#0284c7" />
          <circle cx="21" cy="25.5" r="1.6" fill="#0284c7" />
        </svg>
      );

    case 'thunderstorm':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0, ...style }}>
          <path
            d="M8.5 20.5h13.5a5 5 0 0 0 .5-9.97 6.5 6.5 0 0 0-12.6-1.6A4.5 4.5 0 0 0 8.5 20.5Z"
            fill="#e9d5ff"
            stroke="#a855f7"
            strokeWidth="1.2"
          />
          <path
            d="M16.5 19.5L13 25h3l-1 5.5 5-6.5h-3.2l.7-4.5Z"
            fill="#f59e0b"
            stroke="#d97706"
            strokeWidth="0.8"
            strokeLinejoin="round"
          />
        </svg>
      );

    default:
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0, ...style }}>
          <circle cx="16" cy="16" r="8" fill="#fbbf24" />
        </svg>
      );
  }
}

// 시간 문자열("18:00") -> 시간 정수(18) 변환
function parseHour(timeStr, fallback = 18) {
  if (!timeStr || typeof timeStr !== 'string') return fallback;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10);
  if (isNaN(h)) return fallback;
  return Math.max(0, Math.min(23, h));
}

// 특정 일정(date, startTime, endTime)에 대한 날씨 요약 및 시간대별 리스트 추출
export function extractEventWeather(weatherByDate, event) {
  if (!event || !event.date) return null;
  const dayData = weatherByDate?.[event.date];
  if (!dayData || !dayData.hours || dayData.hours.length === 0) {
    return {
      available: false,
      date: event.date,
    };
  }

  const startHour = parseHour(event.startTime, 18);
  let endHour = parseHour(event.endTime, 20);
  if (event.endTime === '24:00' || event.endTime === '00:00' || endHour < startHour) {
    endHour = 23;
  }

  // 모임 시간에 해당하는 시간대 필터링
  const meetingHours = dayData.hours.filter(h => h.hour >= startHour && h.hour <= endHour);
  const targetHours = meetingHours.length > 0 ? meetingHours : dayData.hours;

  // 모임 시간대 기온, 강수확률, 강수량, 풍속, 습도 집계
  const temps = targetHours.map(h => h.temp);
  const avgTemp = Math.round(temps.reduce((a, b) => a + b, 0) / temps.length);
  const minMeetingTemp = Math.round(Math.min(...temps));
  const maxMeetingTemp = Math.round(Math.max(...temps));

  const apparents = targetHours.map(h => h.apparentTemp ?? h.temp);
  const avgApparent = Math.round(apparents.reduce((a, b) => a + b, 0) / apparents.length);

  const maxPop = Math.max(...targetHours.map(h => h.pop || 0));
  const totalPrecip = Number(targetHours.reduce((sum, h) => sum + (h.precipitation || 0), 0).toFixed(1));
  const maxWind = Number(Math.max(...targetHours.map(h => h.windSpeed || 0)).toFixed(1));
  const avgHumidity = Math.round(targetHours.reduce((sum, h) => sum + (h.humidity || 50), 0) / targetHours.length);

  // 모임 시간대의 대표 날씨 선정:
  // 비/눈/뇌우가 있는 시간대가 있거나 강수확률이 60% 이상이면 해당 악천후 코드를 우선 표시하여 우천 대비 지원
  let repHour = targetHours[Math.floor(targetHours.length / 2)] || targetHours[0];
  let highestSeverity = -1;
  for (const h of targetHours) {
    const meta = getWeatherMeta(h.weatherCode, h.hour >= 19 || h.hour < 6);
    if (meta.severity >= 6 && (h.pop >= 40 || h.precipitation > 0)) {
      if (meta.severity > highestSeverity) {
        highestSeverity = meta.severity;
        repHour = h;
      }
    }
  }
  if (highestSeverity === -1) {
    // 비/눈이 아니면 모임 중간 시간대(또는 가장 흔한 날씨 코드) 사용
    repHour = targetHours[Math.floor(targetHours.length / 2)] || targetHours[0];
  }

  const isNight = startHour >= 19 || startHour < 6;
  const meta = getWeatherMeta(repHour.weatherCode, isNight);

  // 테니스 경기 적합도 판정
  let tennisStatus = {
    badge: '🎾 테니스 최적',
    color: '#15803d',
    bg: '#dcfce7',
    border: '#86efac',
    comment: '비가 올 확률이 낮고 바람이 잔잔하여 테니스 경기하기 아주 좋은 날씨입니다.'
  };

  if (meta.category === '비' || meta.category === '눈' || maxPop >= 60 || totalPrecip >= 1.0) {
    tennisStatus = {
      badge: '☔ 우천/강수 주의',
      color: '#b91c1c',
      bg: '#fee2e2',
      border: '#fca5a5',
      comment: `모임 시간대(${event.startTime}~${event.endTime}) 강수확률이 ${maxPop}%로 예보되어 있습니다. 코트 배수 상태 및 우천 여부를 확인하세요.`
    };
  } else if (maxPop >= 35 || maxWind >= 6.5) {
    tennisStatus = {
      badge: maxWind >= 6.5 ? '💨 강풍 주의' : '🌤️ 우산 준비 권장',
      color: '#b45309',
      bg: '#fef3c7',
      border: '#fde68a',
      comment: maxWind >= 6.5
        ? `모임 시간대 최대 풍속이 ${maxWind}m/s로 바람이 다소 강할 수 있습니다. 로브 및 서브 토스에 유의하세요.`
        : `구름이 많고 강수확률(${maxPop}%)이 다소 있으니 일기예보 변동을 참고하세요.`
    };
  } else if (meta.category === '흐림' || meta.category === '구름조금') {
    tennisStatus = {
      badge: '🎾 경기 양호',
      color: '#0369a1',
      bg: '#e0f2fe',
      border: '#7dd3fc',
      comment: '햇빛 눈부심이 적고 구름이 적당히 끼어 있어 쾌적하게 테니스를 즐길 수 있습니다.'
    };
  }

  return {
    available: true,
    date: event.date,
    startHour,
    endHour,
    avgTemp,
    minMeetingTemp,
    maxMeetingTemp,
    avgApparent,
    maxPop,
    totalPrecip,
    maxWind,
    avgHumidity,
    dailyMin: dayData.dailyMin,
    dailyMax: dayData.dailyMax,
    meta,
    tennisStatus,
    hours: dayData.hours.map(h => ({
      ...h,
      isMeetingHour: h.hour >= startHour && h.hour <= endHour,
      meta: getWeatherMeta(h.weatherCode, h.hour >= 19 || h.hour < 6),
    })),
  };
}

// Open-Meteo API 호출 및 캐시 훅
const memoryWeatherCache = {};

export function useWeatherForecast(defaultRegionKey = 'seoul') {
  const [regionKey, setRegionKey] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tcm_weather_region') || defaultRegionKey;
    }
    return defaultRegionKey;
  });
  const [weatherMap, setWeatherMap] = useState({}); // { [regionKey]: { [dateStr]: { dailyMin, dailyMax, hours: [...] } } }
  const [loadingWeather, setLoadingWeather] = useState(false);

  const changeRegion = useCallback((newKey) => {
    setRegionKey(newKey);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('tcm_weather_region', newKey);
      } catch (e) {}
    }
  }, []);

  const fetchRegionWeather = useCallback(async (rKey) => {
    const targetRegion = KOREA_REGIONS.find(r => r.key === rKey) || KOREA_REGIONS[0];
    const cacheKey = `${targetRegion.key}_${new Date().toISOString().slice(0, 13)}`; // 1시간 단위 캐시 키

    if (memoryWeatherCache[cacheKey]) {
      setWeatherMap(prev => ({ ...prev, [targetRegion.key]: memoryWeatherCache[cacheKey] }));
      return;
    }

    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem(`tcm_weather_${cacheKey}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          memoryWeatherCache[cacheKey] = parsed;
          setWeatherMap(prev => ({ ...prev, [targetRegion.key]: parsed }));
          return;
        }
      } catch (e) {}
    }

    setLoadingWeather(true);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${targetRegion.lat}&longitude=${targetRegion.lon}&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FSeoul&past_days=14&forecast_days=16&wind_speed_unit=ms`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Weather API request failed');
      const data = await res.json();

      const byDate = {};

      if (data.daily && Array.isArray(data.daily.time)) {
        data.daily.time.forEach((dateStr, idx) => {
          byDate[dateStr] = {
            dailyMax: Math.round(data.daily.temperature_2m_max?.[idx] ?? 20),
            dailyMin: Math.round(data.daily.temperature_2m_min?.[idx] ?? 10),
            dailyPopMax: data.daily.precipitation_probability_max?.[idx] ?? 0,
            dailyCode: data.daily.weather_code?.[idx] ?? 0,
            hours: [],
          };
        });
      }

      if (data.hourly && Array.isArray(data.hourly.time)) {
        data.hourly.time.forEach((isoTime, idx) => {
          const [dateStr, timePart] = isoTime.split('T');
          const hourNum = parseInt(timePart?.split(':')[0] || '0', 10);
          if (!byDate[dateStr]) {
            byDate[dateStr] = { dailyMax: 20, dailyMin: 10, dailyPopMax: 0, dailyCode: 0, hours: [] };
          }
          byDate[dateStr].hours.push({
            time: timePart || `${String(hourNum).padStart(2, '0')}:00`,
            hour: hourNum,
            temp: Math.round(data.hourly.temperature_2m?.[idx] ?? 18),
            apparentTemp: Math.round(data.hourly.apparent_temperature?.[idx] ?? 18),
            pop: data.hourly.precipitation_probability?.[idx] ?? 0,
            precipitation: data.hourly.precipitation?.[idx] ?? 0,
            weatherCode: data.hourly.weather_code?.[idx] ?? 0,
            windSpeed: data.hourly.wind_speed_10m?.[idx] ?? 0,
            humidity: data.hourly.relative_humidity_2m?.[idx] ?? 50,
          });
        });
      }

      memoryWeatherCache[cacheKey] = byDate;
      setWeatherMap(prev => ({ ...prev, [targetRegion.key]: byDate }));

      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(`tcm_weather_${cacheKey}`, JSON.stringify(byDate));
        } catch (e) {}
      }
    } catch (err) {
      console.warn('Weather fetch warning:', err);
    } finally {
      setLoadingWeather(false);
    }
  }, []);

  useEffect(() => {
    fetchRegionWeather(regionKey);
  }, [regionKey, fetchRegionWeather]);

  // 특정 일정의 장소(location)에 매칭되는 지역이 있으면 자동으로 함께 로드
  const getWeatherForEvent = useCallback((event) => {
    if (!event) return null;
    const matchedRegion = resolveRegionForLocation(event.location, regionKey);
    const regionData = weatherMap[matchedRegion.key] || weatherMap[regionKey];
    if (!weatherMap[matchedRegion.key]) {
      fetchRegionWeather(matchedRegion.key);
    }
    const summary = extractEventWeather(regionData, event);
    return {
      ...summary,
      region: matchedRegion,
    };
  }, [weatherMap, regionKey, fetchRegionWeather]);

  return {
    regionKey,
    changeRegion,
    loadingWeather,
    getWeatherForEvent,
  };
}

// 투표 카드 안에 들어가는 날씨 아이콘 & 요약 배지 버튼
export function VoteCardWeatherBadge({ event, weatherInfo, onClick }) {
  if (!event) return null;

  const isAvailable = weatherInfo?.available;
  const meta = weatherInfo?.meta;

  const handleClick = (e) => {
    e.stopPropagation();
    if (onClick) onClick(event);
  };

  if (!isAvailable) {
    // 16일 이후 미래 일정이거나 로딩 중인 경우에도 클릭하여 안내 및 외부 기상청/네이버 날씨를 볼 수 있게 지원
    return (
      <button
        type="button"
        onClick={handleClick}
        title="클릭하여 상세 날씨 예보 안내 보기"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '4px 9px',
          borderRadius: '999px',
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
          color: '#475569',
          fontSize: '11.5px',
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          flexShrink: 0,
        }}
      >
        <WeatherSvgIcon type="partly_cloudy" size={16} />
        <span>날씨 예보</span>
        <span style={{ fontSize: '10px', color: '#94a3b8' }}>🔍</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`${event.date} (${event.startTime}~${event.endTime}) 예상 날씨: ${meta.label} ${weatherInfo.avgTemp}°C (강수확률 ${weatherInfo.maxPop}%) - 클릭하여 시간대별 상세 날씨 보기`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3.5px 9px 3.5px 7px',
        borderRadius: '999px',
        background: meta.badgeBg || meta.bg,
        border: `1px solid ${meta.border}`,
        color: meta.text,
        fontSize: '12px',
        fontWeight: 800,
        cursor: 'pointer',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 3px 8px rgba(0, 0, 0, 0.1)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 1px 4px rgba(0, 0, 0, 0.06)';
      }}
    >
      <WeatherSvgIcon type={meta.type} size={18} />
      <span style={{ letterSpacing: '-0.02em' }}>{meta.category}</span>
      <span style={{ fontWeight: 800 }}>{weatherInfo.avgTemp}°</span>
      {weatherInfo.maxPop >= 20 && (
        <span style={{
          fontSize: '10.5px',
          fontWeight: 700,
          color: weatherInfo.maxPop >= 50 ? '#1d4ed8' : '#0284c7',
          background: 'rgba(255, 255, 255, 0.75)',
          padding: '0px 4px',
          borderRadius: '6px',
          marginLeft: '1px'
        }}>
          💧{weatherInfo.maxPop}%
        </span>
      )}
    </button>
  );
}

// 상세 시간대별 날씨 모달 컴포넌트
export function WeatherDetailModal({
  event,
  weatherInfo,
  regionKey,
  onChangeRegion,
  onClose,
}) {
  const [viewScope, setViewScope] = useState('focused'); // 'focused' (모임 전후 시간대) | 'all' (24시간 전체)

  const isAvailable = weatherInfo?.available;
  const meta = weatherInfo?.meta;
  const region = weatherInfo?.region || KOREA_REGIONS[0];

  // 모임 시간 전후 (-3시간 ~ +2시간) 또는 24시간 전체 필터링
  const displayedHours = useMemo(() => {
    if (!isAvailable || !weatherInfo?.hours) return [];
    if (viewScope === 'all') return weatherInfo.hours;
    const minH = Math.max(0, (weatherInfo.startHour ?? 18) - 3);
    const maxH = Math.min(23, (weatherInfo.endHour ?? 20) + 2);
    return weatherInfo.hours.filter(h => h.hour >= minH && h.hour <= maxH);
  }, [isAvailable, weatherInfo, viewScope]);

  if (!event) return null;

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const [y, m, d] = (event.date || '').split('-').map(Number);
  const dayOfWeek = !isNaN(y) ? dayNames[new Date(y, m - 1, d).getDay()] : '';

  const searchQuery = encodeURIComponent(`${event.location && event.location !== '별도 테니스장' ? event.location : region.shortName} 날씨`);
  const naverWeatherUrl = `https://search.naver.com/search.naver?query=${searchQuery}`;
  const daumWeatherUrl = `https://search.daum.net/search?q=${searchQuery}`;
  const kmaUrl = `https://www.weather.go.kr/w/index.do`;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ zIndex: 1200 }}
    >
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '520px',
          width: '100%',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          borderRadius: '18px',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
          boxShadow: '0 20px 50px rgba(15, 23, 42, 0.25)',
        }}
      >
        {/* 상단 헤더 배너 */}
        <div
          style={{
            background: isAvailable && meta?.category === '비'
              ? 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)'
              : isAvailable && meta?.category === '흐림'
              ? 'linear-gradient(135deg, #334155 0%, #475569 100%)'
              : 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 55%, #38bdf8 100%)',
            color: '#ffffff',
            padding: '18px 20px 16px 20px',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  background: 'rgba(255, 255, 255, 0.22)',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  backdropFilter: 'blur(4px)'
                }}>
                  🌤️ 모임 시간대별 상세 날씨 예보
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  background: 'rgba(15, 23, 42, 0.25)',
                  padding: '2px 8px',
                  borderRadius: '999px',
                }}>
                  📍 {region.shortName} 기준
                </span>
              </div>
              <h2 style={{ margin: '4px 0 2px 0', fontSize: '19px', fontWeight: 800, letterSpacing: '-0.02em' }}>
                {event.title} · {event.date} ({dayOfWeek})
              </h2>
              <div style={{ fontSize: '13px', opacity: 0.92, fontWeight: 600, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <span>⏰ 모임 시간: {event.startTime} ~ {event.endTime}</span>
                <span>📍 장소: {event.location || '그린테니스장'}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                color: '#ffffff',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                fontSize: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              aria-label="닫기"
            >
              &times;
            </button>
          </div>

          {/* 기준 지역 변경 바 */}
          <div style={{
            marginTop: '12px',
            paddingTop: '10px',
            borderTop: '1px solid rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            flexWrap: 'wrap',
            fontSize: '12px'
          }}>
            <span style={{ opacity: 0.9, fontWeight: 600 }}>🗺️ 예보 기준 지역 설정:</span>
            <select
              value={regionKey}
              onChange={e => onChangeRegion && onChangeRegion(e.target.value)}
              style={{
                background: 'rgba(255, 255, 255, 0.95)',
                color: '#0f172a',
                border: 'none',
                borderRadius: '8px',
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {KOREA_REGIONS.map(r => (
                <option key={r.key} value={r.key}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 모달 본문 */}
        <div style={{ padding: '16px 18px', overflowY: 'auto', flex: '1 1 auto', background: '#f8fafc' }}>
          {!isAvailable ? (
            <div style={{
              background: '#ffffff',
              borderRadius: '14px',
              padding: '28px 20px',
              textAlign: 'center',
              border: '1px solid #e2e8f0',
              marginBottom: '14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                <WeatherSvgIcon type="partly_cloudy" size={52} />
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
                상세 시간대별 예보 준비 중입니다
              </div>
              <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.6, margin: '0 0 16px 0' }}>
                기상청 및 Open-Meteo 시간대별 상세 예보는 <strong>모임일 16일 전(D-16)</strong>부터 실시간으로 제공됩니다.<br />
                현재 일정(<strong>{event.date}</strong>)이 예보 제공 기간에 진입하면 자동으로 시간별 기온과 강수확률이 표시됩니다.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <a
                  href={naverWeatherUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm"
                  style={{ textDecoration: 'none', fontWeight: 700, padding: '8px 14px' }}
                >
                  🟢 네이버 날씨에서 확인
                </a>
                <a
                  href={kmaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ textDecoration: 'none', fontWeight: 700, padding: '8px 14px' }}
                >
                  🌤️ 기상청 날씨누리
                </a>
              </div>
            </div>
          ) : (
            <>
              {/* 1. 모임 시간대 집중 요약 카드 */}
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '14px',
                  padding: '16px',
                  border: `1.5px solid ${meta.border}`,
                  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
                  marginBottom: '14px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '14px',
                        background: meta.badgeBg || meta.bg,
                        border: `1px solid ${meta.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <WeatherSvgIcon type={meta.type} size={38} />
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '2px' }}>
                        모임 시간대 ({event.startTime} ~ {event.endTime}) 예상
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em' }}>
                          {weatherInfo.avgTemp}°C
                        </span>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: 800,
                          color: meta.text,
                          background: meta.bg,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          border: `1px solid ${meta.border}`
                        }}>
                          {meta.label}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px', fontWeight: 500 }}>
                        체감 {weatherInfo.avgApparent}°C · 일 최저 {weatherInfo.dailyMin}° / 최고 {weatherInfo.dailyMax}°
                      </div>
                    </div>
                  </div>

                  {/* 테니스 경기 적합도 배지 */}
                  {weatherInfo.tennisStatus && (
                    <div
                      style={{
                        background: weatherInfo.tennisStatus.bg,
                        color: weatherInfo.tennisStatus.color,
                        border: `1px solid ${weatherInfo.tennisStatus.border}`,
                        padding: '5px 10px',
                        borderRadius: '999px',
                        fontSize: '12px',
                        fontWeight: 800,
                      }}
                    >
                      {weatherInfo.tennisStatus.badge}
                    </div>
                  )}
                </div>

                {/* 핵심 기상 지표 4열 그리드 */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '8px',
                    background: '#f8fafc',
                    padding: '10px',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    textAlign: 'center',
                    marginBottom: '10px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>💧 강수확률</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: weatherInfo.maxPop >= 50 ? '#1d4ed8' : '#0f172a', marginTop: '2px' }}>
                      {weatherInfo.maxPop}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>🌧️ 예상강수</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: weatherInfo.totalPrecip > 0 ? '#1d4ed8' : '#0f172a', marginTop: '2px' }}>
                      {weatherInfo.totalPrecip}mm
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>🍃 최대풍속</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                      {weatherInfo.maxWind}m/s
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>💦 평균습도</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                      {weatherInfo.avgHumidity}%
                    </div>
                  </div>
                </div>

                {/* 테니스 한줄 코멘트 */}
                {weatherInfo.tennisStatus && (
                  <div
                    style={{
                      fontSize: '12.5px',
                      color: '#334155',
                      background: '#f1f5f9',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontWeight: 600,
                      lineHeight: 1.45,
                    }}
                  >
                    💡 {weatherInfo.tennisStatus.comment}
                  </div>
                )}
              </div>

              {/* 2. 시간대별 상세 날씨 헤더 & 범위 토글 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 800, color: '#0f172a' }}>
                    🕒 시간대별 상세 날씨
                  </h3>
                  <span style={{ fontSize: '11.5px', color: '#0284c7', fontWeight: 700 }}>
                    (🎾 모임 시간 하이라이트)
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setViewScope('focused')}
                    className={`btn btn-sm ${viewScope === 'focused' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '4px 10px', fontSize: '11.5px', fontWeight: 700, height: '27px' }}
                  >
                    모임 전후 시간
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewScope('all')}
                    className={`btn btn-sm ${viewScope === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '4px 10px', fontSize: '11.5px', fontWeight: 700, height: '27px' }}
                  >
                    24시간 전체
                  </button>
                </div>
              </div>

              {/* 3. 시간대별 날씨 리스트 */}
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                }}
              >
                {/* 테이블 헤더 */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '68px 1.2fr 64px 72px 68px',
                    padding: '8px 12px',
                    background: '#f1f5f9',
                    borderBottom: '1px solid #e2e8f0',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: '#475569',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ textAlign: 'left' }}>시간</div>
                  <div style={{ textAlign: 'left' }}>날씨</div>
                  <div>기온</div>
                  <div>강수확률</div>
                  <div>바람</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {displayedHours.map((h) => {
                    const isMeeting = h.isMeetingHour;
                    return (
                      <div
                        key={h.time}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '68px 1.2fr 64px 72px 68px',
                          alignItems: 'center',
                          padding: isMeeting ? '9px 12px' : '7px 12px',
                          borderBottom: '1px solid #f1f5f9',
                          background: isMeeting
                            ? 'linear-gradient(90deg, rgba(2, 132, 199, 0.10) 0%, rgba(56, 189, 248, 0.05) 100%)'
                            : '#ffffff',
                          borderLeft: isMeeting ? '3.5px solid #0284c7' : '3.5px solid transparent',
                          fontSize: '12.5px',
                          textAlign: 'center',
                        }}
                      >
                        {/* 시간 */}
                        <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                          <span style={{ fontWeight: isMeeting ? 800 : 600, color: isMeeting ? '#0284c7' : '#334155' }}>
                            {h.time}
                          </span>
                          {isMeeting && (
                            <span style={{
                              fontSize: '9.5px',
                              fontWeight: 800,
                              color: '#0284c7',
                              background: '#e0f2fe',
                              padding: '0.5px 4px',
                              borderRadius: '4px',
                              width: 'fit-content'
                            }}>
                              🎾 모임
                            </span>
                          )}
                        </div>

                        {/* 날씨 아이콘 + 라벨 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', textAlign: 'left' }}>
                          <WeatherSvgIcon type={h.meta.type} size={22} />
                          <span style={{
                            fontWeight: isMeeting ? 800 : 600,
                            color: h.meta.category === '비' ? '#1d4ed8' : '#1e293b',
                            fontSize: '12.5px'
                          }}>
                            {h.meta.label}
                          </span>
                        </div>

                        {/* 기온 */}
                        <div>
                          <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '13.5px' }}>
                            {h.temp}°
                          </span>
                        </div>

                        {/* 강수확률 & 강수량 */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{
                            fontWeight: h.pop >= 40 ? 800 : 600,
                            color: h.pop >= 50 ? '#1d4ed8' : h.pop >= 30 ? '#0284c7' : '#64748b',
                            fontSize: '12px'
                          }}>
                            💧 {h.pop}%
                          </span>
                          {h.precipitation > 0 && (
                            <span style={{ fontSize: '10px', color: '#2563eb', fontWeight: 700 }}>
                              {h.precipitation}mm
                            </span>
                          )}
                        </div>

                        {/* 풍속 */}
                        <div style={{ color: '#475569', fontSize: '12px', fontWeight: 600 }}>
                          {h.windSpeed}m/s
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 모달 푸터: 외부 날씨 앱 연동 및 닫기 */}
        <div
          style={{
            padding: '12px 18px',
            background: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <a
              href={naverWeatherUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              style={{
                textDecoration: 'none',
                fontSize: '12px',
                fontWeight: 700,
                padding: '6px 10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                color: '#15803d',
                borderColor: '#bbf7d0',
                background: '#f0fdf4'
              }}
            >
              <span>🟢 네이버 날씨</span>
            </a>
            <a
              href={daumWeatherUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              style={{
                textDecoration: 'none',
                fontSize: '12px',
                fontWeight: 700,
                padding: '6px 10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                color: '#1d4ed8',
                borderColor: '#bfdbfe',
                background: '#eff6ff'
              }}
            >
              <span>🔵 다음 날씨</span>
            </a>
            <a
              href={kmaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              style={{
                textDecoration: 'none',
                fontSize: '12px',
                fontWeight: 700,
                padding: '6px 10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>🌤️ 기상청</span>
            </a>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: '7px 18px', fontSize: '13px', fontWeight: 700 }}
            onClick={onClose}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
