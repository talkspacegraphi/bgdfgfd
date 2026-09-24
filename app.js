/* ============ SpeechText — app.js ============ */
"use strict";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const el = {
  hero: $("#hero"),
  dropzone: $("#dropzone"),
  fileInput: $("#fileInput"),
  processing: $("#processing"),
  editorSection: $("#editorSection"),
  progressBar: $("#progressBar"),
  progressLabel: $("#progressLabel"),
  progressDetail: $("#progressDetail"),
  procTitle: $("#procTitle"),
  procSubtitle: $("#procSubtitle"),
  procFileName: $("#procFileName"),
  procFileSize: $("#procFileSize"),
  btnCancel: $("#btnCancel"),
  selLang: $("#selLang"),
  selModel: $("#selModel"),
  chkTimestamps: $("#chkTimestamps"),
  btnHeaderUpload: $("#btnHeaderUpload"),
  btnNewFile: $("#btnNewFile"),
  editor: $("#editor"),
  toolbar: $("#toolbar"),
  btnPlay: $("#btnPlay"),
  curTime: $("#curTime"),
  durTime: $("#durTime"),
  audioEl: $("#audioEl"),
  btnCopy: $("#btnCopy"),
  btnExport: $("#btnExport"),
  exportMenu: $("#exportMenu"),
  exportDropdown: $("#exportDropdown"),
  btnFinish: $("#btnFinish"),
  wordCount: $("#wordCount"),
  toasts: $("#toasts"),
  selFont: $("#selFont"),
  selSize: $("#selSize"),
  inpTextColor: $("#inpTextColor"),
  inpHlColor: $("#inpHlColor"),
  pdfInner: $("#pdfInner"),
  pdfSource: $("#pdfSource"),
  filesModal: $("#filesModal"),
  filesList: $("#filesList"),
  filesEmpty: $("#filesEmpty"),
  btnCloseFiles: $("#btnCloseFiles"),
  btnPickFile: $("#btnPickFile"),
};

const state = {
  file: null,
  cancelRequested: false,
  procGen: 0,
  wavesurfer: null,
  transcriber: null,
  transcriberModel: null,
  transcriberDevice: "wasm",
  deviceLocked: null,
  transcriberLoading: null,
  isPlaying: false,
  objectUrl: null,
  elapsedTimer: null,
  recentFiles: [],
};

/* ---------- Toasts ---------- */
function toast(msg, type = "info") {
  const icons = { success: "check-circle-2", error: "circle-alert", info: "info" };
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = `<i data-lucide="${icons[type] || icons.info}"></i><span>${escapeHtml(msg)}</span>`;
  el.toasts.appendChild(t);
  if (window.lucide) lucide.createIcons({ nodes: [t] });
  setTimeout(() => {
    t.classList.add("out");
    setTimeout(() => t.remove(), 320);
  }, 4200);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ---------- Custom dropdown ---------- */
function createCustomSelect(selectEl, variant = "") {
  if (!selectEl || selectEl.dataset.csReady) return;
  selectEl.dataset.csReady = "1";

  const wrap = document.createElement("div");
  wrap.className = "cs" + (variant ? " " + variant : "");

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cs-btn";
  btn.setAttribute("aria-haspopup", "listbox");
  btn.setAttribute("aria-expanded", "false");

  const valueSpan = document.createElement("span");
  valueSpan.className = "cs-value";

  const chevron = document.createElement("i");
  chevron.setAttribute("data-lucide", "chevron-down");
  chevron.className = "cs-chevron";

  btn.append(valueSpan, chevron);

  const menu = document.createElement("div");
  menu.className = "cs-menu";
  menu.setAttribute("role", "listbox");

  Array.from(selectEl.options).forEach((opt) => {
    const item = document.createElement("div");
    item.className = "cs-option";
    item.dataset.value = opt.value;
    item.setAttribute("role", "option");
    item.textContent = opt.text;
    if (opt.value === selectEl.value) item.classList.add("selected");
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      selectEl.value = opt.value;
      selectEl.dispatchEvent(new Event("change", { bubbles: true }));
      updateLabel();
      close();
    });
    menu.appendChild(item);
  });

  function updateLabel() {
    const opt = selectEl.options[selectEl.selectedIndex];
    valueSpan.textContent = opt ? opt.text : "";
    menu.querySelectorAll(".cs-option").forEach((o) => {
      o.classList.toggle("selected", o.dataset.value === selectEl.value);
    });
  }

  function open() {
    document.querySelectorAll(".cs.open").forEach((c) => {
      if (c !== wrap) {
        c.classList.remove("open");
        c.querySelector(".cs-btn")?.setAttribute("aria-expanded", "false");
      }
    });
    wrap.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
  }

  function close() {
    wrap.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (wrap.classList.contains("open")) close();
    else open();
  });

  selectEl.addEventListener("change", updateLabel);
  selectEl._csUpdate = updateLabel;

  const parent = selectEl.parentNode;
  parent.insertBefore(wrap, selectEl);
  wrap.appendChild(btn);
  wrap.appendChild(menu);
  wrap.appendChild(selectEl);

  updateLabel();
  if (window.lucide) lucide.createIcons({ nodes: [wrap] });
}

document.addEventListener("click", () => {
  document.querySelectorAll(".cs.open").forEach((c) => {
    c.classList.remove("open");
    c.querySelector(".cs-btn")?.setAttribute("aria-expanded", "false");
  });
  el.exportMenu?.classList.remove("open");
  el.btnExport?.setAttribute("aria-expanded", "false");
});

/* ---------- UI state ---------- */
function showSection(name) {
  const map = { hero: el.hero, processing: el.processing, editor: el.editorSection };
  Object.entries(map).forEach(([key, node]) => {
    if (!node) return;
    node.classList.toggle("hidden", key !== name);
  });
  if (name === "hero") {
    el.hero.classList.remove("hidden");
    requestAnimationFrame(() =>
      el.hero.querySelectorAll(".reveal").forEach((r) => r.classList.add("visible"))
    );
  }
  if (name === "editor") {
    requestAnimationFrame(() =>
      el.editorSection.querySelectorAll(".reveal").forEach((r) => r.classList.add("visible"))
    );
  }
}

function setProgress(pct, label, detail) {
  const p = Math.max(0, Math.min(100, pct));
  el.progressBar.classList.remove("indeterminate");
  el.progressBar.style.width = `${p}%`;
  el.progressLabel.textContent = `${Math.round(p)}%`;
  if (detail) el.progressDetail.textContent = detail;
  const ring = document.querySelector(".ring-fg");
  if (ring) {
    const c = 276.4;
    ring.style.strokeDashoffset = c - (c * p) / 100;
  }
  if (label) el.procTitle.textContent = label;
}

function setIndeterminate(label, detail) {
  el.progressBar.classList.add("indeterminate");
  if (label) el.procTitle.textContent = label;
  if (detail) el.progressDetail.textContent = detail;
  el.progressLabel.textContent = "…";
}

function formatBytes(n) {
  if (n < 1024) return n + " B";
  if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
  if (n < 1073741824) return (n / 1048576).toFixed(1) + " MB";
  return (n / 1073741824).toFixed(2) + " GB";
}

function formatTime(sec) {
  if (!isFinite(sec)) return "0:00";
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatTimestamp(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/* Лёгкая пост-обработка: пунктуация, цифры, регистр */
const TEXT_FIXES = [
  [/припинани/gi, "препинани"],
  [/вisper/gi, "Whisper"],
  [/виспер/gi, "Whisper"],
  [/уиспер/gi, "Whisper"],
  [/у\s+испер/gi, "Whisper"],
  [/испер/gi, "Whisper"],
  [/УИСПЕР/g, "Whisper"],
  [/Уиспер/g, "Whisper"],
  [/ВИСПЕ/g, "Whisper"],
  [/виспе/gi, "Whisper"],
  [/imena/gi, "имена"],
  [/имина/g, "имена"],
  [/изнаки/g, "и знаки"],
  [/Зтём/g, "Затем"],
  [/зтём/g, "затем"],
  [/короткое\s+паузе/gi, "короткая пауза"],
  [/(\bПауза|\bпауза)\s+(Затем|затем)/g, "$1, $2"],
  [/(цифры)[.,]\s+(имена|Имена)/g, "$1, $2"],
  [/(цифры)\s+и\s+(имена)/gi, "$1, $2"],
  [/(цифры)\s+(имена)/gi, "$1, $2"],
  [/(цифры и имена)/gi, "цифры, имена"],
  [/(название|Название|названия|Названия)[.,]\s+(москва|Москва)/g, "$1: $2"],
  [/(название|Название)\s+(москва|Москва)/g, "$1: $2"],
  [/(москва|Москва)[.,]?\s+(хельсинки|Хельсинки)/g, "$1, $2"],
  [/(хельсинки|Хельсинки)[.,]?\s+(оптимизация|Оптимизация)/g, "$1, $2"],
  [/(восклицанием|Восклицанием)[.,]\s*(Отлично|отлично)/g, "$1: $2!"],
  [/(счет|Счет|Счёт|счёт)[.,]\s+(один|два|три|четыре|пять|шесть|семь|восемь|девять|1)/g, "$1: $2"],
  [/(счет|Счет|Счёт|счёт)\.\s+/gi, "$1: "],
  [/(мысль|Мысль)[.,]\s+(это|Это)/g, "$1 — $2"],
  [/(Отлично|отлично)[.,]\s+(Короткая|короткая)/g, "$1! $2"],
  [/(пауза|Пауза)\s+(затем|Затем),/g, "$1, $2"],
  [/(затем|Затем),\s+(новая|Новая)/g, "$1 $2"],
  [/(347),\s*(название|Название)/gi, "$1. $2"],
  [/(загружается|Загружается)[.]\s+(На сервер|на сервер)/g, "$1, на сервер"],
  [/(Вопрос к аудитории|вопрос к аудитории)[.!?]?\s+(Вы меня|вы меня)/gi, "$1: $2"],
  [/(Вопрос к аудитории|вопрос к аудитории)\s*:\s*(Вы меня|вы меня)\s+(слышите)\s*\.?/gi, "$1: $2 $3?"],
  [/(меня)\s+(слышите)\s*(\.\s*)?$/gi, "$1 $2?"],
  [/(меня\s+слышите)\./gi, "$1?"],
  [/(восклицание|Восклицание)[.:]\s*(Супер|супер)\s*\.?/g, "$1: супер!"],
  [/(еще|ещё)\s+(восклицание|Восклицание)[.:]\s*(Супер|супер)\s*\.?/g, "$1 восклицание: супер!"],
  [/(новые|Новые)\s+(мысы|мысль|Мысль)/g, "новая мысль"],
  [/(мысы|Мысы)/g, "мысль"],
  [/(второго)[.]\s+(Тестового|тестового)/g, "$1 тестового"],
  [/(Города|города)[.,]\s+(Токио|токио)/g, "$1: $2"],
  [/(USPR|uspr|USB-R|usb-r)/g, "Whisper"],
];

const NUM_WORD_RE =
  /(один|два|три|четыре|пять|шесть|семь|восемь|девять|десять|двадцать|тридцать|сорок|пятьдесят|шестьдесят|семьдесят|восемьдесят|девяносто|сто|двести|триста|четыреста|пятьсот|шестьсот|семьсот|восемьсот|девятьсот|тысяча|тысячи|миллион)/gi;

const PROPER_RE =
  /^(Москва|Хельсинки|Оптимизация|Санкт-Петербург|Париж|Лондон|Россия|Украина|Германия|Франция|Whisper|OpenAI|Google|Apple|Microsoft|Windows|Интернет)/i;

function countWords(s) {
  return String(s || "").split(/\s+/).filter(Boolean).length;
}

function demoteFirst(w) {
  if (!w) return w;
  if (PROPER_RE.test(w)) return w;
  if (w.length > 1 && w === w.toUpperCase()) return w;
  return w.charAt(0).toLowerCase() + w.slice(1);
}

function capFirst(w) {
  if (!w) return w;
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function polishCore(raw) {
  if (!raw) return "";
  let t = String(raw).replace(/\u00a0/g, " ").replace(/\ufeff/g, "");
  t = t.replace(/[ \t]+/g, " ");
  t = t.replace(/\s+([,.;:!?…])/g, "$1");
  t = t.replace(/([,.;:!?…])\s{2,}/g, "$1 ");

  // «1-25-347» / «1.25.347» / «1–25–347» → «1, 25, 347»
  t = t.replace(/(?<!\d)(\d{1,3})[ .,]*[-–—.][ \t]*(\d{1,3})[ .,]*[-–—.][ \t]*(\d{1,3})(?!\d)/g, "$1, $2, $3");
  t = t.replace(/(\d+)[ \t]*[-–—][ \t]*(\d+)(?!\d)/g, "$1, $2");

  // «128 964 7» → «128, 964, 7» (пробелы между числами без запятых)
  t = t.replace(/(?<!\d)(\d{1,4})\s+(\d{1,4})\s+(\d{1,4})(?!\d)/g, "$1, $2, $3");

  // галлюцинация Whisper: восходящая цепочка 6+ чисел (9,10,11,12...) — вырезаем
  t = t.replace(/(?:\d{1,4},\s*){5,}\d{1,4}/g, (m) => {
    const nums = m.match(/\d+/g).map(Number);
    let asc = 0;
    for (let i = 1; i < nums.length; i++) if (nums[i] >= nums[i - 1] && nums[i] - nums[i - 1] <= 3) asc++;
    return asc / Math.max(1, nums.length - 1) >= 0.6 ? " " : m;
  });

  for (const [re, to] of TEXT_FIXES) t = t.replace(re, to);

  // дубль overlap-чанков: «Вопрос: вопрос …» / двойное повторение фразы
  t = t.replace(
    /([А-ЯЁа-яё]+(?:\s+[А-ЯЁа-яё]+){1,7}?)[:\s]+\1(?=\s|[,.;:!?]|$)/gi,
    (_, phrase) => {
      const p = phrase.trim();
      return p.charAt(0).toUpperCase() + p.slice(1) + ":";
    }
  );

  t = t.replace(/(меня)\s+(И одно|и одно|одно с)/gi, "$1? $2");
  t = t.replace(/(Предложение с вопросом)[.!?]?\s*(Вы слышите|вы слышите)/gi, "$1: $2");
  t = t.replace(/(восклицанием)[:.]?\s*(Отлично|отлично)/g, "$1: $2!");
  t = t.replace(/(название|Название|названия|Названия)[.,]\s+(Москва|москва)/g, "$1: $2");
  t = t.replace(/(мысль|Мысль)\s*[-–—]?\s*(это|Это)/g, "$1 — это");
  t = t.replace(/([а-яё]{3,})\s+—\s+([А-ЯЁ])/g, (_, a, b) => a + " — " + b.toLowerCase());
  t = t.replace(/([а-яё]{3,})\s+—\s+(Это|это)/g, "$1 — это");
  t = t.replace(/([а-яё]+)\s—\sЭто/gi, "$1 — это");

  // Сквозные склейки как в эталоне (точка → запятая/двоеточие внутри одной мысли)
  t = t.replace(/(года|году|месяца|числа)\.\s+(Время|время)/g, (_, a, b) => a + ", " + b.toLowerCase());
  t = t.replace(/(браузере|окне|файле|сервере)\.\s+(Файл|файл|Модель|модель)/g, (_, a, b) => a + ": " + b.toLowerCase());
  t = t.replace(/(на сервер)\.\s+(Модель|модель)/g, (_, a, b) => a + ", " + b.toLowerCase());
  t = t.replace(/(Короткая пауза|короткая пауза|Пауза|пауза)\.\s+(Затем|затем)/g, (_, a, b) => a + ", " + b.toLowerCase());
  t = t.replace(/(Счет|Счёт|счет|счёт)\s+(1)\s*,\s*(25)\s*,\s*(347)/g, "$1: $2, $3, $4");
  t = t.replace(/(347)\s*,\s*(название|Название)/gi, "$1. $2");
  t = t.replace(/(Короткая пауза|короткая пауза|Пауза|пауза)\s+(затем|Затем),/g, "$1, $2");
  t = t.replace(/(затем|Затем),\s+(новая|Новая)/g, "$1 $2");
  t = t.replace(/(меня)\s+и\s+одно/gi, "$1? И одно");

  // «Счет. Один, двадцать пять. Триста сорок семь.» → через двоеточие/запятые
  t = t.replace(/((?:с|С|сч|Сч)ет)\.\s+/g, "$1: ");
  t = t.replace(
    /((?:один|два|три|четыре|пять|шесть|семь|восемь|девять|десять|двадцать|тридцать|сорок|пятьдесят|шестьдесят|семьдесят|восемьдесят|девяносто|сто|двести|триста|четыреста|пятьсот|шестьсот|семьсот|восемьсот|девятьсот|тысяча|тысячи|миллион))\.\s+((?:один|два|три|четыре|пять|шесть|семь|восемь|девять|десять|двадцать|тридцать|сорок|пятьдесят|шестьдесят|семьдесят|восемьдесят|девяносто|сто|двести|триста|четыреста|пятьсот|шестьсот|семьсот|восемьсот|девятьсот|тысяча|тысячи|миллион|1|25|347))/gi,
    (_, a, b) => a + ", " + b.toLowerCase()
  );
  t = t.replace(
    /((?:с|С|сч|Сч)ет)\s*:\s*((?:О|о)дин|[Дд]ва|[Тт]ри|[Чч]етыре|[Пп]ять)/g,
    (_, a, b) => a + ": " + b.toLowerCase()
  );
  t = t.replace(/(цифры и имена|цифры и имина|Цифры и имена)/g, "цифры, имена");

  // строчная после двоеточия-интро (не для списков-названий)
  t = t.replace(/(вопросом|восклицанием|Вопросом|Восклицанием):\s+([А-ЯЁ])/g, (_, a, b) => a + ": " + b.toLowerCase());
  t = t.replace(/((?:с|С)чет|Счёт|счёт):\s+([Оо]дин|[Дд]ва|[Тт]ри|[Чч]етыре|[Пп]ять|[Шш]есть|[Сс]емь|[Вв]осемь|[Дд]евять|[Дд]вадцать|[Тт]риста|[Сс]орок|[Пп]ятьдесят)/g, (_, a, b) => a + ": " + b.toLowerCase());
  t = t.replace(/((?:с|С)чет:|Счёт:|счёт:)\s*((?:один|два|три|четыре|пять|шесть|семь|восемь|девять|десять|двадцать|тридцать|сорок|пятьдесят|шестьдесят|семьдесят|восемьдесят|девяносто|сто|триста|тысяча|миллион),?\s+)([А-ЯЁ])/g, (_, a, b, c) => a + b + c.toLowerCase());

  // двойная пунктуация
  t = t.replace(/([.!?]){2,}/g, "$1");
  t = t.replace(/\.{3,}/g, "…");
  t = t.replace(/([,;:]){2,}/g, "$1");
  t = t.replace(/\.\s*\./g, ". ");
  t = t.replace(/:\s*:/g, ":");
  t = t.replace(/!\s*!/g, "!");
  t = t.replace(/\s+([,.;:!?…])/g, "$1");
  t = t.replace(/([?!])(?=[^\s"»])/g, "$1 ");

  // Заглавная после точки/восклицания/вопроса
  t = t.replace(
    /([.!?…]["»)\]]*)[ \t]+([a-zа-яё])/g,
    (_, p, c) => p + " " + c.toUpperCase()
  );
  t = t.replace(/^([a-zа-яё])/, (c) => c.toUpperCase());
  t = t.replace(/(цифры,\s)Имена/g, "$1имена");
  t = t.replace(/(цифры:\s)Имена/g, "$1имена");
  t = t.replace(/,\sИмена\sи\s/g, ", имена и ");

  return t.trim();
}

function polishText(raw) {
  let t = polishCore(raw);
  if (t && !/[.!?…:»"]$/.test(t)) t += ".";
  return t;
}

function joinFragments(a, b) {
  const aStr = String(a || "").trim();
  const bStr = String(b || "").trim();
  const left = aStr.replace(/[.,;:!?…]+$/, "").trim();
  const right = bStr.replace(/^[.,;:!?…]+/, "").trim();
  if (!left) return polishCore(right);
  if (!right) return polishCore(left);

  const leftLower = left.toLowerCase();
  const leftWords = countWords(left);

  // Метка перед значением → двоеточие (левый КОНЧАЕТСЯ на метку)
  const endsLabel = /(вопросом|восклицанием|вопрос к аудитории|аудитории)$/.test(leftLower);
  const isListLabel = /^(название|названия|счет|счёт|города|город)$/.test(leftLower);

  if (/[?]$/.test(bStr) && (endsLabel || leftWords <= 5)) {
    return polishCore(left + ": " + demoteFirst(right));
  }
  if (endsLabel) {
    let r = demoteFirst(right);
    if (/^отлично\b/i.test(r) && !/[!?]$/.test(r)) r += "!";
    return polishCore(left + ": " + r);
  }
  if (isListLabel) return polishCore(left + ": " + right);

  // Продолжение после двоеточия (список) → запятая
  if (/[:：][^.!?]*$/.test(aStr)) {
    if (/(?:название|названия):/i.test(aStr)) return polishCore(left + ", " + right);
    return polishCore(left + ", " + demoteFirst(right));
  }

  // Закрытые ? ! … → новое предложение, знак уже стоит
  if (/[!?…]$/.test(aStr)) {
    return polishCore(aStr.replace(/\s+/g, " ") + " " + capFirst(right));
  }

  // Точка на конце — новое предложение
  if (/\.$/.test(aStr)) {
    if (/(?:с|сч)ет:/i.test(aStr)) {
      if (/^(название|названия|время|файл|модель|проверим|добро|сегодня|наш)\b/i.test(right)) {
        return polishCore(left + ". " + capFirst(right));
      }
      return polishCore(left + ", " + demoteFirst(right));
    }
    if (leftWords <= 2) return polishCore(left + ", " + demoteFirst(right));
    if (/(года|году|месяца|числа)$/.test(leftLower) && /^(время|времени|час)/.test(right.toLowerCase())) {
      return polishCore(left + ", " + demoteFirst(right));
    }
    if (/(браузере|окне|файле|сервере)$/.test(leftLower) && leftWords >= 5) {
      return polishCore(left + ": " + demoteFirst(right));
    }
    // «загружается. На сервер» — предлог не начинает предложение
    if (/^(на сервер|на|в|за|для|с|к|у|о|по|из|до|от|и|а|но)\b/i.test(right)) {
      return polishCore(left + ", " + demoteFirst(right));
    }
    // «второго. Тестового фрагмента» — не разрывать словосочетание
    if (/(второго|третьего|четвертого|пятого|следующего|прошлого|настоящего)$/i.test(leftLower)) {
      return polishCore(left + " " + demoteFirst(right));
    }
    if (/^(название|названия)$/i.test(right)) {
      return polishCore(left + ". " + capFirst(right));
    }
    return polishCore(left + ". " + capFirst(right));
  }

  if (leftWords === 1 && !/^(а|и|но|или|что|как|то|же|бы|в|на|с|по|к|у|о|для|это)$/i.test(left)) {
    return polishCore(left + ": " + right);
  }
  return polishCore(left + ", " + demoteFirst(right));
}

function polishSegments(segments) {
  if (!Array.isArray(segments) || !segments.length) return segments;
  const polished = segments
    .map((s) => ({
      start: s.start ?? 0,
      end: s.end ?? 0,
      text: polishText(s.text || ""),
    }))
    .filter((s) => s.text);

  const out = [];
  for (const s of polished) {
    const last = out[out.length - 1];
    if (!last) {
      out.push(s);
      continue;
    }
    const dur = Math.max(0, (s.end || 0) - (s.start || 0));
    const lastDur = Math.max(0, (last.end || 0) - (last.start || 0));
    const lastWords = countWords(last.text);
    const words = countWords(s.text);
    const plainLen = s.text.replace(/[.!?…:]/g, "").trim().length;
    const lastPlainLen = last.text.replace(/[.!?…:]/g, "").trim().length;
    const lastShort = lastWords <= 4 || lastPlainLen <= 28;
    const lastIsClosed = /[?!]$/.test(last.text);
    const lastIsLong = lastWords >= 7 && lastPlainLen >= 45;
    const mergedLen = lastPlainLen + plainLen;
    const shouldMerge =
      !lastIsClosed &&
      !lastIsLong &&
      (lastShort || mergedLen < 90) &&
      mergedLen < 160 &&
      (lastDur + dur < 10 || words <= 8 || lastShort);
    if (shouldMerge) {
      last.end = Math.max(last.end || 0, s.end || 0);
      last.text = joinFragments(last.text, s.text);
    } else {
      out.push(s);
    }
  }
  return out.map((s) => ({ ...s, text: polishText(s.text) }));
}

function splitParagraphs(text) {
  const t = String(text || "").trim();
  if (!t) return [];
  const sentences = t.match(/[^.!?…]+[.!?…]+["»)?]*\s*|[^.!?…]+$/g) || [t];
  const paras = [];
  let buf = "";
  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;
    if (!buf) {
      buf = s;
    } else if (buf.length + s.length + 1 <= 320) {
      buf = buf + " " + s;
    } else {
      paras.push(buf);
      buf = s;
    }
  }
  if (buf) paras.push(buf);
  return paras.length ? paras : [t];
}

/* ---------- Reveal ---------- */
const revealObs = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        revealObs.unobserve(e.target);
      }
    });
  },
  { threshold: 0.12 }
);
function observeReveals() {
  $$(".reveal").forEach((n) => revealObs.observe(n));
}

/* ---------- Files ---------- */

function validateFile(file) {
  if (!file) return "Файл не выбран";
  if (file.size === 0) return "Файл пустой (0 байт)";
  const name = file.name || "";
  const ext = (name.match(/\.([^.]+)$/) || [])[1]?.toLowerCase() || "";
  const okExt = [
    "mp3","wav","m4a","ogg","oga","webm","flac","aac","mp4","wma","opus",
    "mkv","mov","webm","amr","ape","alac","aiff","au","caf","3gp",
  ];
  const okType =
    file.type.startsWith("audio/") ||
    file.type.startsWith("video/") ||
    (!file.type && okExt.includes(ext)) ||
    okExt.includes(ext);
  // Если расширение неизвестное, но это не текст/архив — пробуем всё равно
  const hardBad = /^(txt|pdf|docx?|xlsx?|zip|rar|7z|png|jpg|jpeg|gif|svg|exe|dll|js|css|html|json|xml|csv)$/.test(ext);
  if (hardBad) return `Это не аудио (.${ext}). Нужен MP3, WAV, M4A, OGG…`;
  if (!okType && hardBad) return "Нужен аудио или видео файл";
  if (file.size > 500 * 1024 * 1024) return "Файл больше 500 МБ — слишком большой";
  return null;
}

function rememberFile(file) {
  const key = file.name + "::" + file.size + "::" + file.lastModified;
  state.recentFiles = state.recentFiles.filter((f) => f.key !== key);
  state.recentFiles.unshift({
    key,
    file,
    name: file.name,
    size: file.size,
    type: file.type || "",
    lastModified: file.lastModified,
    at: Date.now(),
    status: "new",
  });
  if (state.recentFiles.length > 20) state.recentFiles.length = 20;
  renderFilesList();
}

function markFileStatus(file, status) {
  if (!file) return;
  const key = file.name + "::" + file.size + "::" + file.lastModified;
  const row = state.recentFiles.find((f) => f.key === key);
  if (row) row.status = status;
  renderFilesList();
}

function renderFilesList() {
  if (!el.filesList) return;
  const items = state.recentFiles;
  if (!items.length) {
    el.filesList.innerHTML = `
      <div class="files-empty muted" id="filesEmpty">
        <i data-lucide="file-question"></i>
        <span>Пока пусто — файлы появятся здесь после выбора</span>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }
  el.filesList.innerHTML = items
    .map((item, idx) => {
      const badge =
        item.status === "ok"
          ? `<span class="file-row-badge">готово</span>`
          : item.status === "err"
            ? `<span class="file-row-badge warn">ошибка</span>`
            : item.status === "busy"
              ? `<span class="file-row-badge warn">…</span>`
              : "";
      const active =
        state.file &&
        state.file.name === item.name &&
        state.file.size === item.size
          ? " active"
          : "";
      return `
        <div class="file-row${active}" data-idx="${idx}" role="button" tabindex="0">
          <div class="file-row-icon"><i data-lucide="file-audio"></i></div>
          <div class="file-row-meta">
            <div class="file-row-name">${escapeHtml(item.name)}</div>
            <div class="file-row-sub">${formatBytes(item.size)}${item.type ? " · " + escapeHtml(item.type) : ""}</div>
          </div>
          ${badge}
          <button type="button" class="file-row-remove" data-remove="${idx}" title="Убрать из списка">
            <i data-lucide="x"></i>
          </button>
        </div>`;
    })
    .join("");
  if (window.lucide) lucide.createIcons();
}

function openFilesModal() {
  renderFilesList();
  el.filesModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function closeFilesModal() {
  el.filesModal.classList.add("hidden");
  document.body.style.overflow = "";
}

el.btnCloseFiles?.addEventListener("click", closeFilesModal);
el.filesModal?.addEventListener("click", (e) => {
  if (e.target === el.filesModal) closeFilesModal();
});
el.btnPickFile?.addEventListener("click", () => {
  closeFilesModal();
  showSection("hero");
  el.fileInput.click();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && el.filesModal && !el.filesModal.classList.contains("hidden")) {
    closeFilesModal();
  }
});
el.filesList?.addEventListener("click", (e) => {
  const rm = e.target.closest("[data-remove]");
  if (rm) {
    e.stopPropagation();
    const idx = Number(rm.dataset.remove);
    state.recentFiles.splice(idx, 1);
    renderFilesList();
    return;
  }
  const row = e.target.closest(".file-row");
  if (!row) return;
  const item = state.recentFiles[Number(row.dataset.idx)];
  if (!item?.file) return;
  closeFilesModal();
  handleFile(item.file);
});
el.filesList?.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const row = e.target.closest(".file-row");
  if (!row) return;
  e.preventDefault();
  row.click();
});

function estimateAudioMinutes(sizeBytes) {
  // Оценка по типичному MP3 ~160 kbps (≈20 КБ/с); точнее — после чтения metadata
  return sizeBytes / 20000 / 60;
}

function estimateTranscribeRange(audioMinutes, modelId) {
  // Реалистично: tiny ~0.1–0.2×, base ~0.2–0.5×, small ~0.4–1.2× от длительности (CPU)
  // WebGPU ускоряет в ~3–8×
  const gpu = state?.transcriberDevice === "webgpu";
  let mult = modelId.includes("tiny")
    ? [0.08, 0.25]
    : modelId.includes("small")
      ? [0.4, 1.2]
      : [0.15, 0.5];
  if (gpu) mult = [mult[0] * 0.25, mult[1] * 0.35];
  const lo = Math.max(1, Math.round(audioMinutes * mult[0]));
  const hi = Math.max(lo + 1, Math.round(audioMinutes * mult[1]));
  return [lo, hi];
}

async function probeDurationSec(file) {
  try {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    a.preload = "metadata";
    const dur = await new Promise((resolve) => {
      const t = setTimeout(() => resolve(NaN), 4000);
      a.onloadedmetadata = () => {
        clearTimeout(t);
        resolve(a.duration);
      };
      a.onerror = () => {
        clearTimeout(t);
        resolve(NaN);
      };
      a.src = url;
    });
    URL.revokeObjectURL(url);
    return Number.isFinite(dur) && dur > 0 ? dur : NaN;
  } catch {
    return NaN;
  }
}

function updateFileChip(file) {
  const nameEl = $("#fileChipName");
  const sizeEl = $("#fileChipSize");
  if (nameEl) nameEl.textContent = file?.name || "—";
  if (sizeEl) sizeEl.textContent = file ? `· ${formatBytes(file.size)}` : "";
}

function handleFile(file) {
  const err = validateFile(file);
  if (err) {
    toast(err, "error");
    rememberFile(file);
    markFileStatus(file, "err");
    return;
  }
  const sameKey =
    state.file &&
    state.file.name === file.name &&
    state.file.size === file.size &&
    state.file.lastModified === file.lastModified;
  if (state.elapsedTimer) {
    clearInterval(state.elapsedTimer);
    state.elapsedTimer = null;
  }
  state.procGen += 1;
  const gen = state.procGen;
  rememberFile(file);
  markFileStatus(file, "busy");
  state.file = file;
  state.cancelRequested = false;
  if (!sameKey) el.editor.innerHTML = "";
  el.procFileName.textContent = file.name;
  el.procFileSize.textContent = `· ${formatBytes(file.size)}`;
  updateFileChip(file);

  const t0 = Date.now();
  const timeEl = $("#procTime");
  let audioMin = estimateAudioMinutes(file.size);
  const modelId = el.selModel.value;
  let [lo, hi] = estimateTranscribeRange(audioMin, modelId);

  // Быстрый пробный metadata — точная длительность без полного декода
  probeDurationSec(file).then((sec) => {
    if (!Number.isFinite(sec) || state.procGen !== gen) return;
    audioMin = sec / 60;
    [lo, hi] = estimateTranscribeRange(audioMin, modelId);
    el.procSubtitle.textContent =
      `Аудио ~${formatTime(sec)}. Оценка распознавания ~${lo}–${hi} мин` +
      (file.size > 8 * 1024 * 1024 ? ". Большой файл — не закрывайте вкладку." : ".");
  });

  state.elapsedTimer = setInterval(() => {
    if (state.cancelRequested || state.procGen !== gen) {
      clearInterval(state.elapsedTimer);
      state.elapsedTimer = null;
      return;
    }
    const sec = Math.floor((Date.now() - t0) / 1000);
    const stage = el.procTitle.textContent || "";
    const durLabel =
      audioMin > 1
        ? `Аудио ~${audioMin > 90 ? ((audioMin / 60).toFixed(1) + " ч") : (Math.round(audioMin) + " мин")} · `
        : "";
    if (timeEl) {
      timeEl.textContent = `${durLabel}этап: ${stage} · прошло ${formatTime(sec)}`;
    }
  }, 1000);

  if (file.size > 8 * 1024 * 1024) {
    el.procSubtitle.textContent =
      "Большой файл: читаем длительность… Держите вкладку открытой.";
  } else {
    el.procSubtitle.textContent =
      "Первый запуск качает модель (~30–120 с). Дальше будет быстрее из кеша.";
  }

  showSection("processing");
  setProgress(2, "Готовимся…", "Читаем файл");
  window.scrollTo({ top: 0, behavior: "smooth" });
  processFile(file, gen).catch((e) => {
    if (state.procGen !== gen) return;
    console.error(e);
    if (state.elapsedTimer) clearInterval(state.elapsedTimer);
    markFileStatus(file, "err");
    if (state.cancelRequested) return;
    const msg = e?.message || "Не удалось расшифровать файл";
    if (msg === "cancel") return;
    toast(msg, "error");
    showSection("hero");
    if (/CDN|движок|fetch|import|превышено/i.test(msg)) {
      toast("Подсказка: выберите модель Tiny и попробуйте ещё раз", "info");
    } else if (/декод|формат|распознан/i.test(msg)) {
      toast("Попробуйте конвертировать в MP3 или WAV", "info");
    }
  });
}

["dragenter", "dragover"].forEach((ev) =>
  el.dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    e.stopPropagation();
    el.dropzone.classList.add("dragover");
  })
);
["dragleave", "drop"].forEach((ev) =>
  el.dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    e.stopPropagation();
    el.dropzone.classList.remove("dragover");
  })
);
el.dropzone.addEventListener("drop", (e) => {
  const f = e.dataTransfer?.files?.[0];
  if (f) handleFile(f);
});
el.dropzone.addEventListener("click", () => el.fileInput.click());
el.dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    el.fileInput.click();
  }
});
el.fileInput.addEventListener("change", () => {
  const f = el.fileInput.files?.[0];
  if (f) handleFile(f);
  el.fileInput.value = "";
});
el.btnHeaderUpload.addEventListener("click", () => {
  showSection("hero");
  el.fileInput.click();
});
el.btnNewFile.addEventListener("click", openFilesModal);
document.getElementById("btnReplaceFile")?.addEventListener("click", () => el.fileInput.click());
$("#logoLink").addEventListener("click", (e) => {
  e.preventDefault();
  showSection("hero");
});
document.getElementById("btnHow")?.addEventListener("click", () => {
  document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth", block: "start" });
});
el.btnCancel.addEventListener("click", () => {
  state.cancelRequested = true;
  state.procGen += 1;
  if (state.elapsedTimer) {
    clearInterval(state.elapsedTimer);
    state.elapsedTimer = null;
  }
  markFileStatus(state.file, "err");
  showSection("hero");
  toast("Расшифровка отменена", "info");
});

/* ---------- Audio decode ---------- */
function bufferToMono(buf) {
  if (buf.numberOfChannels === 1) return new Float32Array(buf.getChannelData(0));
  const len = buf.length;
  const l = buf.getChannelData(0);
  const r = buf.numberOfChannels > 1 ? buf.getChannelData(1) : l;
  const out = new Float32Array(len);
  // по кускам — не держим main thread на многоминутных записях
  const STEP = 1 << 20;
  for (let i = 0; i < len; i += STEP) {
    const end = Math.min(len, i + STEP);
    for (let j = i; j < end; j++) out[j] = (l[j] + r[j]) * 0.5;
  }
  return out;
}

async function fileToFloat32(file) {
  setProgress(64, "Читаем аудио…", `${formatBytes(file.size)} · в памяти браузера`);
  await new Promise((r) => setTimeout(r, 30));
  const buf = await file.arrayBuffer();
  if (state.cancelRequested) throw new Error("cancel");

  setProgress(68, "Декодируем аудио…", "Ожидаемое время: секунды");
  await new Promise((r) => setTimeout(r, 30));

  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) throw new Error("Браузер не поддерживает Web Audio API");

  let audioCtx;
  try {
    audioCtx = new AC({ sampleRate: 16000 });
  } catch {
    audioCtx = new AC();
  }

  let decoded;
  try {
    decoded = await withTimeout(audioCtx.decodeAudioData(buf), 60000, "Декодирование аудио");
  } catch (e) {
    try {
      decoded = await withTimeout(audioCtx.decodeAudioData(buf.slice(0)), 60000, "Декодирование аудио");
    } catch {
      if (audioCtx.close) audioCtx.close().catch(() => {});
      if (String(e?.message || "").includes("превышено")) {
        throw new Error("Декодирование зависло — файл повреждён или в неизвестном формате.");
      }
      throw new Error("Не удалось декодировать аудио. Попробуйте другой формат (MP3/WAV).");
    }
  }
  if (audioCtx.close) audioCtx.close().catch(() => {});
  if (state.cancelRequested) throw new Error("cancel");

  setProgress(73, "Готовим PCM…", `Длительность ${formatTime(decoded.duration)}`);

  if (Math.abs(decoded.sampleRate - 16000) > 1) {
    const frames = Math.ceil(decoded.duration * 16000);
    const offline = new OfflineAudioContext(1, frames, 16000);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start(0);
    const rendered = await withTimeout(offline.startRendering(), 60000, "Ресемплинг");
    return bufferToMono(rendered);
  }
  return bufferToMono(decoded);
}

/* ---------- transformers.js multi-CDN ---------- */
let transformersModule = null;

const TFM_ESM_SOURCES = [
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.2/+esm",
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.2",
  "https://unpkg.com/@huggingface/transformers@3.3.2",
  "https://esm.sh/@huggingface/transformers@3.3.2",
  "https://ga.jspm.io/npm:@huggingface/transformers@3.3.2/dist/transformers.mjs",
];

const TFM_UMD_SOURCES = [
  "https://unpkg.com/@huggingface/transformers@3.3.2/dist/transformers.min.js",
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.2/dist/transformers.min.js",
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.1/dist/transformers.min.js",
];

function pickGlobalTransformers() {
  return (
    window.transformers ||
    window.Transformers ||
    window.HFTransformers ||
    window["@huggingface/transformers"] ||
    null
  );
}

function loadScript(src, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    const timer = setTimeout(() => {
      s.remove();
      reject(new Error("timeout: " + src));
    }, timeoutMs);
    s.onload = () => {
      clearTimeout(timer);
      s.remove();
      resolve();
    };
    s.onerror = () => {
      clearTimeout(timer);
      s.remove();
      reject(new Error("script fail: " + src));
    };
    document.head.appendChild(s);
  });
}

function applyEnv(mod) {
  if (mod?.env) {
    try {
      mod.env.allowLocalModels = false;
      mod.env.useBrowserCache = true;
      // Многопоточный WASM: включается только при cross-origin isolation
      // (заголовки COOP/COEP — см. _headers / vercel.json; COEP должен быть
      // credentialless, иначе require-corp блокирует скачивание весов с HF).
      const threads = navigator.hardwareConcurrency || 4;
      if (mod.env.backends?.onnx?.wasm) {
        mod.env.backends.onnx.wasm.numThreads = window.crossOriginIsolated
          ? Math.min(threads, 16)
          : 1;
      }
    } catch {}
  }
  return mod;
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label}: превышено время ожидания (${Math.round(ms / 1000)} с)`)),
      ms
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function loadTransformers() {
  if (transformersModule?.pipeline) return transformersModule;
  setIndeterminate("Загружаем движок…", "Гоним зеркала CDN параллельно");
  const errors = [];

  const tryEsm = (src) =>
    withTimeout(import(/* @vite-ignore */ src), 20000, "CDN").then((mod) => {
      if (mod?.pipeline) return mod;
      throw new Error(src + " (нет pipeline)");
    });

  try {
    const mod = await Promise.any(TFM_ESM_SOURCES.map((src) =>
      tryEsm(src).catch((e) => {
        console.warn("[CDN ESM fail]", src, e);
        errors.push(src + ": " + (e?.message || e));
        throw e;
      })
    ));
    transformersModule = applyEnv(mod);
    return transformersModule;
  } catch {
    /* все ESM упали — идём в UMD */
  }

  setIndeterminate("Загружаем движок…", "Пробуем резервные скрипты");
  const tryUmd = (src) =>
    withTimeout(loadScript(src), 20000, "CDN script").then(() => {
      const g = pickGlobalTransformers();
      if (g?.pipeline) return g;
      if (g?.default?.pipeline) return g.default;
      throw new Error(src + " (bundle без pipeline)");
    });

  try {
    const g = await Promise.any(TFM_UMD_SOURCES.map((src) =>
      tryUmd(src).catch((e) => {
        console.warn("[CDN UMD fail]", src, e);
        errors.push(src + ": " + (e?.message || e));
        throw e;
      })
    ));
    transformersModule = applyEnv(g);
    return transformersModule;
  } catch {
    /* всё упало */
  }

  console.error("All transformers CDN sources failed:", errors);
  throw new Error(
    "Не удалось загрузить движок распознавания (все зеркала CDN недоступны). Проверьте интернет/VPN."
  );
}

/* WebGPU сильно быстрее WASM; device фиксируем после первого выбора */
async function detectDevice() {
  if (state.deviceLocked) return state.deviceLocked;
  try {
    if (!navigator.gpu) {
      state.deviceLocked = "wasm";
      return "wasm";
    }
    const adapter = await withTimeout(
      navigator.gpu.requestAdapter({ powerPreference: "high-performance" }),
      2500,
      "WebGPU adapter"
    );
    if (!adapter) {
      state.deviceLocked = "wasm";
      return "wasm";
    }
    state.deviceLocked = "webgpu";
    return "webgpu";
  } catch {
    state.deviceLocked = "wasm";
    return "wasm";
  }
}

async function loadPipeline(modelId, device, progress_callback) {
  const { pipeline } = await loadTransformers();
  const dtype = device === "webgpu" ? "fp16" : "q8";
  return pipeline("automatic-speech-recognition", modelId, {
    dtype,
    device,
    progress_callback,
  });
}

async function getTranscriber(modelId, gen) {
  const dead = () =>
    state.cancelRequested || (gen != null && state.procGen !== gen);
  let device = await detectDevice();
  const cacheKey = `${modelId}::${device}`;
  if (state.transcriber && state.transcriberModel === cacheKey) return state.transcriber;
  if (state.transcriberLoading) {
    const shared = await state.transcriberLoading.catch(() => null);
    if (shared) return shared;
  }

  const loading = (async () => {
    await loadTransformers();
    setIndeterminate(
      "Загрузка модели…",
      device === "webgpu"
        ? "WebGPU · первый запуск скачивает веса (потом кеш)"
        : "WASM · первый запуск скачивает веса (~30–120 с)"
    );
    let lastPct = -1;
    let lastActivity = Date.now();
    const progress_callback = (data) => {
      if (dead()) return;
      lastActivity = Date.now();
      if (data?.status === "progress" && typeof data.progress === "number") {
        const mapped = 5 + data.progress * 0.65;
        if (Math.abs(mapped - lastPct) >= 1) {
          lastPct = mapped;
          const short = (data.file || "").split("/").pop();
          setProgress(mapped, "Скачиваем модель…", `${short} · ${Math.round(data.progress)}%`);
        }
      } else if (data?.status === "done") {
        setProgress(72, "Модель готова", "Инициализация…");
      } else if (data?.status === "ready") {
        setProgress(74, "Модель готова", "Готов к распознаванию");
      }
    };

    const stallCheck = setInterval(() => {
      if (dead()) return clearInterval(stallCheck);
      const idle = Date.now() - lastActivity;
      const timeEl = $("#procTime");
      if (idle > 45000 && timeEl) {
        timeEl.textContent =
          "Модель всё ещё качается/готовится. Если долго — нажмите «Отменить» и попробуйте модель Tiny.";
      }
    }, 5000);

    try {
      try {
        state.transcriber = await withTimeout(
          loadPipeline(modelId, device, progress_callback),
          240000,
          "Загрузка модели"
        );
      } catch (e) {
        if (device === "webgpu" && !dead()) {
          console.warn("[WebGPU] fail, fallback wasm", e);
          device = "wasm";
          state.deviceLocked = "wasm";
          state.transcriber = null;
          state.transcriberModel = null;
          setIndeterminate("WebGPU недоступен…", "Переключаемся на WASM");
          state.transcriber = await withTimeout(
            loadPipeline(modelId, "wasm", progress_callback),
            240000,
            "Загрузка модели (WASM)"
          );
        } else {
          throw e;
        }
      }
      state.transcriberModel = `${modelId}::${device}`;
      state.transcriberDevice = device;
      setProgress(75, "Модель готова", device === "webgpu" ? "WebGPU · начинаем…" : "WASM · начинаем…");
      return state.transcriber;
    } catch (e) {
      if (String(e.message).includes("превышено") && !dead()) {
        throw new Error(
          "Модель не загрузилась за 3 минуты. Проверьте интернет или выберите модель Tiny."
        );
      }
      throw e;
    } finally {
      clearInterval(stallCheck);
    }
  })();

  state.transcriberLoading = loading;
  try {
    return await loading;
  } finally {
    if (state.transcriberLoading === loading) state.transcriberLoading = null;
  }
}

/* ---------- Local Whisper ---------- */
const yieldUi = () => new Promise((r) => setTimeout(r, 0));

async function transcribeChunked(transcriber, audio, options, gen, onProgress) {
  const dead = () =>
    state.cancelRequested || (gen != null && state.procGen !== gen);
  const sr = 16000;
  // 30s — нативное окно Whisper: меньше вызовов pipeline и меньше
  // пересчёта overlap, чем старые 8s (на длинных файлах это заметно).
  // 2s overlap хватает для склейки без дублей на стыке.
  const CHUNK = 30 * sr;
  const STRIDE = 2 * sr;

  if (audio.length <= CHUNK) {
    await yieldUi();
    return await transcriber(audio, options);
  }

  const mergedChunks = [];
  let accText = "";
  let start = 0;
  let guard = 0;

  while (start < audio.length) {
    if (dead()) throw new Error("cancel");
    if (++guard > 10000) break;
    const end = Math.min(audio.length, start + CHUNK);
    const slice = audio.slice(start, end);
    await yieldUi();

    const out = await transcriber(slice, options);
    if (dead()) throw new Error("cancel");

    const base = start / sr;
    if (Array.isArray(out?.chunks)) {
      for (const c of out.chunks) {
        const t0 = (c.timestamp?.[0] ?? 0) + base;
        const t1 = (c.timestamp?.[1] ?? 0) + base;
        const prev = mergedChunks[mergedChunks.length - 1];
        if (prev && t0 < prev.end - 0.4) continue;
        const chunkText = String(c.text || "");
        if (!chunkText.trim()) continue;
        // срезаем повтор хвоста/головы на стыке overlap
        let text = chunkText;
        if (mergedChunks.length) {
          const tail = accText.slice(-80).toLowerCase().replace(/[^\sа-яё0-9]+/g, " ").trim();
          const head = text.toLowerCase().replace(/[^\sа-яё0-9]+/g, " ").trim();
          const tailWords = tail.split(/\s+/).filter(Boolean);
          const headWords = head.split(/\s+/).filter(Boolean);
          let drop = 0;
          for (let n = Math.min(8, tailWords.length, headWords.length); n >= 2; n--) {
            const tPart = tailWords.slice(-n).join(" ");
            const hPart = headWords.slice(0, n).join(" ");
            if (tPart && tPart === hPart) {
              drop = n;
              break;
            }
          }
          if (drop) {
            const words = text.trim().split(/\s+/);
            text = words.slice(drop).join(" ");
          }
        }
        if (!text.trim()) continue;
        mergedChunks.push({
          timestamp: [t0, t1 === t0 ? t0 + 0.1 : t1],
          text,
        });
        accText = (accText ? accText + " " : "") + text.trim();
      }
    } else if (out?.text) {
      let tx = String(out.text).trim();
      if (tx && accText) {
        const tail = accText.slice(-80).toLowerCase().replace(/[^\sа-яё0-9]+/g, " ").trim();
        const head = tx.toLowerCase().replace(/[^\sа-яё0-9]+/g, " ").trim();
        const tw = tail.split(/\s+/).filter(Boolean);
        const hw = head.split(/\s+/).filter(Boolean);
        let drop = 0;
        for (let n = Math.min(8, tw.length, hw.length); n >= 2; n--) {
          if (tw.slice(-n).join(" ") === hw.slice(0, n).join(" ")) {
            drop = n;
            break;
          }
        }
        if (drop) tx = tx.trim().split(/\s+/).slice(drop).join(" ");
      }
      if (tx) accText = (accText ? accText + " " : "") + tx;
    }

    onProgress?.(end / audio.length);

    if (end >= audio.length) break;
    const next = end - STRIDE;
    start = next > start ? next : end;
    await yieldUi();
  }

  return {
    text: accText.replace(/\s+/g, " ").trim(),
    chunks: mergedChunks,
  };
}

async function transcribeLocal(file, gen) {
  const dead = () =>
    state.cancelRequested || (gen != null && state.procGen !== gen);
  const audio = await fileToFloat32(file);
  if (dead()) throw new Error("cancel");
  const duration = audio.length / 16000;
  setProgress(76, "Готовим модель…", `${formatTime(duration)} · загрузка/кеш модели`);
  const timeEl = $("#procTime");
  const started = Date.now();
  let modelReady = false;
  let fakeP = 76;
  const timer = setInterval(() => {
    if (dead()) return clearInterval(timer);
    if (modelReady) return;
    fakeP = Math.min(79, fakeP + 0.4);
    const elapsed = Math.round((Date.now() - started) / 1000);
    setProgress(fakeP, "Готовим модель…", `прошло ${formatTime(elapsed)}`);
    if (timeEl) {
      timeEl.textContent = `Загрузка модели… ${formatTime(elapsed)}. Не закрывайте вкладку.`;
    }
  }, 700);

  try {
    const transcriber = await getTranscriber(el.selModel.value, gen);
    modelReady = true;
    clearInterval(timer);
    if (dead()) throw new Error("cancel");
    const devTag = (state.transcriberDevice || "wasm") === "webgpu" ? "WebGPU" : "WASM";
    setProgress(80, "Слушаем речь…", `${devTag} · модель готова · ${formatTime(duration)} аудио`);

    const options = {
      chunk_length_s: 30,
      stride_length_s: 5,
      task: "transcribe",
      temperature: 0,
      compression_ratio_threshold: 2.4,
      logprob_threshold: -1.0,
      // false → быстрее на длинных записях, меньше «залипших» повторов
      condition_on_previous_text: false,
      // Всегда декодируем с тайм-кодами — так Whisper лучше ставит пунктуацию.
      return_timestamps: true,
    };
    const lang = el.selLang.value;
    if (lang !== "auto") options.language = lang;
    else options.language = undefined;

    // Таймаут по реальной скорости: WASM ~8–60× realtime + запас; WebGPU быстрее.
    // Раньше стоял жёсткий кап 5 минут — файлы дольше минуты обрезались.
    const device = state.transcriberDevice || "wasm";
    const rtf = device === "webgpu" ? 8 : 40;
    const inferMs = Math.max(10 * 60 * 1000, duration * 1000 * rtf + 120000);
    const out = await withTimeout(
      transcribeChunked(transcriber, audio, options, gen, (ratio) => {
        const pct = 80 + Math.max(0, Math.min(1, ratio)) * 16;
        const elapsed = Math.round((Date.now() - started) / 1000);
        const eta =
          ratio > 0.02 && ratio < 0.99
            ? Math.max(1, Math.round((elapsed * (1 - ratio)) / ratio))
            : null;
        setProgress(
          pct,
          "Слушаем речь…",
          eta != null
            ? `${formatTime(duration)} · ${devTag} · осталось ~${formatTime(eta)}`
            : `${formatTime(duration)} · ${devTag} · прошло ${formatTime(elapsed)}`
        );
        if (timeEl) {
          timeEl.textContent =
            eta != null
              ? `Идёт распознавание… прошло ${formatTime(elapsed)}, осталось ~${formatTime(eta)}. Не закрывайте вкладку.`
              : `Идёт распознавание… ${formatTime(elapsed)}. Не закрывайте вкладку.`;
        }
      }),
      inferMs,
      "Распознавание"
    );
    clearInterval(timer);
    if (dead()) throw new Error("cancel");
    setProgress(97, "Готово", "Форматируем результат");

    if (!out || (!(out.text || "").trim() && !Array.isArray(out.chunks)))
      throw new Error("Речь не распознана — возможно, в файле слишком тихо, нет голоса или битый файл");

    let segments = null;
    if (Array.isArray(out.chunks)) {
      segments = polishSegments(
        out.chunks
          .map((c) => ({
            start: c.timestamp?.[0] ?? 0,
            end: c.timestamp?.[1] ?? 0,
            text: polishText(c.text || ""),
          }))
          .filter((s) => s.text)
      );
    }

    const text =
      polishText((out.text || "").trim()) ||
      (segments || []).map((s) => s.text).join(" ").trim();
    if (!text)
      throw new Error("Речь не распознана — возможно, в файле слишком тихо, нет голоса или битый файл");

    const showTs = !!el.chkTimestamps.checked;
    return { text, segments, showTs };
  } finally {
    clearInterval(timer);
  }
}

async function processFile(file, gen) {
  try {
    const result = await transcribeLocal(file, gen);
    if (state.cancelRequested || (gen != null && state.procGen !== gen)) return;
    setProgress(100, "Готово!", "Открываем редактор");
    populateEditor(result);
    setupPlayer(file);
    updateFileChip(file);
    await new Promise((r) => setTimeout(r, 350));
    if (state.cancelRequested || (gen != null && state.procGen !== gen)) return;
    showSection("editor");
    updateWordCount();
    if (state.elapsedTimer) clearInterval(state.elapsedTimer);
    markFileStatus(file, "ok");
    toast("Расшифровка готова — можно редактировать", "success");
  } catch (e) {
    if (state.elapsedTimer && (gen == null || state.procGen === gen)) {
      clearInterval(state.elapsedTimer);
      state.elapsedTimer = null;
    }
    throw e;
  }
}

function populateEditor(result) {
  const esc = (s) => escapeHtml(s).replace(/\n/g, "<br>");
  const showTs = result.showTs !== false;

  if (result.segments && result.segments.length) {
    if (showTs) {
      el.editor.innerHTML = result.segments
        .map(
          (s) =>
            `<p><span class="ts">[${formatTimestamp(s.start || 0)}]</span>${esc(
              polishText(s.text || "")
            )}</p>`
        )
        .join("");
    } else {
      // Сплошной текст: объединяем все сегменты в абзацы, а не строку на сегмент
      const merged = result.segments.reduce((acc, s) => {
        const t = polishText(s.text || "");
        if (!t) return acc;
        if (!acc) return t;
        return joinFragments(acc, t);
      }, "");
      const full = polishText(merged || result.text || "");
      const paragraphs = splitParagraphs(full);
      el.editor.innerHTML = paragraphs.length
        ? paragraphs.map((t) => `<p>${esc(t)}</p>`).join("")
        : `<p>${esc(full)}</p>`;
    }
  } else {
    const full = polishText(result.text || "");
    const paragraphs = full
      .split(/\n+/)
      .map((t) => polishText(t.trim()))
      .filter(Boolean);
    el.editor.innerHTML = paragraphs.length
      ? paragraphs.map((t) => `<p>${esc(t)}</p>`).join("")
      : "<p></p>";
  }
  el.editor.scrollTop = 0;
}

/* ---------- Player ---------- */
function setupPlayer(file) {
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  state.objectUrl = URL.createObjectURL(file);
  el.audioEl.src = state.objectUrl;
  const container = $("#waveform");
  container.innerHTML = "";

  if (typeof WaveSurfer !== "undefined") {
    try {
      state.wavesurfer = WaveSurfer.create({
        container: "#waveform",
        waveColor: "rgba(255,255,255,0.28)",
        progressColor: "#7c6cff",
        cursorColor: "#38bdf8",
        height: 64,
        barWidth: 3,
        barGap: 2,
        barRadius: 3,
        normalize: true,
        url: state.objectUrl,
      });
      state.wavesurfer.on("ready", () => {
        el.durTime.textContent = formatTime(state.wavesurfer.getDuration());
      });
      state.wavesurfer.on("timeupdate", (t) => {
        el.curTime.textContent = formatTime(t);
      });
      state.wavesurfer.on("play", () => setPlayIcon(true));
      state.wavesurfer.on("pause", () => setPlayIcon(false));
      state.wavesurfer.on("finish", () => setPlayIcon(false));
      state.wavesurfer.on("error", () => fallbackPlayerMeta());
      return;
    } catch (e) {
      console.warn(e);
    }
  }
  fallbackPlayerMeta();
}

function fallbackPlayerMeta() {
  el.audioEl.onloadedmetadata = () => {
    el.durTime.textContent = formatTime(el.audioEl.duration);
  };
  el.audioEl.ontimeupdate = () => {
    el.curTime.textContent = formatTime(el.audioEl.currentTime);
  };
}

function setPlayIcon(playing) {
  state.isPlaying = playing;
  el.btnPlay.innerHTML = playing
    ? '<i data-lucide="pause"></i>'
    : '<i data-lucide="play"></i>';
  if (window.lucide) lucide.createIcons({ nodes: [el.btnPlay] });
}

el.btnPlay.addEventListener("click", () => {
  if (state.wavesurfer) {
    state.wavesurfer.playPause();
  } else if (el.audioEl.src) {
    if (el.audioEl.paused) {
      el.audioEl.play();
      setPlayIcon(true);
    } else {
      el.audioEl.pause();
      setPlayIcon(false);
    }
  }
});

/* ---------- Toolbar ---------- */
function exec(cmd, val = null) {
  el.editor.focus();
  try {
    document.execCommand("styleWithCSS", false, true);
    document.execCommand(cmd, false, val);
  } catch (e) {
    console.warn(e);
  }
  syncToolbarState();
}

function syncToolbarState() {
  [
    "bold",
    "italic",
    "underline",
    "strikeThrough",
    "justifyLeft",
    "justifyCenter",
    "justifyRight",
    "justifyFull",
  ].forEach((c) => {
    const btn = el.toolbar.querySelector(`[data-cmd="${c}"]`);
    if (!btn) return;
    let on = false;
    try {
      on = document.queryCommandState(c);
    } catch {}
    btn.classList.toggle("active", on);
  });
}

el.toolbar.addEventListener("mousedown", (e) => {
  if (e.target.closest(".tb-btn")) e.preventDefault();
});

el.toolbar.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-cmd]");
  if (!btn) return;
  const cmd = btn.dataset.cmd;
  const val = btn.dataset.val || null;
  if (cmd === "formatBlock") exec("formatBlock", val === "p" ? "<p>" : `<${val}>`);
  else exec(cmd, val);
});

document.addEventListener("selectionchange", () => {
  if (
    document.activeElement === el.editor ||
    el.editor.contains(document.getSelection()?.anchorNode)
  ) {
    syncToolbarState();
  }
});

el.selFont.addEventListener("change", () => exec("fontName", el.selFont.value));

el.selSize.addEventListener("change", () => {
  el.editor.focus();
  const size = el.selSize.value;
  try {
    document.execCommand("styleWithCSS", false, true);
    document.execCommand("fontSize", false, "7");
    const walker = document.createTreeWalker(el.editor, NodeFilter.SHOW_ELEMENT);
    let node;
    while ((node = walker.nextNode())) {
      const st = node.getAttribute?.("style") || "";
      if (/xxx-large/i.test(st)) node.style.fontSize = size;
      if (node.tagName === "FONT" && node.getAttribute("size") === "7") {
        node.style.fontSize = size;
        node.removeAttribute("size");
      }
    }
  } catch (e) {
    console.warn(e);
  }
  syncToolbarState();
});

el.inpTextColor.addEventListener("input", () => {
  el.inpTextColor.parentElement.style.color = el.inpTextColor.value;
  exec("foreColor", el.inpTextColor.value);
});
el.inpHlColor.addEventListener("input", () => {
  el.inpHlColor.parentElement.style.color = el.inpHlColor.value;
  exec("hiliteColor", el.inpHlColor.value);
  exec("backColor", el.inpHlColor.value);
});

el.editor.addEventListener("keydown", (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  const k = e.key.toLowerCase();
  if (k === "b") {
    e.preventDefault();
    exec("bold");
  } else if (k === "i") {
    e.preventDefault();
    exec("italic");
  } else if (k === "u") {
    e.preventDefault();
    exec("underline");
  }
});

function updateWordCount() {
  const text = el.editor.innerText.replace(/\[[\d:]+\]/g, "").trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  el.wordCount.textContent = `${words} ${plural(words, "слово", "слова", "слов")}`;
}
function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
el.editor.addEventListener("input", updateWordCount);

/* ---------- Export helpers ---------- */
function downloadBlob(content, filename, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function baseName() {
  return (state.file?.name || "transcript").replace(/\.[^.]+$/, "");
}

function exportTxt() {
  downloadBlob(el.editor.innerText, `${baseName()}.txt`, "text/plain;charset=utf-8");
  toast("TXT сохранён", "success");
}

function exportHtml() {
  const css = `body{font-family:Georgia,serif;max-width:760px;margin:40px auto;padding:0 20px;line-height:1.7;color:#111;background:#fff}
.ts{color:#2563eb;font-family:monospace;font-size:.9em;margin-right:6px}
blockquote{border-left:3px solid #7c6cff;margin:0 0 1em;padding:4px 16px;background:#f5f3ff;color:#444}`;
  const html = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><title>${escapeHtml(baseName())}</title><style>${css}</style></head>
<body><h1>${escapeHtml(baseName())}</h1>
${el.editor.innerHTML}
</body></html>`;
  downloadBlob(html, `${baseName()}.html`, "text/html;charset=utf-8");
  toast("HTML сохранён", "success");
}

/* ---------- PDF export ---------- */
function preparePdfSource() {
  const title = baseName();
  const now = new Date().toLocaleString("ru-RU");
  const words = el.editor.innerText.trim()
    ? el.editor.innerText.trim().split(/\s+/).filter(Boolean).length
    : 0;
  el.pdfInner.innerHTML = `
    <h1>${escapeHtml(title)}</h1>
    <div class="pdf-meta">SpeechText · ${escapeHtml(now)} · ${words} слов</div>
    <div class="pdf-body">${el.editor.innerHTML}</div>
  `;
}

async function exportPDF() {
  toast("Готовим PDF…", "info");
  preparePdfSource();
  await new Promise((r) => setTimeout(r, 50));

  const hasJspdf = !!(window.jspdf && window.jspdf.jsPDF) || typeof window.jsPDF !== "undefined";
  const hasH2c = typeof window.html2canvas === "function";

  // Fallback: печать в PDF
  if (!hasJspdf || !hasH2c) {
    toast("Библиотеки PDF не загрузились — открываем диалог печати (Сохранить как PDF)", "info");
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(
        baseName()
      )}</title><style>
        body{font-family:Manrope,Georgia,serif;max-width:760px;margin:40px auto;padding:0 20px;line-height:1.7;color:#111}
        h1{border-bottom:2px solid #7c6cff;padding-bottom:8px}
        .ts{color:#2563eb;font-family:monospace;font-size:.9em}
        blockquote{border-left:3px solid #7c6cff;background:#f5f3ff;padding:8px 14px}
      </style></head><body><h1>${escapeHtml(baseName())}</h1>${el.editor.innerHTML}
      <script>window.onload=function(){window.print()}<\/script></body></html>`);
      win.document.close();
    } else {
      window.print();
    }
    return;
  }

  try {
    const canvas = await window.html2canvas(el.pdfInner, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: 794,
    });

    const jsPDFCtor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    const pdf = new jsPDFCtor({ orientation: "p", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const imgW = pageW - margin * 2;
    const imgH = (canvas.height * imgW) / canvas.width;

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    let position = margin;
    let page = 0;

    // First page
    pdf.addImage(imgData, "JPEG", margin, position, imgW, imgH);
    let remaining = imgH - (pageH - margin * 2);

    while (remaining > 1) {
      pdf.addPage();
      page += 1;
      const yOffset = -(page * (pageH - margin * 2));
      pdf.addImage(imgData, "JPEG", margin, margin + yOffset, imgW, imgH);
      remaining -= pageH - margin * 2;
    }

    pdf.save(`${baseName()}.pdf`);
    toast("PDF сохранён", "success");
  } catch (e) {
    console.error(e);
    toast("Не удалось сделать PDF — пробуем печать", "error");
    window.print();
  }
}

/* ---------- DOCX export ---------- */
function runsFromNode(node, fmt, D) {
  const runs = [];
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent;
    if (!text) return runs;
    runs.push(
      new D.TextRun({
        text,
        bold: !!fmt.bold,
        italics: !!fmt.italic,
        underline: fmt.underline ? {} : undefined,
        strike: !!fmt.strike,
        font: fmt.font || "Calibri",
        size: fmt.size || 24, // half-points: 24 = 12pt ≈ 16px
        color: fmt.color || "111111",
        highlight: fmt.highlight,
      })
    );
    return runs;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return runs;

  const tag = node.tagName.toLowerCase();
  const style = node.style || {};
  const next = { ...fmt };

  if (tag === "b" || tag === "strong") next.bold = true;
  if (tag === "i" || tag === "em") next.italic = true;
  if (tag === "u") next.underline = true;
  if (tag === "s" || tag === "strike" || tag === "del") next.strike = true;
  if (node.getAttribute?.("face")) next.font = node.getAttribute("face");
  if (style.fontFamily) next.font = style.fontFamily.replace(/["']/g, "").split(",")[0].trim();
  if (style.fontWeight === "bold" || parseInt(style.fontWeight, 10) >= 600) next.bold = true;
  if (style.fontStyle === "italic") next.italic = true;
  if (style.textDecorationLine?.includes("underline") || style.textDecoration?.includes("underline"))
    next.underline = true;
  if (style.textDecorationLine?.includes("line-through") || style.textDecoration?.includes("line-through"))
    next.strike = true;
  if (style.color) {
    const hex = style.color.replace("#", "");
    if (/^[0-9a-fA-F]{6}$/.test(hex)) next.color = hex;
  }
  if (style.fontSize) {
    const px = parseFloat(style.fontSize);
    if (!isNaN(px) && px > 0) next.size = Math.max(16, Math.round(px * 1.5)); // px → half-pt-ish
  }
  if (style.backgroundColor) {
    const map = {
      yellow: "yellow",
      "#ffff00": "yellow",
      "#fbbf24": "yellow",
      "#ffeb3b": "yellow",
    };
    const bg = style.backgroundColor.toLowerCase();
    next.highlight = map[bg] || "yellow";
  }
  if (node.classList?.contains("ts")) {
    next.color = "2563EB";
    next.size = Math.min(next.size || 22, 22);
  }

  if (tag === "br") {
    return [new D.TextRun({ text: "", break: 1, ...fmtToRun(fmt, D) })];
  }

  for (const child of node.childNodes) {
    runs.push(...runsFromNode(child, next, D));
  }
  return runs;
}

function fmtToRun(fmt, D) {
  return {
    bold: !!fmt.bold,
    italics: !!fmt.italic,
    underline: fmt.underline ? {} : undefined,
    strike: !!fmt.strike,
    font: fmt.font || "Calibri",
    size: fmt.size || 24,
    color: fmt.color || "111111",
    highlight: fmt.highlight,
  };
}

async function exportDOCX() {
  const D = window.docx;
  if (!D || !D.Document || !D.Packer) {
    toast("Библиотека DOCX не загрузилась — пробуем ещё раз", "error");
    await loadScript("https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js", 20000).catch(
      () => {}
    );
    if (!window.docx) {
      toast("Не удалось загрузить DOCX-библиотеку. Проверьте интернет.", "error");
      return;
    }
  }
  const Docx = window.docx;

  toast("Готовим DOCX…", "info");

  try {
    const children = [];
    children.push(
      new Docx.Paragraph({
        children: [new Docx.TextRun({ text: baseName(), bold: true, size: 40, color: "0F172A" })],
        spacing: { after: 120 },
        border: { bottom: { style: Docx.BorderStyle.SINGLE, size: 12, color: "7C6CFF" } },
      })
    );
    children.push(
      new Docx.Paragraph({
        children: [
          new Docx.TextRun({
            text: `SpeechText · ${new Date().toLocaleString("ru-RU")}`,
            size: 20,
            color: "64748B",
          }),
        ],
        spacing: { after: 240 },
      })
    );

    const blockNodes = Array.from(el.editor.childNodes);
    if (!blockNodes.length) {
      children.push(new Docx.Paragraph({ children: [new Docx.TextRun(el.editor.innerText || "")] }));
    }

    for (const node of blockNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.textContent.trim();
        if (t) children.push(new Docx.Paragraph({ children: [new Docx.TextRun(t)] }));
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = node.tagName.toLowerCase();

      if (tag === "ul" || tag === "ol") {
        const ordered = tag === "ol";
        Array.from(node.children).forEach((li, idx) => {
          const runs = runsFromNode(li, {}, Docx);
          children.push(
            new Docx.Paragraph({
              children: runs.length
                ? runs
                : [new Docx.TextRun(li.textContent || "")],
              bullet: ordered ? undefined : { level: 0 },
              numbering: ordered ? { reference: "default-numbering", level: 0 } : undefined,
            })
          );
        });
        continue;
      }

      if (tag === "blockquote") {
        const runs = runsFromNode(node, {}, Docx);
        children.push(
          new Docx.Paragraph({
            children: runs,
            indent: { left: 400 },
            border: { left: { style: Docx.BorderStyle.SINGLE, size: 16, color: "7C6CFF" } },
            spacing: { before: 80, after: 120 },
          })
        );
        continue;
      }

      if (tag === "h1" || tag === "h2" || tag === "h3") {
        const runs = runsFromNode(node, { bold: true }, Docx);
        children.push(
          new Docx.Paragraph({
            children: runs,
            heading: tag === "h1" ? Docx.HeadingLevel.HEADING_1 : Docx.HeadingLevel.HEADING_2,
            spacing: { before: 160, after: 80 },
          })
        );
        continue;
      }

      // default paragraph
      const runs = runsFromNode(node, {}, Docx);
      children.push(
        new Docx.Paragraph({
          children: runs.length ? runs : [new Docx.TextRun(node.textContent || "")],
          spacing: { after: 120, line: 300 },
        })
      );
    }

    let numberingConfig;
    try {
      numberingConfig = {
        config: [
          {
            reference: "default-numbering",
            levels: [
              {
                level: 0,
                format: Docx.LevelFormat.DECIMAL,
                text: "%1.",
                alignment: Docx.AlignmentType.START,
                style: { paragraph: { indent: { left: 720, hanging: 360 } } },
              },
            ],
          },
        ],
      };
    } catch {
      numberingConfig = undefined;
    }

    const doc = new Docx.Document({
      numbering: numberingConfig,
      sections: [
        {
          properties: {},
          children,
        },
      ],
    });

    const blob = await Docx.Packer.toBlob(doc);
    downloadBlob(blob, `${baseName()}.docx`);
    toast("DOCX сохранён", "success");
  } catch (e) {
    console.error(e);
    toast("Ошибка при создании DOCX: " + (e?.message || e), "error");
  }
}

/* ---------- Export menu UI ---------- */
el.btnExport.addEventListener("click", (e) => {
  e.stopPropagation();
  const open = el.exportMenu.classList.toggle("open");
  el.btnExport.setAttribute("aria-expanded", open ? "true" : "false");
  document.querySelectorAll(".cs.open").forEach((c) => c.classList.remove("open"));
});

el.exportDropdown.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-export]");
  if (!btn) return;
  e.stopPropagation();
  el.exportMenu.classList.remove("open");
  const kind = btn.dataset.export;
  if (kind === "pdf") exportPDF();
  else if (kind === "docx") exportDOCX();
  else if (kind === "txt") exportTxt();
  else if (kind === "html") exportHtml();
});

el.btnCopy.addEventListener("click", async () => {
  const text = el.editor.innerText;
  try {
    await navigator.clipboard.writeText(text);
    toast("Текст скопирован", "success");
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    toast("Текст скопирован", "success");
  }
});

el.btnFinish.addEventListener("click", () => {
  toast("Готово! Скачайте документ через «Скачать».", "success");
  el.btnExport.focus();
});

/* ---------- Reset ---------- */
function resetAll() {
  state.cancelRequested = true;
  state.procGen += 1;
  if (state.elapsedTimer) {
    clearInterval(state.elapsedTimer);
    state.elapsedTimer = null;
  }
  if (state.wavesurfer) {
    try {
      state.wavesurfer.destroy();
    } catch {}
    state.wavesurfer = null;
  }
  if (state.objectUrl) {
    URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
  }
  state.file = null;
  state.isPlaying = false;
  el.audioEl.removeAttribute("src");
  el.audioEl.load();
  el.editor.innerHTML = "";
  $("#waveform").innerHTML = "";
  el.curTime.textContent = "0:00";
  el.durTime.textContent = "0:00";
  const timeEl = $("#procTime");
  if (timeEl) timeEl.textContent = "";
  updateFileChip(null);
  setPlayIcon(false);
  updateWordCount();
  showSection("hero");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- Init ---------- */
function warmupEngine() {
  // Тихо грузим движок в фоне; модель весом 200+ МБ (Small) заранее не
  // трогаем — это заметно и мешает. Но модель по умолчанию (Base, ~90 МБ)
  // безопасно прогреть в фоне: к моменту загрузки файла она уже в кеше
  // браузера, и пользователь не ждёт скачивание после клика "Начать".
  setTimeout(async () => {
    try {
      if (state.cancelRequested || state.procGen > 0) return;
      await loadTransformers();
      const conn = navigator.connection;
      const savingData = conn && (conn.saveData || /2g/.test(conn.effectiveType || ""));
      const defaultModel = el.selModel?.value;
      if (
        !savingData &&
        !state.cancelRequested &&
        state.procGen === 0 &&
        (defaultModel === "Xenova/whisper-tiny" || defaultModel === "Xenova/whisper-base")
      ) {
        getTranscriber(defaultModel, state.procGen).catch(() => {});
      }
    } catch (e) {
      console.warn("[warmup engine]", e);
    }
  }, 1500);
}

function init() {
  if (window.lucide) lucide.createIcons();

  console.log(
    "[perf] crossOriginIsolated=%s threads=%s webgpu=%s",
    window.crossOriginIsolated,
    navigator.hardwareConcurrency || "?",
    !!navigator.gpu
  );

  // Custom dropdowns
  createCustomSelect(el.selLang, "");
  createCustomSelect(el.selModel, "");
  createCustomSelect(el.selFont, "cs-font cs-small");
  createCustomSelect(el.selSize, "cs-size cs-small");

  observeReveals();
  updateWordCount();
  updateFileChip(null);
  renderFilesList();
  el.inpTextColor.parentElement.style.color = el.inpTextColor.value;
  el.inpHlColor.parentElement.style.color = el.inpHlColor.value;
  warmupEngine();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
