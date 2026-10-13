import * as fb from "./firebase.js";

const app = document.getElementById("app");
let currentUser = null;
let authReady = false;

// ── 유틸 ────────────────────────────────────────────

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const todayStr = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function formatDate(ymd, { weekday = true } = {}) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  const w = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${y}년 ${m}월 ${d}일${weekday ? ` ${w}요일` : ""}`;
}

const formatDot = (ymd = "") => ymd.replaceAll("-", ". ");

function excerpt(text = "", n = 120) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > n ? flat.slice(0, n) + "…" : flat;
}

function hash(str = "") {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

const MOODS = [
  { id: "sunny", icon: "☀️", label: "맑음" },
  { id: "cloudy", icon: "⛅", label: "흐림" },
  { id: "rainy", icon: "🌧️", label: "비" },
  { id: "snowy", icon: "❄️", label: "눈" },
  { id: "windy", icon: "🍃", label: "바람" },
  { id: "night", icon: "🌙", label: "깊은 밤" },
];
const moodOf = (id) => MOODS.find((m) => m.id === id);

const PROMPTS = [
  "오늘 가장 오래 바라본 것은 무엇이었나요?",
  "오늘의 소리 하나를 적어 볼까요?",
  "오늘 나를 웃게 한 아주 작은 일은?",
  "지금 창밖은 어떤 색인가요?",
  "오늘 먹은 것 중 기억에 남는 맛은?",
  "오늘 하루에 제목을 붙인다면?",
  "오늘 누군가에게 하지 못한 말이 있나요?",
  "오늘의 냄새를 떠올려 보세요.",
  "오늘 걸었던 길을 그려 본다면?",
  "내일의 나에게 남기고 싶은 한 줄은?",
  "오늘 손에 가장 많이 쥐고 있던 것은?",
  "오늘 하루를 한 점의 그림으로 건다면, 어떤 그림일까요?",
];

function todaysPrompt() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const day = Math.floor((now - start) / 86400000);
  return PROMPTS[day % PROMPTS.length];
}

// 이미지가 없는 전시 작품을 위한 캔버스 색
const CANVASES = [
  ["#e9dfcf", "#3b2f2a"],
  ["#c8553d", "#fbf3e8"],
  ["#2f4858", "#f2e9dc"],
  ["#86a789", "#1f2a22"],
  ["#f2c14e", "#2b2118"],
  ["#5b4b8a", "#f4efe6"],
  ["#d9a5b3", "#2c1d22"],
];

function artwork(post, { large = false } = {}) {
  if (post.imageUrl) {
    return `<img class="artwork-img" src="${esc(post.imageUrl)}" alt="${esc(post.title)}" loading="lazy" />`;
  }
  const [bg, fg] = CANVASES[hash(post.id) % CANVASES.length];
  return `
    <div class="artwork-text ${large ? "is-large" : ""}" style="--bg:${bg};--fg:${fg}">
      <span class="artwork-title">${esc(post.title || "무제")}</span>
      <span class="artwork-body">${esc(excerpt(post.body, large ? 220 : 70))}</span>
    </div>`;
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2600);
}

function friendlyError(err) {
  console.error(err);
  if (err?.code === "permission-denied") return "권한이 없어요.";
  if (err?.code === "failed-precondition") return "Firestore 색인을 준비 중이에요. 잠시 후 다시 시도해 주세요.";
  if (err?.code === "auth/popup-closed-by-user") return "로그인이 취소되었어요.";
  return "문제가 생겼어요. 잠시 후 다시 시도해 주세요.";
}

const loading = () => `<div class="loading"><span></span><span></span><span></span></div>`;

const empty = (msg, cta = "") => `<div class="empty"><p>${msg}</p>${cta}</div>`;

// ── 뷰: 끄적임(홈) ────────────────────────────────────

async function viewHome() {
  const today = todayStr();
  app.innerHTML = `
    <section class="hero">
      <p class="hero-date">${formatDate(today)}</p>
      <h1 class="hero-title">오늘 하루,<br/>어땠나요?</h1>
      <p class="hero-prompt">“${esc(todaysPrompt())}”</p>
      <div class="hero-actions">
        ${
          currentUser
            ? `<a class="btn" href="#/write">오늘을 끄적이기</a>
               <a class="btn btn-ghost" href="#/write?type=exhibit">한 점 걸어두기</a>`
            : `<button class="btn" data-action="login">로그인하고 시작하기</button>
               <a class="btn btn-ghost" href="#/gallery">전시실 둘러보기</a>`
        }
      </div>
    </section>
    <section class="section">
      <h2 class="section-title">최근의 끄적임</h2>
      <div id="feed" class="notes">${loading()}</div>
    </section>`;

  const feed = document.getElementById("feed");
  try {
    const list = await fb.listPublic({ type: "note", max: 30 });
    feed.innerHTML = list.length
      ? list.map(noteCard).join("")
      : empty("아직 공개된 끄적임이 없어요.", currentUser ? `<a class="btn" href="#/write">첫 글 쓰기</a>` : "");
  } catch (err) {
    feed.innerHTML = empty(friendlyError(err));
  }
}

function noteCard(p) {
  const mood = moodOf(p.mood);
  const tilt = (hash(p.id) % 5) - 2;
  return `
    <a class="note-card" href="#/post/${p.id}" style="--tilt:${tilt * 0.4}deg">
      ${p.imageUrl ? `<img class="note-thumb" src="${esc(p.imageUrl)}" alt="" loading="lazy" />` : ""}
      <div class="note-meta">
        <span>${formatDot(p.date)}</span>
        ${mood ? `<span title="${mood.label}">${mood.icon}</span>` : ""}
      </div>
      <h3 class="note-title">${esc(p.title || "무제")}</h3>
      <p class="note-excerpt">${esc(excerpt(p.body, 140))}</p>
      <span class="note-author">— ${esc(p.authorName || "익명")}</span>
    </a>`;
}

// ── 뷰: 전시실 ──────────────────────────────────────

async function viewGallery() {
  document.body.classList.add("is-dark");
  app.innerHTML = `
    <section class="gallery-intro">
      <p class="eyebrow">상설 전시</p>
      <h1>오늘 하루 展</h1>
      <p class="gallery-lede">평범한 하루들이 한 점씩 벽에 걸립니다.<br/>천천히, 옆으로 걸으며 감상하세요.</p>
    </section>
    <section class="wall-wrap">
      <div id="wall" class="wall">${loading()}</div>
    </section>
    <p class="wall-hint">← 스크롤하여 다음 작품으로 →</p>`;

  const wall = document.getElementById("wall");
  try {
    const list = await fb.listPublic({ type: "exhibit", max: 60 });
    if (!list.length) {
      wall.innerHTML = empty(
        "전시실이 아직 비어 있어요.",
        currentUser ? `<a class="btn" href="#/write?type=exhibit">첫 작품 걸기</a>` : ""
      );
      return;
    }
    wall.innerHTML = list
      .map(
        (p, i) => `
        <figure class="exhibit" style="--delay:${Math.min(i, 8) * 80}ms">
          <a class="frame" href="#/post/${p.id}">${artwork(p)}</a>
          <figcaption class="wall-label">
            <span class="label-no">No. ${String(list.length - i).padStart(3, "0")}</span>
            <strong>${esc(p.title || "무제")}</strong>
            <span>${esc(p.authorName || "익명")}, ${formatDot(p.date)}</span>
            ${p.medium ? `<span class="label-medium">${esc(p.medium)}</span>` : ""}
          </figcaption>
        </figure>`
      )
      .join("");
    enableWallDrag(wall);
  } catch (err) {
    wall.innerHTML = empty(friendlyError(err));
  }
}

// 세로 휠과 드래그로도 전시 벽을 가로로 걸어갈 수 있게
function enableWallDrag(wall) {
  wall.addEventListener(
    "wheel",
    (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && wall.scrollWidth > wall.clientWidth) {
        const atStart = wall.scrollLeft <= 0 && e.deltaY < 0;
        const atEnd = wall.scrollLeft + wall.clientWidth >= wall.scrollWidth - 1 && e.deltaY > 0;
        if (!atStart && !atEnd) {
          e.preventDefault();
          wall.scrollLeft += e.deltaY;
        }
      }
    },
    { passive: false }
  );
}

// ── 뷰: 글 하나 ─────────────────────────────────────

async function viewPost(id) {
  app.innerHTML = loading();
  let post;
  try {
    post = await fb.getPost(id);
  } catch (err) {
    app.innerHTML = empty(friendlyError(err));
    return;
  }
  if (!post) {
    app.innerHTML = empty("찾을 수 없는 글이에요.", `<a class="btn" href="#/">돌아가기</a>`);
    return;
  }

  const mine = currentUser && currentUser.uid === post.uid;
  const mood = moodOf(post.mood);
  const ownerTools = mine
    ? `<div class="owner-tools">
         ${post.visibility === "private" ? `<span class="badge">나만 보기</span>` : ""}
         <a class="btn btn-small btn-ghost" href="#/write/${post.id}">고치기</a>
         <button class="btn btn-small btn-ghost danger" data-action="delete">지우기</button>
       </div>`
    : "";

  if (post.type === "exhibit") {
    document.body.classList.add("is-dark");
    app.innerHTML = `
      <article class="spotlight">
        <div class="spotlight-frame frame">${artwork(post, { large: true })}</div>
        <aside class="spotlight-label">
          <p class="eyebrow">${formatDate(post.date, { weekday: false })}</p>
          <h1>${esc(post.title || "무제")}</h1>
          <p class="label-artist">${esc(post.authorName || "익명")}</p>
          ${post.medium ? `<p class="label-medium">${esc(post.medium)}</p>` : ""}
          ${mood ? `<p class="label-medium">그날의 날씨 · ${mood.icon} ${mood.label}</p>` : ""}
          ${post.body ? `<div class="artist-note"><h2>작가 노트</h2><p>${esc(post.body)}</p></div>` : ""}
          ${ownerTools}
          <a class="back-link" href="#/gallery">← 전시실로</a>
        </aside>
      </article>`;
  } else {
    app.innerHTML = `
      <article class="paper">
        <header class="paper-head">
          <p class="paper-date">${formatDate(post.date)} ${mood ? `· ${mood.icon} ${mood.label}` : ""}</p>
          <h1>${esc(post.title || "무제")}</h1>
          <p class="paper-author">${esc(post.authorName || "익명")}</p>
        </header>
        ${post.imageUrl ? `<img class="paper-img" src="${esc(post.imageUrl)}" alt="" />` : ""}
        <div class="paper-body">${esc(post.body)}</div>
        ${ownerTools}
        <a class="back-link" href="#/">← 끄적임으로</a>
      </article>`;
  }

  app.querySelector("[data-action=delete]")?.addEventListener("click", async () => {
    if (!confirm("이 기록을 지울까요? 되돌릴 수 없어요.")) return;
    try {
      await fb.removePost(post);
      toast("지웠어요.");
      location.hash = "#/me";
    } catch (err) {
      toast(friendlyError(err));
    }
  });
}

// ── 뷰: 쓰기 / 고치기 ───────────────────────────────

async function viewWrite(id, params) {
  if (!currentUser) {
    app.innerHTML = empty("글을 쓰려면 로그인이 필요해요.", `<button class="btn" data-action="login">로그인</button>`);
    return;
  }

  let post = {
    type: params.get("type") === "exhibit" ? "exhibit" : "note",
    title: "",
    body: "",
    date: todayStr(),
    mood: "",
    medium: "",
    visibility: "public",
  };

  if (id) {
    app.innerHTML = loading();
    try {
      const existing = await fb.getPost(id);
      if (!existing || existing.uid !== currentUser.uid) {
        app.innerHTML = empty("고칠 수 없는 글이에요.");
        return;
      }
      post = existing;
    } catch (err) {
      app.innerHTML = empty(friendlyError(err));
      return;
    }
  }

  app.innerHTML = `
    <form class="writer" id="writer" data-type="${post.type}">
      <div class="type-switch" role="radiogroup" aria-label="기록 방식">
        <label><input type="radio" name="type" value="note" ${post.type === "note" ? "checked" : ""}/><span>끄적임</span></label>
        <label><input type="radio" name="type" value="exhibit" ${post.type === "exhibit" ? "checked" : ""}/><span>전시</span></label>
      </div>
      <p class="type-hint" data-for="note">마음 가는 대로, 오늘을 짧게 적어 두세요.</p>
      <p class="type-hint" data-for="exhibit">오늘 하루를 한 점의 작품처럼 전시실 벽에 걸어 둡니다. 사진이 없으면 글이 그대로 작품이 돼요.</p>

      <input class="writer-title" name="title" maxlength="100" placeholder="${post.type === "exhibit" ? "작품명" : "제목 (비워 두면 무제)"}" value="${esc(post.title)}" />

      <div class="writer-row">
        <label class="field">
          <span>날짜</span>
          <input type="date" name="date" value="${esc(post.date)}" required />
        </label>
        <label class="field only-exhibit">
          <span>재료</span>
          <input name="medium" maxlength="60" placeholder="예) 커피, 오후의 햇빛, 휴대폰 카메라" value="${esc(post.medium || "")}" />
        </label>
      </div>

      <fieldset class="moods">
        <legend>오늘의 날씨</legend>
        ${MOODS.map(
          (m) => `<label><input type="radio" name="mood" value="${m.id}" ${post.mood === m.id ? "checked" : ""}/><span>${m.icon} ${m.label}</span></label>`
        ).join("")}
      </fieldset>

      <textarea class="writer-body" name="body" maxlength="20000" rows="12"
        placeholder="${post.type === "exhibit" ? "작가 노트 — 이 작품에 담긴 하루" : esc(todaysPrompt())}">${esc(post.body)}</textarea>

      <div class="image-field">
        <label class="btn btn-ghost btn-small">
          사진 ${post.imageUrl ? "바꾸기" : "더하기"}
          <input type="file" name="image" accept="image/*" hidden />
        </label>
        <div class="image-preview" id="preview">
          ${post.imageUrl ? `<img src="${esc(post.imageUrl)}" alt="" /><button type="button" class="btn btn-small btn-ghost" data-action="remove-image">사진 빼기</button>` : ""}
        </div>
      </div>

      <div class="writer-foot">
        <label class="toggle">
          <input type="checkbox" name="private" ${post.visibility === "private" ? "checked" : ""}/>
          <span>나만 보기</span>
        </label>
        <button class="btn" type="submit">${id ? "고쳐 두기" : "남겨 두기"}</button>
      </div>
    </form>`;

  const form = document.getElementById("writer");
  const preview = document.getElementById("preview");
  let newFile = null;
  let removeImage = false;

  form.addEventListener("change", (e) => {
    if (e.target.name === "type") {
      form.dataset.type = e.target.value;
      form.elements.title.placeholder = e.target.value === "exhibit" ? "작품명" : "제목 (비워 두면 무제)";
      form.elements.body.placeholder = e.target.value === "exhibit" ? "작가 노트 — 이 작품에 담긴 하루" : todaysPrompt();
    }
    if (e.target.name === "image" && e.target.files[0]) {
      newFile = e.target.files[0];
      if (newFile.size > 10 * 1024 * 1024) {
        toast("사진은 10MB 이하로 올려 주세요.");
        newFile = null;
        e.target.value = "";
        return;
      }
      removeImage = false;
      preview.innerHTML = `<img src="${URL.createObjectURL(newFile)}" alt="" /><button type="button" class="btn btn-small btn-ghost" data-action="remove-image">사진 빼기</button>`;
    }
  });

  preview.addEventListener("click", (e) => {
    if (e.target.dataset.action === "remove-image") {
      newFile = null;
      removeImage = true;
      form.elements.image.value = "";
      preview.innerHTML = "";
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submit = form.querySelector("[type=submit]");
    const fd = new FormData(form);
    const type = fd.get("type");
    const data = {
      type,
      title: fd.get("title").trim() || "무제",
      body: fd.get("body"),
      date: fd.get("date") || todayStr(),
      mood: fd.get("mood") || "",
      medium: type === "exhibit" ? fd.get("medium").trim() : "",
      visibility: fd.get("private") ? "private" : "public",
    };

    if (!data.body.trim() && !newFile && !(post.imageUrl && !removeImage)) {
      toast("글이나 사진 중 하나는 있어야 해요.");
      return;
    }

    submit.disabled = true;
    submit.textContent = "남기는 중…";
    try {
      if (newFile) {
        Object.assign(data, await fb.uploadImage(currentUser.uid, newFile));
      } else if (removeImage) {
        Object.assign(data, { imageUrl: "", imagePath: "" });
      }
      // 이전 사진이 교체되거나 빠졌으면 저장소에서도 정리
      if ((newFile || removeImage) && post.imagePath) await fb.deleteImage(post.imagePath);

      const postId = id ? (await fb.updatePost(id, data), id) : await fb.createPost(currentUser, data);
      toast(type === "exhibit" ? "작품이 걸렸어요." : "오늘이 남았어요.");
      location.hash = `#/post/${postId}`;
    } catch (err) {
      toast(friendlyError(err));
      submit.disabled = false;
      submit.textContent = id ? "고쳐 두기" : "남겨 두기";
    }
  });
}

// ── 뷰: 내 기록 ─────────────────────────────────────

async function viewMine() {
  if (!currentUser) {
    app.innerHTML = empty("로그인하면 내 기록을 모아 볼 수 있어요.", `<button class="btn" data-action="login">로그인</button>`);
    return;
  }
  app.innerHTML = `
    <section class="section">
      <h1 class="section-title">${esc(currentUser.displayName || "나")}의 하루들</h1>
      <div id="mine" class="timeline">${loading()}</div>
    </section>`;

  const el = document.getElementById("mine");
  try {
    const list = await fb.listMine(currentUser.uid);
    if (!list.length) {
      el.innerHTML = empty("아직 남긴 하루가 없어요.", `<a class="btn" href="#/write">오늘부터 시작하기</a>`);
      return;
    }
    // 그날의 날짜 순으로 정렬해 월별로 묶기
    list.sort((a, b) => b.date.localeCompare(a.date));
    const groups = {};
    for (const p of list) (groups[p.date.slice(0, 7)] ||= []).push(p);
    el.innerHTML = Object.entries(groups)
      .map(([ym, items]) => {
        const [y, m] = ym.split("-");
        return `
          <div class="month">
            <h2 class="month-title">${y}년 ${Number(m)}월</h2>
            <ul>
              ${items
                .map((p) => {
                  const mood = moodOf(p.mood);
                  return `
                  <li>
                    <a href="#/post/${p.id}" class="timeline-item">
                      <span class="timeline-day">${Number(p.date.slice(8))}</span>
                      <span class="timeline-main">
                        <strong>${esc(p.title || "무제")}</strong>
                        <small>${esc(excerpt(p.body, 60))}</small>
                      </span>
                      <span class="timeline-tags">
                        ${mood ? mood.icon : ""}
                        <span class="badge">${p.type === "exhibit" ? "전시" : "끄적임"}</span>
                        ${p.visibility === "private" ? `<span class="badge badge-muted">나만</span>` : ""}
                      </span>
                    </a>
                  </li>`;
                })
                .join("")}
            </ul>
          </div>`;
      })
      .join("");
  } catch (err) {
    el.innerHTML = empty(friendlyError(err));
  }
}

// ── 라우터 ──────────────────────────────────────────

function route() {
  if (!authReady) return;
  document.body.classList.remove("is-dark");
  window.scrollTo(0, 0);

  const [path, qs = ""] = location.hash.replace(/^#/, "").split("?");
  const params = new URLSearchParams(qs);
  const parts = path.split("/").filter(Boolean);

  const section = parts[0] || "home";
  document.querySelectorAll("[data-nav]").forEach((a) => {
    a.classList.toggle("is-active", a.dataset.nav === section);
  });

  switch (parts[0]) {
    case undefined:
      return viewHome();
    case "gallery":
      return viewGallery();
    case "post":
      return viewPost(parts[1]);
    case "write":
      return viewWrite(parts[1], params);
    case "me":
      return viewMine();
    default:
      app.innerHTML = empty("길을 잃었어요.", `<a class="btn" href="#/">처음으로</a>`);
  }
}

window.addEventListener("hashchange", route);

document.addEventListener("click", async (e) => {
  if (e.target.closest("[data-action=login], #login-btn")) {
    try {
      await fb.login();
    } catch (err) {
      toast(friendlyError(err));
    }
  }
  if (e.target.closest("#logout-btn")) {
    await fb.logout();
    toast("다음에 또 만나요.");
    location.hash = "#/";
  }
});

fb.onUser((user) => {
  currentUser = user;
  authReady = true;
  document.querySelectorAll(".auth-only").forEach((el) => (el.hidden = !user));
  document.getElementById("login-btn").hidden = !!user;
  document.getElementById("logout-btn").hidden = !user;
  route();
});

app.innerHTML = loading();
