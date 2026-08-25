const employees = [
  "Рома",
  "Вика",
  "Арина",
  "Карина",
  "Андрей"
];

const employeeSelect = document.getElementById("employeeSelect");
const worksContainer = document.getElementById("works");

const modalOverlay = document.getElementById("modalOverlay");
const modalClose = document.getElementById("modalClose");
const winnersList = document.getElementById("winnersList");

const waitModalOverlay = document.getElementById("waitModalOverlay");
const waitModalClose = document.getElementById("waitModalClose");

const stickyCounter = document.getElementById("stickyCounter");
const stickyCounterText = document.getElementById("stickyCounterText");
const voteAnimBadge = document.getElementById("voteAnimBadge");
const toast = document.getElementById("toast");

const memeImage = document.getElementById("memeImage");
const healImgBox = document.getElementById("healImgBox");
const healHintBox = document.getElementById("healHintBox");
const flashOverlay = document.getElementById("flashOverlay");
const explosionOverlay = document.getElementById("explosionOverlay");
const heartsContainer = document.getElementById("heartsContainer");
const ronaldoGrid = document.getElementById("ronaldoGrid");
const waitCardBox = document.getElementById("waitCardBox");
const waitTitle = document.getElementById("waitTitle");
const waitText = document.getElementById("waitText");

let clickStage = 0;
let subClickCount = 0;

let votes = [];
let works = [];

if (employeeSelect) {
  employees.forEach(name => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    employeeSelect.appendChild(option);
  });
}

function getEmployeeMaxVotes(empName) {
  if (empName === "Вика") return 7;
  if (empName === "Андрей") return 6;
  return 10;
}

function showToast(text) {
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add("active");
  setTimeout(() => toast.classList.remove("active"), 2000);
}

async function loadVotes() {
  try {
    const response = await fetch(`/api/votes?_t=${Date.now()}`);
    const data = await response.json();
    votes = data.records || [];
  } catch (err) {
    console.error("Ошибка загрузки голосов:", err);
  }
}

async function loadWorks() {
  try {
    const response = await fetch(`/api/works?_t=${Date.now()}`);
    const data = await response.json();
    works = data.records || [];

    works.sort((a, b) => {
      const aFields = a.fields || {};
      const bFields = b.fields || {};

      const aZalet = String(aFields["Примечания"] || "").toLowerCase().includes("залетный");
      const bZalet = String(bFields["Примечания"] || "").toLowerCase().includes("залетный");

      if (aZalet && !bZalet) return 1;
      if (!aZalet && bZalet) return -1;

      const aText = String(aFields["Описание"] || aFields["Текст"] || aFields["Заметка"] || "").trim();
      const bText = String(bFields["Описание"] || bFields["Текст"] || bFields["Заметка"] || "").trim();

      const aHasVideo = (aFields["Конкурсные работы"] || []).some(f => f.type?.startsWith("video"));
      const bHasVideo = (bFields["Конкурсные работы"] || []).some(f => f.type?.startsWith("video"));

      const aScore = (aText ? (aHasVideo ? 3 : 2) : 1);
      const bScore = (bText ? (bHasVideo ? 3 : 2) : 1);

      return bScore - aScore;
    });

    renderWorks();
    checkHashUrl();
  } catch (err) {
    console.error("Ошибка загрузки работ:", err);
  }
}

function getVotesForWork(workId) {
  return votes.filter(vote => {
    const workField = vote.fields["Contest Work"];
    if (Array.isArray(workField)) {
      return workField.includes(workId);
    }
    return workField === workId;
  }).length;
}

function getEmployeeVotes(empName = employeeSelect.value) {
  if (!empName) return 0;
  return votes.filter(vote => vote.fields["Voter Name"] === empName).length;
}

function getAuthorVote(username) {
  return votes.find(vote => {
    const workIds = vote.fields["Contest Work"] || [];
    const targetWorkId = Array.isArray(workIds) ? workIds[0] : workIds;
    const work = works.find(item => item.id === targetWorkId);
    return (
      vote.fields["Voter Name"] === employeeSelect.value &&
      work?.fields?.Username === username
    );
  });
}

function hasCurrentWorkVote(workId) {
  return votes.some(vote => {
    const workField = vote.fields["Contest Work"];
    const isMatch = Array.isArray(workField) ? workField.includes(workId) : (workField === workId);
    return vote.fields["Voter Name"] === employeeSelect.value && isMatch;
  });
}

function renderMedia(files) {
  if (!files || !files.length) return "";

  if (files.length === 1) {
    const file = files[0];
    if (file.type?.startsWith("video")) {
      return `<video controls preload="metadata" src="${file.url}"></video>`;
    }
    return `<img src="${file.url}" alt="work" loading="lazy">`;
  }

  return `
    <div class="slider">
      <button type="button" class="slider-prev">‹</button>
      <div class="slider-items">
        ${files.map((file, index) => {
          if (file.type?.startsWith("video")) {
            return `<video class="slider-item ${index === 0 ? "active" : ""}" controls preload="metadata" src="${file.url}"></video>`;
          }
          return `<img class="slider-item ${index === 0 ? "active" : ""}" src="${file.url}" alt="work" loading="lazy">`;
        }).join("")}
      </div>
      <button type="button" class="slider-next">›</button>
    </div>
  `;
}

function renderWorks() {
  if (!worksContainer) return;
  worksContainer.innerHTML = "";

  works.forEach(record => {
    const fields = record.fields;
    if (!fields.Username || !fields["Конкурсные работы"]?.length) return;

    const rawUsername = String(fields.Username).replace(/^@+/, '');
    const authorVote = getAuthorVote(fields.Username);
    const currentWorkVote = hasCurrentWorkVote(record.id);
    const workDescription = fields["Описание"] || fields["Текст"] || fields["Заметка"] || "";

    const card = document.createElement("div");
    card.className = "card";
    card.dataset.workId = record.id;

    card.innerHTML = `
      ${renderMedia(fields["Конкурсные работы"])}
      
      <div class="card-content">
        <div class="card-header">
          <div class="username">@${rawUsername}</div>
          <div class="votes-badge">❤️ ${getVotesForWork(record.id)}</div>
        </div>

        ${workDescription ? `
          <div class="work-text-container">
            <div class="work-text">${workDescription}</div>
            ${workDescription.length > 80 ? `<button type="button" class="text-toggle-btn">Читать полностью ▼</button>` : ''}
          </div>
        ` : ''}

        <div class="button-row">
          <button
            class="vote-button ${currentWorkVote ? "remove" : ""}"
            data-work="${record.id}"
            data-author="${fields.Username}"
            ${employeeSelect.value && (!authorVote || currentWorkVote) ? "" : "disabled"}
          >
            ${currentWorkVote ? "Убрать голос" : authorVote ? "За автора уже отдано" : "Голосовать"}
          </button>

          ${fields["Ссылка на пост"] ? `
            <a class="link-button" href="${fields["Ссылка на пост"]}" target="_blank" rel="noopener noreferrer">🔗</a>
          ` : ""}
        </div>
      </div>
    `;

    worksContainer.appendChild(card);
  });
}

function updateUIAfterVote() {
  const currentVoter = employeeSelect.value;

  works.forEach(record => {
    const card = worksContainer.querySelector(`[data-work-id="${record.id}"]`);
    if (!card) return;

    const votesBadge = card.querySelector(".votes-badge");
    const voteButton = card.querySelector(".vote-button");

    if (votesBadge) {
      votesBadge.textContent = `❤️ ${getVotesForWork(record.id)}`;
    }

    if (voteButton) {
      const authorVote = getAuthorVote(record.fields.Username);
      const currentWorkVote = hasCurrentWorkVote(record.id);

      if (currentWorkVote) {
        voteButton.className = "vote-button remove";
        voteButton.textContent = "Убрать голос";
        voteButton.disabled = false;
      } else if (authorVote) {
        voteButton.className = "vote-button";
        voteButton.textContent = "За автора уже отдано";
        voteButton.disabled = true;
      } else {
        voteButton.className = "vote-button";
        voteButton.textContent = "Голосовать";
        voteButton.disabled = !currentVoter;
      }
    }
  });

  updateCounterDisplay();
}

function handleCompletionModal() {
  const finishedEmployeesCount = employees.filter(empName => getEmployeeVotes(empName) >= getEmployeeMaxVotes(empName)).length;

  if (finishedEmployeesCount >= employees.length) {
    showWinnersModal();
  } else {
    clickStage = 0;
    subClickCount = 0;
    if (memeImage) memeImage.src = "hate2.jpg";
    if (healImgBox) healImgBox.style.display = "block";
    if (ronaldoGrid) {
      ronaldoGrid.style.display = "none";
      const cards = ronaldoGrid.querySelectorAll(".uno-card");
      cards.forEach((c, idx) => {
        c.className = `uno-card pos-${idx}`;
      });
    }
    if (waitTitle) waitTitle.textContent = "Твой голос учтен!";
    if (waitText) {
      waitText.style.display = "block";
      waitText.innerHTML = "Чья-то нервная система уже готовится к хейту в чате.<br>Да прибудет с вами сила 🫡";
    }
    if (healHintBox) {
      healHintBox.style.display = "flex";
      healHintBox.className = "heal-hint-box";
      healHintBox.innerHTML = `
        <span class="hint-text">Нажми три раза, если хочешь помочь девочкам захиллиться 💅</span>
        <span class="hint-arrow">👇</span>
      `;
    }
    waitModalOverlay.classList.add("active");
  }
}

function triggerClickFeedback(isWarning = false) {
  if (!healImgBox) return;
  healImgBox.classList.remove("click-shake");
  void healImgBox.offsetWidth;
  healImgBox.classList.add("click-shake");
  createMiniPopEffect(isWarning);
}

function createMiniPopEffect(isWarning) {
  if (!heartsContainer) return;
  const emojis = isWarning ? ["💥", "💢", "⚠️", "❌", "🔥"] : ["✨", "💖", "🍻", "⚡", "💅"];

  for (let i = 0; i < 5; i++) {
    const el = document.createElement("div");
    el.className = "floating-heart";
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.left = `${40 + (Math.random() * 20 - 10)}%`;
    el.style.top = `${30 + (Math.random() * 20 - 10)}%`;
    el.style.animationDuration = `${0.8 + Math.random() * 0.5}s`;
    heartsContainer.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }
}

if (healImgBox) {
  healImgBox.addEventListener("click", () => {
    subClickCount++;

    if (clickStage === 0) {
      triggerClickFeedback(false);
      if (subClickCount >= 3) {
        clickStage = 1;
        subClickCount = 0;

        healImgBox.classList.add("magic-transition");
        flashOverlay.classList.add("active");

        setTimeout(() => {
          memeImage.src = "heal.jpg";
          if (healHintBox) {
            healHintBox.innerHTML = `<span>Спасибо 💖🍻</span>`;
            healHintBox.className = "heal-hint-box healed";
          }
        }, 350);

        setTimeout(() => {
          flashOverlay.classList.remove("active");
          healImgBox.classList.remove("magic-transition");
        }, 700);

        createHeartsEffect();
        return;
      }
      return;
    }

    if (clickStage === 1) {
      triggerClickFeedback(true);
      if (subClickCount >= 3) {
        clickStage = 2;
        subClickCount = 0;

        memeImage.src = "barbie.jpg";
        if (healHintBox) {
          healHintBox.innerHTML = `<span>Ты что наделал? 🥲💣</span>`;
          healHintBox.className = "heal-hint-box warning";
        }

        setTimeout(() => {
          triggerExplosionAndUNO();
        }, 1300);
      }
      return;
    }
  });
}

if (ronaldoGrid) {
  ronaldoGrid.addEventListener("click", () => {
    if (clickStage === 3) {
      const cards = Array.from(ronaldoGrid.querySelectorAll(".uno-card"));
      const topCard = cards.find(c => c.classList.contains("pos-0"));

      if (topCard) {
        topCard.classList.add("swapping");

        setTimeout(() => {
          cards.forEach(c => {
            let currentPos = parseInt(c.dataset.pos);
            let newPos = (currentPos - 1 + cards.length) % cards.length;
            c.dataset.pos = newPos;
            c.className = `uno-card pos-${newPos}`;
          });
          topCard.classList.remove("swapping");
        }, 200);
      }
    }
  });
}

function triggerExplosionAndUNO() {
  if (explosionOverlay) explosionOverlay.classList.add("active");
  if (waitCardBox) waitCardBox.classList.add("shake");

  setTimeout(() => {
    clickStage = 3;
    if (healImgBox) healImgBox.style.display = "none";
    if (healHintBox) healHintBox.style.display = "none";

    if (waitTitle) waitTitle.textContent = "Сила ИИндии теперь с тобой!";
    if (waitText) waitText.style.display = "none";

    if (ronaldoGrid) ronaldoGrid.style.display = "block";
  }, 700);

  setTimeout(() => {
    if (explosionOverlay) explosionOverlay.classList.remove("active");
    if (waitCardBox) waitCardBox.classList.remove("shake");
  }, 1600);
}

function createHeartsEffect() {
  if (!heartsContainer) return;
  heartsContainer.innerHTML = "";

  const emojis = ["❤️", "💖", "💕", "🍻", "✨", "🥰"];

  for (let i = 0; i < 24; i++) {
    const heart = document.createElement("div");
    heart.className = "floating-heart";
    heart.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    heart.style.left = `${Math.random() * 85 + 5}%`;
    heart.style.animationDelay = `${Math.random() * 0.5}s`;
    heart.style.animationDuration = `${1.8 + Math.random() * 0.8}s`;
    heartsContainer.appendChild(heart);
  }
}

// ИДЕАЛЬНЫЙ ПОП-АП ПОБЕДИТЕЛЕЙ (БЕЗ СЕРДЕЧЕК И БЕЗ ЦИФР ГОЛОСОВ)
window.showWinnersModal = function() {
  const top10 = [
    { author: "BladeTag", postLink: "https://t.me/qq1win/5273481" },
    { author: "s3x1r", postLink: "https://t.me/qq1win/5273675" },
    { author: "Jeka_23", postLink: "https://t.me/qq1win/5274743" },
    { author: "Felice_Kr", postLink: "https://t.me/qq1win/5271739" },
    { author: "snchzs887", postLink: "https://t.me/qq1win/5272129" },
    { author: "kkaaaooo", postLink: "https://t.me/qq1win/5272269" },
    { author: "RussianTelevisionTV", postLink: "https://t.me/qq1win/5272883" },
    { author: "timmimimmi", postLink: "https://t.me/qq1win/5273144" },
    { author: "Lev_Borisovv", postLink: "https://t.me/qq1win/5274744" },
    { author: "kksskkl", postLink: "https://t.me/qq1win/5271902" }
  ];

  if (winnersList) {
    winnersList.innerHTML = "";

    top10.forEach((item, index) => {
      const el = document.createElement("div");
      el.className = "winner-item";
      el.innerHTML = `
        <div class="winner-rank">${index + 1}</div>
        <button class="copy-user-btn" data-copy-user="@${item.author}">
          @${item.author}
        </button>
        <div class="winner-actions">
          <button class="copy-post-btn" data-copy-link="${item.postLink}">
            🔗 Скопировать ссылку
          </button>
        </div>
      `;
      winnersList.appendChild(el);
    });
  }

  if (modalOverlay) {
    modalOverlay.classList.add("active");
  }
};

function checkHashUrl() {
  if (window.location.hash === "#winners") {
    showWinnersModal();
  }
}

window.addEventListener("hashchange", checkHashUrl);

document.addEventListener("click", async e => {
  const userBtn = e.target.closest("[data-copy-user]");
  if (userBtn) {
    const username = userBtn.dataset.copyUser;
    navigator.clipboard.writeText(username);
    showToast(`Ник ${username} скопирован!`);
    return;
  }

  const linkBtn = e.target.closest("[data-copy-link]");
  if (linkBtn) {
    const link = linkBtn.dataset.copyLink;
    navigator.clipboard.writeText(link);
    showToast("Ссылка на пост скопирована!");
    return;
  }

  if (e.target.classList.contains("text-toggle-btn")) {
    const btn = e.target;
    const textBlock = btn.previousElementSibling;
    const isExpanded = textBlock.classList.toggle("expanded");
    btn.textContent = isExpanded ? "Свернуть ▲" : "Читать полностью ▼";
    return;
  }

  if (e.target.classList.contains("slider-next") || e.target.classList.contains("slider-prev")) {
    const slider = e.target.closest(".slider");
    const items = slider.querySelectorAll(".slider-item");
    let current = [...items].findIndex(item => item.classList.contains("active"));

    items[current].classList.remove("active");

    if (e.target.classList.contains("slider-next")) {
      current = (current + 1) % items.length;
    } else {
      current = (current - 1 + items.length) % items.length;
    }

    items[current].classList.add("active");
    return;
  }

  if (!e.target.classList.contains("vote-button")) return;

  const scrollPosition = window.scrollY;

  const button = e.target;
  const voterName = employeeSelect.value;
  const contestWork = button.dataset.work;

  if (!voterName) return;

  const removing = button.classList.contains("remove");
  const maxAllowed = getEmployeeMaxVotes(voterName);

  if (!removing && getEmployeeVotes() >= maxAllowed) {
    handleCompletionModal();
    return;
  }

  if (voteAnimBadge) {
    voteAnimBadge.textContent = removing ? "+1" : "-1";
    voteAnimBadge.className = `vote-anim-badge ${removing ? "anim-remove" : "anim-add"}`;
    setTimeout(() => { voteAnimBadge.className = "vote-anim-badge"; }, 800);
  }

  if (removing) {
    votes = votes.filter(vote => {
      const workField = vote.fields["Contest Work"];
      const isMatch = Array.isArray(workField) ? workField.includes(contestWork) : (workField === contestWork);
      return !(vote.fields["Voter Name"] === voterName && isMatch);
    });
  } else {
    votes.push({
      id: "temp_" + Date.now(),
      fields: {
        "Voter Name": voterName,
        "Contest Work": [contestWork]
      }
    });
  }

  updateUIAfterVote();
  window.scrollTo({ top: scrollPosition, behavior: 'instant' });

  if (getEmployeeVotes() === maxAllowed && !removing) {
    setTimeout(handleCompletionModal, 300);
  }

  try {
    await fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voterName,
        contestWork,
        action: removing ? "delete" : "add"
      })
    });
    
    setTimeout(async () => {
      await loadVotes();
      updateUIAfterVote();
    }, 800);

  } catch (err) {
    console.error("Ошибка сохранения голоса:", err);
  }
});

function updateCounterDisplay() {
  const counter = document.getElementById("votesLeft");
  const usedVotes = getEmployeeVotes();
  const maxAllowed = getEmployeeMaxVotes(employeeSelect.value);
  const remaining = maxAllowed - usedVotes;

  if (employeeSelect.value) {
    if (counter) counter.textContent = `Ваши голоса: ${usedVotes}/${maxAllowed}`;
    if (stickyCounterText) stickyCounterText.innerHTML = `Осталось голосов: <span>${remaining}</span>`;
    if (stickyCounter) stickyCounter.classList.add("visible");
  } else {
    if (counter) counter.textContent = "";
    if (stickyCounter) stickyCounter.classList.remove("visible");
  }
}

if (employeeSelect) {
  employeeSelect.addEventListener("change", () => {
    renderWorks();
    updateCounterDisplay();
  });
}

if (modalClose) {
  modalClose.addEventListener("click", () => modalOverlay.classList.remove("active"));
}
if (modalOverlay) {
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) modalOverlay.classList.remove("active");
  });
}

(async () => {
  await loadVotes();
  await loadWorks();
})();
