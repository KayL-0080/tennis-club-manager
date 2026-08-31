import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, deleteDoc } from 'firebase/firestore';

const newConfig = {
  apiKey: "AIzaSyAC8P9-KJwC_nq-v-zTFDDzjAjBuS6Npq4",
  projectId: "tennisclubmanager-2d4c2"
};

const app = initializeApp(newConfig);
const db = getFirestore(app);

async function check() {
  try {
    const ref = await addDoc(collection(db, 'test'), { hello: 'world' });
    console.log("Write success!", ref.id);
    await deleteDoc(ref);
    console.log("Delete success!");
  } catch (e) {
    console.error("Write failed:", e.message);
  }
}
check().then(() => process.exit(0));
