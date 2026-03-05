// Kamola's code
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("internship-list");
  
  fetch("/api/internships")
    .then(res => res.json())
    .then(internships => {
      if (!internships || internships.length === 0) {
        container.innerHTML = "<p>No internships found.</p>";
        return;
      }
      
      container.innerHTML = internships.map(job => `
        <div class="job-card">
          <h3>${job.title}</h3>
          <p>${job.company_name}</p>
          <a href="${job.link}" target="_blank">Apply</a>
        </div>
      `).join("");
    })
    .catch(err => {
      console.error(err);
      container.innerHTML = "<p>Failed to load internships.</p>";
    });
});