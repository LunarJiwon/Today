// Firebase 콘솔 > 프로젝트 설정 > 내 앱(웹)에서 복사한 값으로 교체하세요.
// 이 값들은 공개되어도 괜찮습니다. 데이터 보호는 firestore.rules / storage.rules가 담당합니다.
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-firebase-project-id.firebaseapp.com",
  projectId: "your-firebase-project-id",
  storageBucket: "your-firebase-project-id.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

// 로컬에서 `firebase emulators:start`로 테스트할 때 true로 바꾸세요.
export const useEmulators = false;
