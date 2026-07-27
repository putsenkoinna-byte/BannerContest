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


function getVotesForWork(workId) {

  return votes.filter(vote =>
    vote.fields["Contest Work"]?.includes(workId)
  ).length;

}



function hasVotedForAuthor(username) {

  return votes.some(vote => {

    const workId = vote.fields["Contest Work"]?.[0];

    const work = works.find(item => item.id === workId);

    return (
      vote.fields["Voter Name"] === employeeSelect.value &&
      work?.fields?.Username === username
    );

  });

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



async function loadWorks() {

  const response = await fetch("/api/works");
  const data = await response.json();

  works = data.records || [];

  renderWorks();

}



function renderWorks() {

  worksContainer.innerHTML = "";


  works.forEach(record => {

    const fields = record.fields;


    if (
      !fields.Username ||
      !fields["Конкурсные работы"]?.length
    ) return;


    const voted = hasVotedForAuthor(fields.Username);


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
          class="vote-button ${voted ? "remove" : ""}"
          data-work="${record.id}"
          data-author="${fields.Username}"
          ${employeeSelect.value ? "" : "disabled"}
        >
          ${voted ? "Убрать голос" : "Голосовать"}
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


  const author = button.dataset.author;


  const removing = button.classList.contains("remove");



  // мгновенно меняем интерфейс

  if (removing) {

    votes = votes.filter(vote => {

      const workId = vote.fields["Contest Work"]?.[0];

      const work = works.find(item => item.id === workId);

      return !(
        vote.fields["Voter Name"] === voterName &&
        work?.fields?.Username === author
      );

    });

  } else {

    votes.push({
      id: "temp",
      fields:{
        "Voter Name": voterName,
        "Contest Work":[contestWork]
      }
    });

  }


  renderWorks();



  await fetch("/api/vote", {

    method:"POST",

    headers:{
      "Content-Type":"application/json"
    },

    body:JSON.stringify({

      voterName,
      contestWork,
      action: removing ? "delete" : "add"

    })

  });



  await loadVotes();

  renderWorks();


});



(async()=>{

  await loadVotes();

  await loadWorks();

})();
