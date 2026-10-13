# 오늘 하루

일상을 가볍게 **끄적이거나**, 하루를 한 점의 작품처럼 **전시실 벽에 걸어 두는** 웹사이트입니다.
Firebase(Hosting · Authentication · Firestore · Storage)만으로 동작하며, 빌드 과정 없는 순수 HTML/CSS/JS입니다.

## 화면

| 경로 | 설명 |
| --- | --- |
| `#/` 끄적임 | 오늘 날짜와 하루 한 번 바뀌는 질문, 공개된 끄적임 모음 |
| `#/gallery` 전시실 | 어두운 전시장. 액자에 걸린 작품을 가로로 걸으며 감상 (휠/스와이프) |
| `#/post/:id` | 끄적임은 종이 한 장, 전시는 스포트라이트 + 작품 캡션 + 작가 노트 |
| `#/write` | 끄적임/전시 전환, 날짜, 오늘의 날씨, 재료(전시), 사진, 나만 보기 |
| `#/me` 내 기록 | 비공개 글까지 포함한 나의 하루들, 월별 타임라인 |

사진 없이 전시하면 제목과 글이 색면 캔버스 위에 그대로 작품이 됩니다.

## 구조

```
public/
  index.html
  css/style.css
  js/firebase-config.js   ← 내 Firebase 설정값
  js/firebase.js          ← 인증 / Firestore / Storage 접근
  js/app.js               ← 라우터와 화면
firestore.rules           ← 공개 글은 누구나, 비공개·수정·삭제는 본인만
firestore.indexes.json    ← 목록 조회용 복합 색인
storage.rules             ← 본인 폴더에만 10MB 이하 이미지 업로드
firebase.json
```

### Firestore `posts` 문서

| 필드 | 값 |
| --- | --- |
| `uid`, `authorName` | 작성자 |
| `type` | `note`(끄적임) · `exhibit`(전시) |
| `title`, `body` | 제목, 본문(전시는 작가 노트) |
| `date` | 그날 날짜 `YYYY-MM-DD` |
| `mood` | `sunny` `cloudy` `rainy` `snowy` `windy` `night` |
| `medium` | 전시 재료 (예: "커피, 오후의 햇빛") |
| `imageUrl`, `imagePath` | Storage 사진 |
| `visibility` | `public` · `private` |
| `createdAt`, `updatedAt` | 서버 시각 |

## 시작하기

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트를 만들고
   - **Authentication** → 로그인 방법 → **Google** 사용 설정
   - **Firestore Database** 생성
   - **Storage** 시작 (Blaze 요금제가 필요할 수 있어요)
2. 프로젝트 설정 → 내 앱 → **웹 앱 추가** 후 나오는 설정값을
   `public/js/firebase-config.js`에 붙여 넣습니다.
3. `.firebaserc`의 `your-firebase-project-id`를 내 프로젝트 ID로 바꿉니다.
4. 배포

   ```bash
   npm install
   npx firebase login
   npx firebase deploy
   ```

   규칙과 색인까지 함께 올라갑니다. 색인 생성에는 몇 분이 걸릴 수 있어요.

### 로컬에서 실험하기

`public/js/firebase-config.js`에서 `useEmulators = true`로 바꾸고:

```bash
npm run dev    # http://localhost:5000, 에뮬레이터 UI http://localhost:4000
```
