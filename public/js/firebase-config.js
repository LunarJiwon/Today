// Firebase 웹 앱 설정값. 공개되어도 괜찮습니다.
// 데이터 보호는 firestore.rules / storage.rules가 담당합니다.
export const firebaseConfig = {
  apiKey: "AIzaSyBl72YsfNhoRldmAuaC4DaL0LeQCMixmZo",
  authDomain: "today-f535f.firebaseapp.com",
  projectId: "today-f535f",
  storageBucket: "today-f535f.firebasestorage.app",
  messagingSenderId: "680027473586",
  appId: "1:680027473586:web:3e346b6685ef69cb376bab",
  measurementId: "G-QGWVPDCL71",
};

// 로컬에서 `firebase emulators:start`로 테스트할 때 true로 바꾸세요.
export const useEmulators = false;
