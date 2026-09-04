// lib/firestore.js — 확장판 (v3: members 컬렉션, schedule/scores/history 지원, 실시간 동기화)
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, getDoc, setDoc, query, orderBy, serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';

/* ── 헬퍼 ── */
function schedulesRef(uid) { return collection(db, 'shared', 'tcc-club', 'schedules'); }
function membersRef(uid)   { return collection(db, 'shared', 'tcc-club', 'members'); }
function eventsRef(uid)    { return collection(db, 'shared', 'tcc-club', 'events'); }
function adminsRef()       { return collection(db, 'shared', 'tcc-club', 'admins'); }
function tournamentsRef(uid) { return collection(db, 'shared', 'tcc-club', 'tournaments'); }

/* ══════════════════════════════════════════════════════════
   클럽 설정 (settings) CRUD
══════════════════════════════════════════════════════════ */
export async function getClubSettings() {
  const ref = doc(db, 'shared', 'tcc-club', 'settings', 'finance');
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data();
}

export async function updateClubSettings(data) {
  const ref = doc(db, 'shared', 'tcc-club', 'settings', 'finance');
  await setDoc(ref, data, { merge: true });
}

export async function getMonthlyFinance(monthStr) {
  const ref = doc(db, 'shared', 'tcc-club', 'finance', monthStr);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { totalCourtFee: 0 };
  return snap.data();
}

export async function updateMonthlyFinance(monthStr, data) {
  const ref = doc(db, 'shared', 'tcc-club', 'finance', monthStr);
  await setDoc(ref, data, { merge: true });
}

/* ══════════════════════════════════════════════════════════
   정기 모임 요일/시간 규칙(meetingRules) CRUD
══════════════════════════════════════════════════════════ */
export async function getMeetingRules() {
  const ref = doc(db, 'shared', 'tcc-club', 'settings', 'meetingRules');
  const snap = await getDoc(ref);
  if (!snap.exists() || !snap.data().rules || snap.data().rules.length === 0) {
    // 기본 디폴트 규칙 (화요일, 목요일)
    return [
      { id: 'rule_tue', day: 2, dayName: '화요일', title: '정기 모임 (화)', startTime: '18:00', endTime: '20:00', location: '별도 테니스장', enabled: true },
      { id: 'rule_thu', day: 4, dayName: '목요일', title: '정기 모임 (목)', startTime: '19:00', endTime: '22:00', location: '그린테니스장', enabled: true }
    ];
  }
  return snap.data().rules;
}

export async function updateMeetingRules(rules) {
  const ref = doc(db, 'shared', 'tcc-club', 'settings', 'meetingRules');
  await setDoc(ref, { rules, updatedAt: serverTimestamp() }, { merge: true });
}

/* ══════════════════════════════════════════════════════════
   관리자(admins) CRUD
══════════════════════════════════════════════════════════ */
export async function getAdmins() {
  const snap = await getDocs(adminsRef());
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addAdmin(email) {
  const ref = await addDoc(adminsRef(), { email, createdAt: serverTimestamp() });
  return ref.id;
}

export async function deleteAdmin(id) {
  await deleteDoc(doc(db, 'shared', 'tcc-club', 'admins', id));
}

/* ══════════════════════════════════════════════════════════
   회원(members) CRUD
══════════════════════════════════════════════════════════ */
export async function getMembers(uid) {
  const snap = await getDocs(membersRef(uid));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addMember(uid, data) {
  const ref = await addDoc(membersRef(uid), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}

export async function updateMember(uid, memberId, data) {
  await updateDoc(doc(db, 'shared', 'tcc-club', 'members', memberId), data);
}

export async function deleteMember(uid, memberId) {
  await deleteDoc(doc(db, 'shared', 'tcc-club', 'members', memberId));
}

/* 최초 로그인시 기본 회원 목록 세팅 */
export async function initDefaultMembers(uid) {
  const snap = await getDocs(membersRef(uid));
  if (!snap.empty) return; // 이미 존재
  const defaults = [
    { name: '유경재', role: '정회원', gender: 'M', ntrp: 3.5 },
    { name: '윤필구', role: '정회원', gender: 'M', ntrp: 3.0 },
    { name: '백성렬', role: '정회원', gender: 'M', ntrp: 3.0 },
    { name: '김정답', role: '정회원', gender: 'M', ntrp: 2.5 },
    { name: '강택기', role: '정회원', gender: 'M', ntrp: 1.5 },
    { name: '김민재', role: '정회원', gender: 'M', ntrp: 1.5 },
    { name: '신흥섭', role: '정회원', gender: 'M', ntrp: 1.5 },
    { name: '한규민', role: '정회원', gender: 'M', ntrp: 1.5 },
    { name: '최재완', role: '정회원', gender: 'M', ntrp: 2.5 },
    { name: '최옥분', role: '정회원', gender: 'F', ntrp: 2.0 },
    { name: '이민지', role: '정회원', gender: 'F', ntrp: 1.0 },
  ];
  for (const m of defaults) {
    await addDoc(membersRef(uid), { ...m, createdAt: serverTimestamp() });
  }
}

/* ══════════════════════════════════════════════════════════
   대진표(schedules) CRUD
══════════════════════════════════════════════════════════ */
export async function getSchedules(uid) {
  const q = query(schedulesRef(uid), orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const data = d.data();
    if (typeof data.schedule === 'string') data.schedule = JSON.parse(data.schedule);
    if (typeof data.history === 'string') data.history = JSON.parse(data.history);
    return { id: d.id, ...data };
  });
}

export async function getSchedule(uid, scheduleId) {
  const ref = doc(db, 'shared', 'tcc-club', 'schedules', scheduleId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  if (typeof data.schedule === 'string') data.schedule = JSON.parse(data.schedule);
  if (typeof data.history === 'string') data.history = JSON.parse(data.history);
  return { id: snap.id, ...data };
}

export function subscribeSchedule(uid, scheduleId, callback) {
  const ref = doc(db, 'shared', 'tcc-club', 'schedules', scheduleId);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    const data = snap.data();
    if (typeof data.schedule === 'string') data.schedule = JSON.parse(data.schedule);
    if (typeof data.history === 'string') data.history = JSON.parse(data.history);
    callback({ id: snap.id, ...data });
  }, (err) => {
    console.error('subscribeSchedule error:', err);
  });
}

export async function createSchedule(uid, data) {
  const payload = { ...data };
  if (payload.schedule) payload.schedule = JSON.stringify(payload.schedule);
  if (payload.history) payload.history = JSON.stringify(payload.history);

  const ref = await addDoc(schedulesRef(uid), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateSchedule(uid, scheduleId, data) {
  const payload = { ...data };
  if (payload.schedule) payload.schedule = JSON.stringify(payload.schedule);
  if (payload.history) payload.history = JSON.stringify(payload.history);

  const ref = doc(db, 'shared', 'tcc-club', 'schedules', scheduleId);
  await updateDoc(ref, { ...payload, updatedAt: serverTimestamp() });
}

export async function deleteSchedule(uid, scheduleId) {
  await deleteDoc(doc(db, 'shared', 'tcc-club', 'schedules', scheduleId));
}

/* ══════════════════════════════════════════════════════════
   일정 투표(events) CRUD
══════════════════════════════════════════════════════════ */
export async function getEvents(uid) {
  const q = query(eventsRef(uid), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createEvent(uid, data) {
  const ref = await addDoc(eventsRef(uid), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateEvent(uid, eventId, data) {
  await updateDoc(doc(db, 'shared', 'tcc-club', 'events', eventId), data);
}

export async function deleteEvent(uid, eventId) {
  await deleteDoc(doc(db, 'shared', 'tcc-club', 'events', eventId));
}

export async function updateEventAttendees(uid, eventId, attendees) {
  await updateDoc(doc(db, 'shared', 'tcc-club', 'events', eventId), { attendees });
}

/* ══════════════════════════════════════════════════════════
   정기 대회(tournaments) CRUD
══════════════════════════════════════════════════════════ */
export async function getTournaments(uid) {
  const q = query(tournamentsRef(uid), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const data = d.data();
    if (typeof data.attendees === 'string') data.attendees = JSON.parse(data.attendees);
    if (typeof data.teams === 'string') data.teams = JSON.parse(data.teams);
    if (typeof data.matches === 'string') data.matches = JSON.parse(data.matches);
    if (typeof data.scores === 'string') data.scores = JSON.parse(data.scores);
    return { id: d.id, ...data };
  });
}

export async function getTournament(uid, id) {
  const ref = doc(db, 'shared', 'tcc-club', 'tournaments', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  if (typeof data.attendees === 'string') data.attendees = JSON.parse(data.attendees);
  if (typeof data.teams === 'string') data.teams = JSON.parse(data.teams);
  if (typeof data.matches === 'string') data.matches = JSON.parse(data.matches);
  if (typeof data.scores === 'string') data.scores = JSON.parse(data.scores);
  return { id, ...data };
}

export function subscribeTournament(uid, id, callback) {
  const ref = doc(db, 'shared', 'tcc-club', 'tournaments', id);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    const data = snap.data();
    if (typeof data.attendees === 'string') data.attendees = JSON.parse(data.attendees);
    if (typeof data.teams === 'string') data.teams = JSON.parse(data.teams);
    if (typeof data.matches === 'string') data.matches = JSON.parse(data.matches);
    if (typeof data.scores === 'string') data.scores = JSON.parse(data.scores);
    callback({ id: snap.id, ...data });
  }, (err) => {
    console.error('subscribeTournament error:', err);
  });
}

export async function createTournament(uid, data) {
  const payload = { ...data };
  if (payload.attendees) payload.attendees = JSON.stringify(payload.attendees);
  if (payload.teams) payload.teams = JSON.stringify(payload.teams);
  if (payload.matches) payload.matches = JSON.stringify(payload.matches);
  if (payload.scores) payload.scores = JSON.stringify(payload.scores);
  const ref = await addDoc(tournamentsRef(uid), {
    ...payload,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTournament(uid, id, data) {
  const payload = { ...data };
  if (payload.attendees) payload.attendees = JSON.stringify(payload.attendees);
  if (payload.teams) payload.teams = JSON.stringify(payload.teams);
  if (payload.matches) payload.matches = JSON.stringify(payload.matches);
  if (payload.scores) payload.scores = JSON.stringify(payload.scores);
  
  await updateDoc(doc(db, 'shared', 'tcc-club', 'tournaments', id), payload);
}

export async function deleteTournament(uid, id) {
  await deleteDoc(doc(db, 'shared', 'tcc-club', 'tournaments', id));
}
