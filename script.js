const employees = [
  "Рома",
  "Вика",
  "Арина",
  "Карина"
  "Ирина"
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


  works.sort((a,b)=>{

    const aZalet = String(a.fields["Примечания"] || "").toLowerCase().includes("залетный");
    const bZalet = String(b.fields["Примечания"] || "").toLowerCase().includes("залетный");


    if(aZalet && !bZalet) return 1;
    if(!aZalet && bZalet) return -1;

    return 0;

  });


  renderWorks();

}



function getVotesForWork(workId){

  return votes.filter(vote =>
    vote.fields["Contest Work"]?.includes(workId)
  ).length;

}



function getEmployeeVotes(){

  return votes.filter(vote =>
    vote.fields["Voter Name"] === employeeSelect.value
  ).length;

}



function getAuthorVote(username){

  return votes.find(vote=>{

    const workId = vote.fields["Contest Work"]?.[0];

    const work = works.find(item=>item.id===workId);


    return (
      vote.fields["Voter Name"] === employeeSelect.value &&
      work?.fields?.Username === username
    );

  });

}



function hasCurrentWorkVote(workId){

  return votes.some(vote =>
    vote.fields["Voter Name"] === employeeSelect.value &&
    vote.fields["Contest Work"]?.includes(workId)
  );

}



function renderMedia(files){

  if(!files || !files.length)
    return "";


  if(files.length===1){

    const file = files[0];


    if(file.type?.startsWith("video")){

      return `
        <video controls>
          <source src="${file.url}" type="${file.type}">
        </video>
      `;

    }


    return `
      <img src="${file.url}">
    `;

  }



  return `
    <div class="slider">

      <button type="button" class="slider-prev">‹</button>

      <div class="slider-items">

      ${
        files.map((file,index)=>{

          if(file.type?.startsWith("video")){

            return `
              <video
                class="slider-item ${index===0?"active":""}"
                controls>

                <source src="${file.url}" type="${file.type}">

              </video>
            `;

          }


          return `
            <img
              class="slider-item ${index===0?"active":""}"
              src="${file.url}">
          `;


        }).join("")
      }

      </div>


      <button type="button" class="slider-next">›</button>

    </div>
  `;

}



function renderWorks(){

  worksContainer.innerHTML="";


  works.forEach(record=>{


    const fields = record.fields;


    if(
      !fields.Username ||
      !fields["Конкурсные работы"]?.length
    )
      return;



    const authorVote = getAuthorVote(fields.Username);

    const currentWorkVote = hasCurrentWorkVote(record.id);



    const card = document.createElement("div");

    card.className="card";


    card.innerHTML=`

      ${renderMedia(fields["Конкурсные работы"])}


      <div class="card-content">


        <div class="username">
          ${fields.Username}
        </div>


        <div class="votes">
          ❤️ ${getVotesForWork(record.id)} голосов
        </div>


        <div class="button-row">


          <button
            class="vote-button ${currentWorkVote?"remove":""}"
            data-work="${record.id}"
            data-author="${fields.Username}"
            ${employeeSelect.value && (!authorVote || currentWorkVote) ? "" : "disabled"}>

            ${
              currentWorkVote
              ? "Убрать голос"
              : authorVote
                ? "За автора уже отдан голос"
                : "Голосовать"
            }

          </button>


          ${
            fields["Ссылка на пост"]
            ?
            `
            <a 
  class="link-button"
  href="${fields["Ссылка на пост"]}"
  target="_blank"
  title="Открыть пост"
>
  🔗
</a>

            </a>
            `
            :
            ""
          }


        </div>


      </div>

    `;


    worksContainer.appendChild(card);


  });


}
document.addEventListener("click", async e => {


  if(
    e.target.classList.contains("slider-next") ||
    e.target.classList.contains("slider-prev")
  ){

    const slider = e.target.closest(".slider");

    const items = slider.querySelectorAll(".slider-item");


    let current = [...items].findIndex(item =>
      item.classList.contains("active")
    );


    items[current].classList.remove("active");


    if(e.target.classList.contains("slider-next")){

      current++;

      if(current >= items.length)
        current = 0;

    }
    else{

      current--;

      if(current < 0)
        current = items.length - 1;

    }


    items[current].classList.add("active");

    return;

  }



  if(!e.target.classList.contains("vote-button"))
    return;



  const button = e.target;

  const voterName = employeeSelect.value;

  const contestWork = button.dataset.work;



  if(!voterName)
    return;



  const removing = button.classList.contains("remove");



  if(!removing){


    const userVotes = getEmployeeVotes();


    if(userVotes >= 10){

      alert("Вы уже использовали все 10 голосов");

      return;

    }

  }



  if(removing){


    votes = votes.filter(vote =>
      !(
        vote.fields["Voter Name"] === voterName &&
        vote.fields["Contest Work"]?.includes(contestWork)
      )
    );


    button.classList.remove("remove");

    button.textContent="Голосовать";


  }
  else{


    votes.push({

      id:"temp",

      fields:{

        "Voter Name":voterName,

        "Contest Work":[contestWork]

      }

    });


    button.classList.add("remove");

    button.textContent="Убрать голос";


  }



  const votesBlock = button
    .closest(".card")
    .querySelector(".votes");


  if(votesBlock){

    votesBlock.textContent =
      `❤️ ${getVotesForWork(contestWork)} голосов`;

  }



  const counter = document.getElementById("votesLeft");


  if(counter){

    counter.textContent =
      `Ваши голоса: ${getEmployeeVotes()}/10`;

  }



  await fetch("/api/vote",{


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



});



employeeSelect.addEventListener("change", ()=>{

  renderWorks();


  const counter = document.getElementById("votesLeft");


  if(counter){

    counter.textContent =
      `Ваши голоса: ${getEmployeeVotes()}/10`;

  }

});



(async()=>{

  await loadVotes();

  await loadWorks();

})();
