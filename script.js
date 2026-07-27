const employees = [
  "Рома",
  "Вика",
  "Арина",
  "Карина",
  "Дара"
];

const employeeSelect = document.getElementById("employeeSelect");
const worksContainer = document.getElementById("works");

let votes = [];


employees.forEach(name => {
  const option = document.createElement("option");
  option.value = name;
  option.textContent = name;
  employeeSelect.appendChild(option);
});


async function loadVotes() {
  const response = await fetch("/api/votes");
  const data = await response.json();

  votes = data.records || [];
}


function updateButtons() {
  document.querySelectorAll(".vote-button").forEach(button => {

    const workId = button.dataset.work;
    const currentVote = votes.find(vote => 
      vote.fields["Contest Work"]?.includes(workId) &&
      vote.fields["Voter Name"] === employeeSelect.value
    );

    if (currentVote) {
      button.textContent = "Убрать голос";
      button.dataset.voteId = currentVote.id;
      button.classList.add("remove");
    } else {
      button.textContent = "Голосовать";
      button.classList.remove("remove");
    }

    button.disabled = employeeSelect.value === "";

  });
}


employeeSelect.addEventListener("change", updateButtons);


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
      ) return;


      const card = document.createElement("div");
      card.className = "card";


      card.innerHTML = `
        <img src="${fields["Конкурсные работы"][0].url}" alt="work">

        <div class="card-content">

          <div class="username">
            ${fields.Username}
          </div>

          <div class="votes">
            ❤️ ${fields["Количество голосов"] || 0} голосов
          </div>

          <button class="vote-button" data-work="${record.id}" disabled>
            Голосовать
          </button>

        </div>
      `;


      worksContainer.appendChild(card);

    });


    updateButtons();


  } catch(error) {
    console.error(error);
  }

}



document.addEventListener("click", async (e)=>{

  if(!e.target.classList.contains("vote-button")) return;


  const button = e.target;

  const voterName = employeeSelect.value;

  if(!voterName) return;


  const action = button.classList.contains("remove")
    ? "delete"
    : "add";


  await fetch("/api/vote",{

    method:"POST",

    headers:{
      "Content-Type":"application/json"
    },

    body:JSON.stringify({

      voterName,
      contestWork:button.dataset.work,
      action

    })

  });


  await loadVotes();

  updateButtons();


});



(async()=>{
  await loadVotes();
  await loadWorks();
})();
