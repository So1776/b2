// dashboard.js
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("jobs-container");

  fetch("/api/internships")
    .then(res => res.json())
    .then(internships => {
      if (!internships || internships.length === 0) {
        container.innerHTML = "<p>No internships found.</p>";
        return;
      }

      container.innerHTML = internships.map(job => `
        <div class="job-card">
          <h3>${job.title || "Untitled Role"}</h3>
          <p class="company">${job.company_name || "Unknown Company"}</p>
          <a href="${job.link}" target="_blank" class="apply-btn">Apply</a>
        </div>
      `).join("");
    })
    .catch(err => {
      console.error(err);
      container.innerHTML = "<p>Failed to load internships.</p>";
    });
});