import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, addDoc } from 'firebase/firestore';

// Old project
const oldConfig = {
  apiKey: "AIzaSyBkDZxSs2_WlGK4nXwbmnE2B9SdImdCFSk",
  projectId: "tennismatch-83355"
};
const oldApp = initializeApp(oldConfig, 'oldApp');
const oldDb = getFirestore(oldApp);

// New project
const newConfig = {
  apiKey: "AIzaSyAC8P9-KJwC_nq-v-zTFDDzjAjBuS6Npq4",
  projectId: "tennisclubmanager-2d4c2"
};
const newApp = initializeApp(newConfig, 'newApp');
const newDb = getFirestore(newApp);

async function migrate() {
  console.log("Starting migration...");
  try {
    // 1. Create a default club in new DB
    const clubRef = await addDoc(collection(newDb, 'clubs'), {
      name: 'WALTC', // Use the WALTC name since they were trying to join it earlier
      description: '기존 데이터 마이그레이션 클럽',
      createdAt: new Date()
    });
    const clubId = clubRef.id;
    console.log(`Club created: ${clubId}`);

    // 2. Migrate members
    const membersSnap = await getDocs(collection(oldDb, 'shared', 'tennis-club', 'members'));
    let memberCount = 0;
    for (const d of membersSnap.docs) {
      await setDoc(doc(newDb, 'clubs', clubId, 'members', d.id), d.data());
      memberCount++;
    }
    console.log(`Migrated ${memberCount} members`);

    // 3. Migrate schedules
    const schedulesSnap = await getDocs(collection(oldDb, 'shared', 'tennis-club', 'schedules'));
    let scheduleCount = 0;
    for (const d of schedulesSnap.docs) {
      await setDoc(doc(newDb, 'clubs', clubId, 'schedules', d.id), d.data());
      scheduleCount++;
    }
    console.log(`Migrated ${scheduleCount} schedules`);

    // 4. Migrate events
    const eventsSnap = await getDocs(collection(oldDb, 'shared', 'tennis-club', 'events'));
    let eventCount = 0;
    for (const d of eventsSnap.docs) {
      await setDoc(doc(newDb, 'clubs', clubId, 'events', d.id), d.data());
      eventCount++;
    }
    console.log(`Migrated ${eventCount} events`);

    // 5. Migrate admins
    const adminsSnap = await getDocs(collection(oldDb, 'shared', 'tennis-club', 'admins'));
    let adminCount = 0;
    for (const d of adminsSnap.docs) {
      await setDoc(doc(newDb, 'clubs', clubId, 'admins', d.id), d.data());
      adminCount++;
    }
    console.log(`Migrated ${adminCount} admins`);

    console.log("Migration complete!");
  } catch(e) {
    console.error("Migration failed:", e);
  }
}

migrate().then(() => process.exit(0));
