import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  connectAuthEmulator,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  connectFirestoreEmulator,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  connectStorageEmulator,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-storage.js";
import { firebaseConfig, useEmulators } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

if (useEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}

const posts = collection(db, "posts");

// ── 인증 ────────────────────────────────────────────

export function login() {
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export function logout() {
  return signOut(auth);
}

export function onUser(callback) {
  return onAuthStateChanged(auth, callback);
}

// ── 글 ──────────────────────────────────────────────

const toPost = (snap) => ({ id: snap.id, ...snap.data() });

export async function listPublic({ type, max = 50 } = {}) {
  const filters = [where("visibility", "==", "public")];
  if (type) filters.push(where("type", "==", type));
  const snap = await getDocs(query(posts, ...filters, orderBy("createdAt", "desc"), limit(max)));
  return snap.docs.map(toPost);
}

export async function listMine(uid, max = 100) {
  const snap = await getDocs(
    query(posts, where("uid", "==", uid), orderBy("createdAt", "desc"), limit(max))
  );
  return snap.docs.map(toPost);
}

export async function getPost(id) {
  const snap = await getDoc(doc(posts, id));
  return snap.exists() ? toPost(snap) : null;
}

export async function createPost(user, data) {
  const ref = await addDoc(posts, {
    ...data,
    uid: user.uid,
    authorName: user.displayName || "익명",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updatePost(id, data) {
  await updateDoc(doc(posts, id), { ...data, updatedAt: serverTimestamp() });
}

export async function removePost(post) {
  if (post.imagePath) {
    await deleteObject(storageRef(storage, post.imagePath)).catch(() => {});
  }
  await deleteDoc(doc(posts, post.id));
}

// ── 이미지 ──────────────────────────────────────────

export async function uploadImage(uid, file) {
  const safeName = file.name.replace(/[^\w.-]/g, "_");
  const path = `users/${uid}/${Date.now()}_${safeName}`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file, { contentType: file.type });
  return { imagePath: path, imageUrl: await getDownloadURL(ref) };
}

export async function deleteImage(path) {
  if (path) await deleteObject(storageRef(storage, path)).catch(() => {});
}
