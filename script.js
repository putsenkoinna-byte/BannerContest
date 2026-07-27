const BASE_ID = "appSxQXkQdS7Z9V6b";

const WORKS_TABLE = "tblw7e0Mp2HGsym5n";
const VOTES_TABLE = "tblbzFEy8wRU63bv1";

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

  const response = await fetch(
    `https://api.airtable.com/v0/${BASE_ID}/${WORKS_TABLE}`
  );

  const data = await response.json();

  worksContainer.innerHTML = "";

  data.records.forEach(record => {

    const fields = record.fields;

    if (!fields["Username"] || !fields["Конкурсные работы"]) {
      return;
    }

    const image =
      fields["Конкурсные работы"][0]?.url;

    const card = document.createElement("div");

    card.className = "card";

    card.innerHTML = `
      <img src="${image}">
      <div class="card-content">
        <div class="username">
          ${fields["Username"]}
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

}


loadWorks();
