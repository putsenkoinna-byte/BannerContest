const employees = [
  "Рома",
  "Вика",
  "Арина",
  "Карина",
];

const employeeSelect = document.getElementById("employeeSelect");
const worksContainer = document.getElementById("works");

employees.forEach(name => {
  const option = document.createElement("option");
  option.value = name;
  option.textContent = name;
  employeeSelect.appendChild(option);
});


employeeSelect.addEventListener("change", () => {
  const buttons = document.querySelectorAll(".vote-button");

  buttons.forEach(button => {
    button.disabled = employeeSelect.value === "";
    button.style.opacity = employeeSelect.value === "" ? "0.5" : "1";
    button.style.cursor = employeeSelect.value === "" ? "not-allowed" : "pointer";
  });
});


async function loadWorks() {
  try {
    const response = await fetch("/api/works");
    const data = await response.json();

    worksContainer.innerHTML = "";

    const records = data.records || [];

    records.forEach(record => {

      const fields = record.fields;

      if (
        !fields.Username ||
        !fields["Конкурсные работы"] ||
        !fields["Конкурсные работы"].length
      ) {
        return;
      }

      const images = fields["Конкурсные работы"];

      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        <img src="${images[0].url}" alt="work">

        <div class="card-content">
          <div class="username">
            ${fields.Username}
          </div>

          <div class="votes">
            ❤️ ${fields["Количество голосов"] || 0} голосов
          </div>

         <button class="vote-button" data-work="${fields.Username}" disabled>
    Голосовать
</button>
        </div>
      `;

      worksContainer.appendChild(card);

    });

  } catch(error) {
    console.error(error);
    worksContainer.innerHTML = "Ошибка загрузки работ";
  }
}


loadWorks();
document.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("vote-button")) return;

  const voterName = employeeSelect.value;
  const contestWork = e.target.dataset.work;

  if (!voterName) return;

  await fetch("/api/vote", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      voterName,
      contestWork
    })
  });

  e.target.textContent = "Голос учтен";
  e.target.disabled = true;
});
