// lib/firestore.js — 멀티 클럽 지원 (v4)
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, getDoc, setDoc, query, orderBy, serverTimestamp, where, writeBatch
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';

/* ── 헬퍼 ── */
function schedulesRef(clubId) { return collection(db, 'clubs', clubId, 'schedules'); }
function membersRef(clubId)   { return collection(db, 'clubs', clubId, 'members'); }
function eventsRef(clubId)    { return collection(db, 'clubs', clubId, 'events'); }
function adminsRef(clubId)    { return collection(db, 'clubs', clubId, 'admins'); }
function clubsRef()           { return collection(db, 'clubs'); }
function joinRequestsRef()    { return collection(db, 'joinRequests'); }
function tournamentsRef(clubId) { return collection(db, 'clubs', clubId, 'tournaments'); }

/* ══════════════════════════════════════════════════════════
   클럽(clubs) CRUD
══════════════════════════════════════════════════════════ */
export async function getClubs() {
  const snap = await getDocs(clubsRef());
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getClub(clubId) {
  const ref = doc(db, 'clubs', clubId);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getClubSettings(clubId) {
  if (!clubId) return null;
  return await getClub(clubId);
}

export async function createClub(data) {
  const ref = await addDoc(clubsRef(), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}

export async function updateClub(clubId, data) {
  await updateDoc(doc(db, 'clubs', clubId), data);
}

export async function updateClubSettings(clubId, data) {
  if (!clubId) return;
  await updateClub(clubId, data);
}

export async function getMonthlyFinance(clubId, monthStr) {
  if (!clubId || !monthStr) return { totalCourtFee: 0 };
  const ref = doc(db, 'clubs', clubId, 'finance', monthStr);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { totalCourtFee: 0 };
  return snap.data();
}

export async function updateMonthlyFinance(clubId, monthStr, data) {
  if (!clubId || !monthStr) return;
  const ref = doc(db, 'clubs', clubId, 'finance', monthStr);
  await setDoc(ref, data, { merge: true });
}

export async function uploadClubImage(clubId, file) {
  if (!storage) throw new Error('Firebase Storage is not initialized.');
  const fileExt = file.name.split('.').pop();
  const fileName = `club_images/${clubId}_${Date.now()}.${fileExt}`;
  const imageRef = ref(storage, fileName);
  
  // Storage upload might hang if rules block or CORS fails. Add a timeout.
  const uploadTask = uploadBytes(imageRef, file);
  const timeoutTask = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Firebase Storage upload timed out (5s). Please check Storage rules or use the image URL input instead.')), 5000)
  );
  
  await Promise.race([uploadTask, timeoutTask]);
  
  const downloadURL = await getDownloadURL(imageRef);
  // We don't necessarily need to update the club here because app/dashboard/page.js does it, but it's okay to keep or remove.
  return downloadURL;
}

export async function deleteClub(clubId) {
  if (!clubId) return;

  // We will use Promise.all to delete subcollections document by document
  // to avoid hitting the 500 document limit of a single writeBatch if possible,
  // or we can just use deleteDoc concurrently for simplicity since it's the client SDK.
  
  const deletePromises = [];

  const addDeletes = async (refQuery) => {
    try {
      const snap = await getDocs(refQuery);
      snap.forEach(d => deletePromises.push(deleteDoc(d.ref)));
    } catch (e) {
      console.warn('Failed to fetch for deletion:', e);
    }
  };

  // 1. Delete admins
  await addDeletes(adminsRef(clubId));

  // 2. Delete members
  await addDeletes(membersRef(clubId));

  // 3. Delete schedules
  await addDeletes(schedulesRef(clubId));

  // 4. Delete events
  await addDeletes(eventsRef(clubId));

  // 5. Delete joinRequests
  const q = query(joinRequestsRef(), where('clubId', '==', clubId));
  await addDeletes(q);

  // Wait for all subcollection deletes to finish
  const results = await Promise.allSettled(deletePromises);
  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length > 0) {
    console.warn(`Failed to delete ${failed.length} documents due to permissions or other errors.`, failed);
  }

  // 6. Delete club doc
  await deleteDoc(doc(db, 'clubs', clubId));
}

/* ══════════════════════════════════════════════════════════
   관리자(admins) CRUD - 클럽별
══════════════════════════════════════════════════════════ */
export async function getAdmins(clubId) {
  if (!clubId) return [];
  const snap = await getDocs(adminsRef(clubId));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addAdmin(clubId, email) {
  const ref = await addDoc(adminsRef(clubId), { email, createdAt: serverTimestamp() });
  return ref.id;
}

export async function deleteAdmin(clubId, adminId) {
  await deleteDoc(doc(db, 'clubs', clubId, 'admins', adminId));
}

/* ══════════════════════════════════════════════════════════
   회원(members) CRUD - 클럽별
══════════════════════════════════════════════════════════ */
export async function getMembers(clubId) {
  if (!clubId) return [];
  const snap = await getDocs(membersRef(clubId));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addMember(clubId, data) {
  const ref = await addDoc(membersRef(clubId), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}
export const createMember = addMember;

export async function updateMember(clubId, memberId, data) {
  await updateDoc(doc(db, 'clubs', clubId, 'members', memberId), data);
}

export async function deleteMember(clubId, memberId) {
  await deleteDoc(doc(db, 'clubs', clubId, 'members', memberId));
}



/* ══════════════════════════════════════════════════════════
   대진표(schedules) CRUD - 클럽별
══════════════════════════════════════════════════════════ */
export async function getSchedules(clubId) {
  if (!clubId) return [];
  const q = query(schedulesRef(clubId), orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const data = d.data();
    if (typeof data.schedule === 'string') data.schedule = JSON.parse(data.schedule);
    if (typeof data.history === 'string') data.history = JSON.parse(data.history);
    return { id: d.id, ...data };
  });
}

export async function getSchedule(clubId, scheduleId) {
  if (!clubId || !scheduleId) return null;
  const ref = doc(db, 'clubs', clubId, 'schedules', scheduleId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  if (typeof data.schedule === 'string') data.schedule = JSON.parse(data.schedule);
  if (typeof data.history === 'string') data.history = JSON.parse(data.history);
  return { id: snap.id, ...data };
}

export async function createSchedule(clubId, data) {
  const payload = { ...data };
  if (payload.schedule) payload.schedule = JSON.stringify(payload.schedule);
  if (payload.history) payload.history = JSON.stringify(payload.history);

  const ref = await addDoc(schedulesRef(clubId), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateSchedule(clubId, scheduleId, data) {
  const payload = { ...data };
  if (payload.schedule) payload.schedule = JSON.stringify(payload.schedule);
  if (payload.history) payload.history = JSON.stringify(payload.history);

  const ref = doc(db, 'clubs', clubId, 'schedules', scheduleId);
  await updateDoc(ref, { ...payload, updatedAt: serverTimestamp() });
}

export async function deleteSchedule(clubId, scheduleId) {
  await deleteDoc(doc(db, 'clubs', clubId, 'schedules', scheduleId));
}

/* ══════════════════════════════════════════════════════════
   일정 투표(events) CRUD - 클럽별
══════════════════════════════════════════════════════════ */
export async function getEvents(clubId) {
  if (!clubId) return [];
  const q = query(eventsRef(clubId), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createEvent(clubId, data) {
  const ref = await addDoc(eventsRef(clubId), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateEvent(clubId, eventId, data) {
  await updateDoc(doc(db, 'clubs', clubId, 'events', eventId), data);
}

export async function deleteEvent(clubId, eventId) {
  await deleteDoc(doc(db, 'clubs', clubId, 'events', eventId));
}

export async function updateEventAttendees(clubId, eventId, attendees) {
  await updateDoc(doc(db, 'clubs', clubId, 'events', eventId), { attendees });
}

/* ══════════════════════════════════════════════════════════
   정기 대회(tournaments) CRUD - 클럽별
══════════════════════════════════════════════════════════ */
export async function getTournaments(clubId) {
  if (!clubId) return [];
  const q = query(tournamentsRef(clubId), orderBy('date', 'desc'));
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

export async function getTournament(clubId, id) {
  if (!clubId || !id) return null;
  const ref = doc(db, 'clubs', clubId, 'tournaments', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  if (typeof data.attendees === 'string') data.attendees = JSON.parse(data.attendees);
  if (typeof data.teams === 'string') data.teams = JSON.parse(data.teams);
  if (typeof data.matches === 'string') data.matches = JSON.parse(data.matches);
  if (typeof data.scores === 'string') data.scores = JSON.parse(data.scores);
  return { id, ...data };
}

export async function createTournament(clubId, data) {
  if (!clubId) return null;
  const payload = { ...data };
  if (payload.attendees) payload.attendees = JSON.stringify(payload.attendees);
  if (payload.teams) payload.teams = JSON.stringify(payload.teams);
  if (payload.matches) payload.matches = JSON.stringify(payload.matches);
  if (payload.scores) payload.scores = JSON.stringify(payload.scores);
  const ref = await addDoc(tournamentsRef(clubId), {
    ...payload,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTournament(clubId, id, data) {
  if (!clubId || !id) return;
  const payload = { ...data };
  if (payload.attendees) payload.attendees = JSON.stringify(payload.attendees);
  if (payload.teams) payload.teams = JSON.stringify(payload.teams);
  if (payload.matches) payload.matches = JSON.stringify(payload.matches);
  if (payload.scores) payload.scores = JSON.stringify(payload.scores);
  
  await updateDoc(doc(db, 'clubs', clubId, 'tournaments', id), payload);
}

export async function deleteTournament(clubId, id) {
  if (!clubId || !id) return;
  await deleteDoc(doc(db, 'clubs', clubId, 'tournaments', id));
}

/* ══════════════════════════════════════════════════════════
   가입 신청 (joinRequests) CRUD - 최상위 컬렉션
══════════════════════════════════════════════════════════ */
export async function createJoinRequest(data) {
  const ref = await addDoc(joinRequestsRef(), {
    ...data,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getJoinRequestsByUser(email) {
  if (!email) return [];
  // For searching join requests created by a specific user email
  const q = query(joinRequestsRef(), where('userEmail', '==', email));
  const snap = await getDocs(q);
  // Sort them manually in client if needed
  const reqs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return reqs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
}

export async function getPendingJoinRequestsByClub(clubId) {
  if (!clubId) return [];
  const q = query(joinRequestsRef(), where('clubId', '==', clubId), where('status', '==', 'pending'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateJoinRequestStatus(requestId, status) {
  await updateDoc(doc(db, 'joinRequests', requestId), { status, updatedAt: serverTimestamp() });
}

