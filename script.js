const employees = [
  "Рома",
  "Вика",
  "Арина",
  "Карина"
];

const employeeSelect = document.getElementById("employeeSelect");
const worksContainer = document.getElementById("works");

let votes = [];
let works = [];


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



async function loadWorks() {

  const response = await fetch("/api/works");
  const data = await response.json();

  works = data.records || [];


  works.sort((a, b) => {

    const aZalet = String(a.fields["Примечания"] || "").includes("Залетный");
    const bZalet = String(b.fields["Примечания"] || "").includes("Залетный");

    if (aZalet && !bZalet) return 1;
    if (!aZalet && bZalet) return -1;

    return 0;

  });


  renderWorks();

}



function getVotesForWork(workId) {

  return votes.filter(vote =>
    vote.fields["Contest Work"]?.includes(workId)
  ).length;

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

  const file = files[0];

  if (!file) return "";


  if (file.type?.startsWith("video")) {

    return `
      <video controls>
        <source src="${file.url}" type="${file.type}">
      </video>
    `;

  }


  return `
    <img src="${file.url}" alt="work">
  `;

}



function renderWorks() {

  worksContainer.innerHTML = "";


  works.forEach(record => {

    const fields = record.fields;


    if (
      !fields.Username ||
      !fields["Конкурсные работы"]?.length
    ) return;



    const authorVote = getAuthorVote(fields.Username);
    const currentWorkVote = hasCurrentWorkVote(record.id);



    const card = document.createElement("div");

    card.className = "card";


    card.innerHTML = `

      ${renderMedia(fields["Конкурсные работы"])}


      <div class="card-content">

        <div class="username">
          ${fields.Username}
        </div>


        <div class="votes">
          ❤️ ${getVotesForWork(record.id)} голосов
        </div>


        <button 
          class="vote-button ${currentWorkVote ? "remove" : ""}"
          data-work="${record.id}"
          data-author="${fields.Username}"
          ${employeeSelect.value && !authorVote || currentWorkVote ? "" : "disabled"}
        >

          ${
            currentWorkVote
              ? "Убрать голос"
              : authorVote
                ? "За автора уже отдан голос"
                : "Голосовать"
          }

        </button>


      </div>

    `;


    worksContainer.appendChild(card);

  });

}



employeeSelect.addEventListener("change", renderWorks);



document.addEventListener("click", async e => {


  if (!e.target.classList.contains("vote-button"))
    return;


  const button = e.target;

  const voterName = employeeSelect.value;
  const contestWork = button.dataset.work;


  if (!voterName)
    return;


  const removing = button.classList.contains("remove");


  if (removing) {

    votes = votes.filter(vote =>
      !(
        vote.fields["Voter Name"] === voterName &&
        vote.fields["Contest Work"]?.includes(contestWork)
      )
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


  await fetch("/api/vote", {

    method: "POST",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify({
      voterName,
      contestWork,
      action: removing ? "delete" : "add"
    })

  });


});



(async()=>{

  await loadVotes();

  await loadWorks();

})();
