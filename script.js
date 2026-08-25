const employees = [
  "Рома",
  "Вика",
  "Арина",
  "Карина",
  "Ирина",
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

let votes = [];
let works = [];

employees.forEach(name => {
  const option = document.createElement("option");
  option.value = name;
  option.textContent = name;
  employeeSelect.appendChild(option);
});

function showToast(text) {
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add("active");
  setTimeout(() => toast.classList.remove("active"), 2000);
}

async function loadVotes() {
  try {
    const response = await fetch("/api/votes");
    const data = await response.json();
    votes = data.records || [];
  } catch (err) {
    console.error("Ошибка загрузки голосов:", err);
  }
}

async function loadWorks() {
  try {
    const response = await fetch("/api/works");
    const data = await response.json();
    works = data.records || [];

    works.sort((a, b) => {
      const aZalet = String(a.fields["Примечания"] || "").toLowerCase().includes("залетный");
      const bZalet = String(b.fields["Примечания"] || "").toLowerCase().includes("залетный");
      if (aZalet && !bZalet) return 1;
      if (!aZalet && bZalet) return -1;
      return 0;
    });

    renderWorks();
    checkHashUrl();
  } catch (err) {
    console.error("Ошибка загрузки работ:", err);
  }
}

function getVotesForWork(workId) {
  return votes.filter(vote => vote.fields["Contest Work"]?.includes(workId)).length;
}

function getEmployeeVotes() {
  return votes.filter(vote => vote.fields["Voter Name"] === employeeSelect.value).length;
}

function getAuthorVote(username) {
  return votes.find(vote => {
    const workId = vote.fields["Contest Work"]?.[0];
    const work = works.find(item => item.id === workId);
    return (
      vote.fields["Voter Name"] === employeeSelect.value &&
      work?.fields?.Username === username
    );
  });
}

function hasCurrentWorkVote(workId) {
  return votes.some(vote =>
    vote.fields["Voter Name"] === employeeSelect.value &&
    vote.fields["Contest Work"]?.includes(workId)
  );
}

function renderMedia(files) {
  if (!files || !files.length) return "";

  if (files.length === 1) {
    const file = files[0];
    if (file.type?.startsWith("video")) {
      return `<video controls src="${file.url}"></video>`;
    }
    return `<img src="${file.url}" alt="work">`;
  }

  return `
    <div class="slider">
      <button type="button" class="slider-prev">‹</button>
      <div class="slider-items">
        ${files.map((file, index) => {
          if (file.type?.startsWith("video")) {
            return `<video class="slider-item ${index === 0 ? "active" : ""}" controls src="${file.url}"></video>`;
          }
          return `<img class="slider-item ${index === 0 ? "active" : ""}" src="${file.url}" alt="work">`;
        }).join("")}
      </div>
      <button type="button" class="slider-next">›</button>
    </div>
  `;
}

function renderWorks() {
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

function handleCompletionModal() {
  const maxPossibleVotes = employees.length * 10;
  
  if (votes.length >= maxPossibleVotes) {
    showWinnersModal();
  } else {
    waitModalOverlay.classList.add("active");
  }
}

function showWinnersModal() {
  const stats = works.map(w => {
    const cleanUser = String(w.fields.Username || "Аноним").replace(/^@+/, '');
    return {
      id: w.id,
      author: cleanUser,
      postLink: w.fields["Ссылка на пост"] || "",
      votes: getVotesForWork(w.id)
    };
  });

  stats.sort((a, b) => b.votes - a.votes);
  const top10 = stats.slice(0, 10);

  winnersList.innerHTML = "";

  top10.forEach((item, index) => {
    const el = document.createElement("div");
    el.className = "winner-item";
    el.innerHTML = `
      <div class="winner-rank">${index + 1}</div>
      <button class="winner-name-btn" data-copy-user="@${item.author}" title="Нажмите, чтобы скопировать">
        @${item.author} <span class="copy-icon">📋</span>
      </button>
      <div class="winner-actions">
        <div class="winner-count">❤️ ${item.votes}</div>
        ${item.postLink ? `
          <button class="copy-post-btn" data-copy-link="${item.postLink}">
            🔗 Пост
          </button>
        ` : ''}
      </div>
    `;
    winnersList.appendChild(el);
  });

  modalOverlay.classList.add("active");
}

function checkHashUrl() {
  if (window.location.hash === "#winners") {
    showWinnersModal();
  }
}

window.addEventListener("hashchange", checkHashUrl);

document.addEventListener("click", async e => {
  if (e.target.closest("[data-copy-user]")) {
    const username = e.target.closest("[data-copy-user]").dataset.copyUser;
    navigator.clipboard.writeText(username);
    showToast(`Юзернейм ${username} скопирован!`);
    return;
  }

  if (e.target.closest("[data-copy-link]")) {
    const link = e.target.closest("[data-copy-link]").dataset.copyLink;
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

  const button = e.target;
  const voterName = employeeSelect.value;
  const contestWork = button.dataset.work;

  if (!voterName) return;

  const removing = button.classList.contains("remove");

  if (!removing && getEmployeeVotes() >= 10) {
    handleCompletionModal();
    return;
  }

  // Запуск вылетающей анимации при клике
  if (voteAnimBadge) {
    voteAnimBadge.textContent = removing ? "+1" : "-1";
    voteAnimBadge.className = `vote-anim-badge ${removing ? "anim-remove" : "anim-add"}`;
    setTimeout(() => { voteAnimBadge.className = "vote-anim-badge"; }, 800);
  }

  if (removing) {
    votes = votes.filter(vote =>
      !(vote.fields["Voter Name"] === voterName && vote.fields["Contest Work"]?.includes(contestWork))
    );
  } else {
    votes.push({
      id: "temp",
      fields: {
        "Voter Name": voterName,
        "Contest Work": [contestWork]
      }
    });
  }

  renderWorks();
  updateCounterDisplay();

  if (getEmployeeVotes() === 10) {
    setTimeout(handleCompletionModal, 300);
  }

  await fetch("/api/vote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      voterName,
      contestWork,
      action: removing ? "delete" : "add"
    })
  });
});

function updateCounterDisplay() {
  const counter = document.getElementById("votesLeft");
  const usedVotes = getEmployeeVotes();
  const remaining = 10 - usedVotes;

  if (employeeSelect.value) {
    if (counter) counter.textContent = `Ваши голоса: ${usedVotes}/10`;
    if (stickyCounterText) stickyCounterText.innerHTML = `Осталось голосов: <span>${remaining}</span>`;
    if (stickyCounter) stickyCounter.classList.add("visible");
  } else {
    if (counter) counter.textContent = `Выберите имя, чтобы начать голосование`;
    if (stickyCounter) stickyCounter.classList.remove("visible");
  }
}

employeeSelect.addEventListener("change", () => {
  renderWorks();
  updateCounterDisplay();
  if (employeeSelect.value && getEmployeeVotes() === 10) {
    handleCompletionModal();
  }
});

if (modalClose) {
  modalClose.addEventListener("click", () => modalOverlay.classList.remove("active"));
}
if (modalOverlay) {
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) modalOverlay.classList.remove("active");
  });
}

if (waitModalClose) {
  waitModalClose.addEventListener("click", () => waitModalOverlay.classList.remove("active"));
}
if (waitModalOverlay) {
  waitModalOverlay.addEventListener("click", (e) => {
    if (e.target === waitModalOverlay) waitModalOverlay.classList.remove("active");
  });
}

(async () => {
  await loadVotes();
  await loadWorks();
})();
