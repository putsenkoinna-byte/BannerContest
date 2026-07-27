const employees = [
  "Рома",
  "Вика",
  "Арина",
  "Карина",
  "Дара"
];

const employeeSelect = document.getElementById("employeeSelect");
const worksContainer = document.getElementById("works");

employees.forEach(name => {
  const option = document.createElement("option");
  option.value = name;
  option.textContent = name;
  employeeSelect.appendChild(option);
});


async function loadWorks() {
  try {
    const response = await fetch("/api/works");
    const data = await response.json();

worksContainer.innerHTML = "";

const records = data.records || [];

records.forEach(record => {

      const fields = record.fields;

      if (!fields.Username || !fields["Конкурсные работы"] || !fields["Конкурсные работы"].length) {
  return;
}

      const images = fields["Конкурсные работы"];

      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        <img src="${images[0].url}" alt="work">

        <div class="card-content">
          <div class="username">
            @${fields.Username}
          </div>

          <div class="votes">
            ❤️ ${fields["Количество голосов"] || 0} голосов
          </div>

          <button>
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
