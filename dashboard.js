// Kamola's code
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
        <div class="job-card" onclick="toggleDetails(this)"> 
          <div class="job-header">
            <h3>${job.title || "Untitled Role"}</h3>
            <span class="company">${job.company_name || "Unknown Company"}</span>
          </div>
          <div class="job-details">
            <div><strong>Description:</strong> ${job.description || "No description available."}</div>
            <div><i class="fas fa-map-marker-alt"></i> ${job.location || "Location not listed"}</div>
            <button class="apply-btn" onclick="window.open('${job.source_link}', '_blank')">
              Apply Now
            </button>
          </div>
        </div>
      `).join("");
    })    
    .catch(err => {
      console.error(err);
      container.innerHTML = "<p>Failed to load internships.</p>";
    });
});