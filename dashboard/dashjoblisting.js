/* Rushdi Mohmmads Code */

function showSection(section){

document.querySelectorAll(".dashboard-section")
.forEach(sec=>sec.classList.remove("active"))

document.getElementById(section).classList.add("active")

}



function showJob(event, job){

document.querySelectorAll(".job-card")
.forEach(card=>card.classList.remove("active"))

event.currentTarget.classList.add("active")

const data = {

frontend:{
title:"Frontend Developer",
salary:"$75,000 / year",
desc:"Build modern UI applications using HTML CSS and JavaScript. Work with design teams and backend engineers to develop responsive interfaces.",
meta:["Remote","Full Time","Entry Level"],
tasks:[
"Build UI components",
"Fix frontend bugs",
"Work with APIs",
"Improve UX"
],
exp:[
"HTML",
"CSS",
"JavaScript"
],
circles:[65,80,40]
},

it:{
title:"IT Support Specialist",
salary:"$60,000 / year",
desc:"Provide technical support to employees. Troubleshoot hardware software and network issues.",
meta:["On Site","Full Time","Beginner"],
tasks:[
"Fix computers",
"Install software",
"Help employees",
"Network troubleshooting"
],
exp:[
"Windows",
"Basic Networking",
"Hardware knowledge"
],
circles:[50,60,75]
},

software:{
title:"Junior Software Engineer",
salary:"$85,000 / year",
desc:"Assist senior developers building scalable backend systems and APIs.",
meta:["Hybrid","Full Time","Junior"],
tasks:[
"Write backend code",
"Debug issues",
"Work in team",
"Build APIs"
],
exp:[
"Python or Java",
"Git",
"Problem solving"
],
circles:[70,85,60]
},

data:{
title:"Data Analyst Intern",
salary:"$28/hr",
desc:"Analyze datasets and create dashboards for business decisions.",
meta:["Part Time","Remote","Intern"],
tasks:[
"Analyze data",
"Create charts",
"Write reports",
"SQL queries"
],
exp:[
"Excel",
"SQL",
"Basic Python"
],
circles:[40,70,65]
}

}


const jobData = data[job]

document.getElementById("jobTitle").innerText = jobData.title
document.getElementById("jobSalary").innerText = jobData.salary
document.getElementById("jobDesc").innerText = jobData.desc

document.getElementById("jobMeta").innerHTML =
jobData.meta.map(m=>`<span>${m}</span>`).join("")

document.getElementById("jobTasks").innerHTML =
jobData.tasks.map(t=>`<li>${t}</li>`).join("")

document.getElementById("jobExperience").innerHTML =
jobData.exp.map(e=>`<li>${e}</li>`).join("")

document.getElementById("expPercent").innerText =
jobData.circles[0]+"%"

document.getElementById("skillPercent").innerText =
jobData.circles[1]+"%"

document.getElementById("commPercent").innerText =
jobData.circles[2]+"%"

document.getElementById("expCircle").style.background =
`conic-gradient(#07294D 0% ${jobData.circles[0]}%, #eee ${jobData.circles[0]}%)`

document.getElementById("skillCircle").style.background =
`conic-gradient(#07294D 0% ${jobData.circles[1]}%, #eee ${jobData.circles[1]}%)`

document.getElementById("commCircle").style.background =
`conic-gradient(#07294D 0% ${jobData.circles[2]}%, #eee ${jobData.circles[2]}%)`

}

function saveJob() {
    const savedJobs = JSON.parse(localStorage.getItem("savedJobs")) || [];

    const newJob = {
        id: Date.now(),
        title: document.getElementById("jobTitle").innerText,
        salary: document.getElementById("jobSalary").innerText,
        description: document.getElementById("jobDesc").innerText,
        location: document.getElementById("jobMeta").innerText
    };

    // Prevent duplicates
    if (!savedJobs.some(job => job.title === newJob.title)) {
        savedJobs.push(newJob);
        localStorage.setItem("savedJobs", JSON.stringify(savedJobs));
        alert("Job saved successfully!");
    } else {
        alert("Job already saved.");
    }
}

document.addEventListener("DOMContentLoaded", function(){

const searchInput = document.querySelector(".search-bar input")
const jobList = document.querySelector(".job-list")         // NEW

//Brian codes
// NEW — create & inject "No results" message
const noResultsMsg = document.createElement("p")
noResultsMsg.id = "no-results-msg"
noResultsMsg.textContent = "No results found."
noResultsMsg.style.display = "none"
noResultsMsg.style.padding = "16px"
noResultsMsg.style.color = "#666"
noResultsMsg.style.fontStyle = "italic"
jobList.appendChild(noResultsMsg)
//Brian codes

searchInput.addEventListener("input", function(){           // CHANGED: keyup → input

const value = this.value.toLowerCase().trim()              // CHANGED: added .trim()
const jobs = document.querySelectorAll(".job-card")        // MOVED: inside handler
let visibleCount = 0                                       // NEW

jobs.forEach(job => {
const text = job.innerText.toLowerCase()
if(text.includes(value)){
job.style.display = "block"
visibleCount++                                             // NEW
}else{
job.style.display = "none"
}
})

noResultsMsg.style.display = visibleCount === 0 ? "block" : "none"  // NEW

})

})
