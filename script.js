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
const modalStatusBadge = document.getElementById("modalStatusBadge");

let votes = [];
let works = [];

employees.forEach(name => {
  const option = document.createElement("option");
  option.value = name;
  option.textContent = name;
  employeeSelect.appendChild(option);
});

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

function showWinnersModal() {
  const stats = works.map(w => {
    const cleanUser = String(w.fields.Username || "Аноним").replace(/^@+/, '');
    return {
      id: w.id,
      author: cleanUser,
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
      <div class="winner-name">@${item.author}</div>
      <div class="winner-count">❤️ ${item.votes}</div>
    `;
    winnersList.appendChild(el);
  });

  const maxPossibleVotes = employees.length * 10;
  if (votes.length >= maxPossibleVotes) {
    modalStatusBadge.textContent = "🏆 Финальные результаты";
    modalStatusBadge.style.color = "#00e5ff";
  } else {
    modalStatusBadge.textContent = "⏳ Промежуточные результаты";
    modalStatusBadge.style.color = "#f59e0b";
  }

  modalOverlay.classList.add("active");
}

document.addEventListener("click", async e => {
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
    showWinnersModal();
    return;
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
    setTimeout(showWinnersModal, 300);
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
  if (!counter) return;

  const currentCount = getEmployeeVotes();
  if (employeeSelect.value) {
    counter.textContent = `Ваши голоса: ${currentCount}/10`;
  } else {
    counter.textContent = `Выберите имя, чтобы начать голосование`;
  }
}

employeeSelect.addEventListener("change", () => {
  renderWorks();
  updateCounterDisplay();
  if (employeeSelect.value && getEmployeeVotes() === 10) {
    showWinnersModal();
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

(async () => {
  await loadVotes();
  await loadWorks();
})();
