'use client';
import { useState } from 'react';
import { collection, doc, getDocs, addDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function MigratePage() {
  const [status, setStatus] = useState('대기 중');
  
  const handleMigrate = async () => {
    setStatus('마이그레이션 시작 중...');
    try {
      // 1. 새 기본 클럽 생성
      const clubRef = await addDoc(collection(db, 'clubs'), {
        name: '기본 클럽',
        description: '기존 데이터 마이그레이션 클럽',
        createdAt: new Date()
      });
      const clubId = clubRef.id;
      setStatus(`클럽 생성 완료 (ID: ${clubId}). 데이터 복사 시작...`);

      // 2. Members 마이그레이션
      const membersSnap = await getDocs(collection(db, 'shared', 'tennis-club', 'members'));
      let memberCount = 0;
      for (const mDoc of membersSnap.docs) {
        await setDoc(doc(db, 'clubs', clubId, 'members', mDoc.id), mDoc.data());
        memberCount++;
      }
      setStatus(`멤버 복사 완료 (${memberCount}명)`);

      // 3. Schedules 마이그레이션
      const schedulesSnap = await getDocs(collection(db, 'shared', 'tennis-club', 'schedules'));
      let scheduleCount = 0;
      for (const sDoc of schedulesSnap.docs) {
        await setDoc(doc(db, 'clubs', clubId, 'schedules', sDoc.id), sDoc.data());
        scheduleCount++;
      }
      setStatus(`대진표 복사 완료 (${scheduleCount}건)`);

      // 4. Events 마이그레이션
      const eventsSnap = await getDocs(collection(db, 'shared', 'tennis-club', 'events'));
      let eventCount = 0;
      for (const eDoc of eventsSnap.docs) {
        await setDoc(doc(db, 'clubs', clubId, 'events', eDoc.id), eDoc.data());
        eventCount++;
      }
      setStatus(`일정 복사 완료 (${eventCount}건)`);

      // 5. Admins 마이그레이션
      const adminsSnap = await getDocs(collection(db, 'shared', 'tennis-club', 'admins'));
      let adminCount = 0;
      for (const aDoc of adminsSnap.docs) {
        await setDoc(doc(db, 'clubs', clubId, 'admins', aDoc.id), aDoc.data());
        adminCount++;
      }
      setStatus(`모든 마이그레이션 완료! (멤버: ${memberCount}, 대진표: ${scheduleCount}, 일정: ${eventCount}, 관리자: ${adminCount})`);

    } catch (e) {
      console.error(e);
      setStatus(`에러 발생: ${e.message}`);
    }
  };

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>데이터 마이그레이션</h1>
      <p>기존 shared/tennis-club 데이터를 clubs 루트 컬렉션의 새 클럽으로 복사합니다.</p>
      <button 
        onClick={handleMigrate}
        style={{ padding: '10px 20px', fontSize: 16, cursor: 'pointer', marginBottom: 20 }}
      >
        마이그레이션 실행
      </button>
      <div>
        <strong>상태:</strong> {status}
      </div>
    </div>
  );
}
