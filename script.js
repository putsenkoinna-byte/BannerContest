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


async function loadWorks() {

  const response = await fetch("/api/works");
  const data = await response.json();

  works = data.records || [];

  renderWorks();
}


function getAuthorVotes(username) {
  return votes.find(vote =>
    vote.fields["Voter Name"] === employeeSelect.value &&
    vote.fields["Username"] === username
  );
}


function renderMedia(files) {

  const file = files[0];

  if (!file) return "";

  if (file.type && file.type.startsWith("video")) {

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


    const authorVote = votes.find(vote => {

  const workId = vote.fields["Contest Work"]?.[0];

  const votedWork = works.find(work => work.id === workId);

  return (
    vote.fields["Voter Name"] === employeeSelect.value &&
    votedWork?.fields?.Username === fields.Username
  );

});


    const card = document.createElement("div");

    card.className = "card";


    card.innerHTML = `

      ${renderMedia(fields["Конкурсные работы"])}


      <div class="card-content">

        <div class="username">
          ${fields.Username}
        </div>


        <div class="votes">
          ❤️ ${fields["Количество голосов"] || 0} голосов
        </div>


        <button 
          class="vote-button ${authorVote ? "remove" : ""}"
          data-work="${record.id}"
          data-author="${fields.Username}"
          ${employeeSelect.value ? "" : "disabled"}
        >

        ${
          authorVote
          ? "Убрать голос"
          : "Голосовать"
        }

        </button>


      </div>

    `;


    worksContainer.appendChild(card);

  });

}



employeeSelect.addEventListener("change", () => {

  renderWorks();

});




document.addEventListener("click", async(e)=>{


  if(!e.target.classList.contains("vote-button"))
    return;


  const button = e.target;


  const voterName = employeeSelect.value;

  const contestWork = button.dataset.work;

  const author = button.dataset.author;


  if(!voterName)
    return;



  const existingVote = votes.find(vote => {

  const workId = vote.fields["Contest Work"]?.[0];

  const votedWork = works.find(work => work.id === workId);

  return (
    vote.fields["Voter Name"] === voterName &&
    votedWork?.fields?.Username === author
  );

});



  const oldText = button.textContent;


  if(existingVote) {

    button.textContent = "Удаление...";
    
  } else {

    button.textContent = "Голосуем...";

  }


  button.disabled = true;



  const action = existingVote
    ? "delete"
    : "add";



  const response = await fetch("/api/vote",{

    method:"POST",

    headers:{
      "Content-Type":"application/json"
    },

    body:JSON.stringify({

      voterName,
      contestWork,
      action

    })

  });



  if(!response.ok){

    button.textContent = oldText;
    button.disabled = false;

    return;

  }



  await loadVotes();


  renderWorks();


});




(async()=>{

  await loadVotes();

  await loadWorks();

})();
