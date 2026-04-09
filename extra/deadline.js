const DeadlineBanner = (() => {

  function getDaysLeft(deadline) {
    const deadlineDate = new Date(deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deadlineDate.setHours(0, 0, 0, 0);
    return Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
  }

  function getUrgency(daysLeft) {
    if (daysLeft <= 3) return "urgent";
    if (daysLeft <= 7) return "soon";
    return "normal";
  }

  const urgencyConfig = {
    normal: {
      bg: "#eef6ff",
      border: "#3b82f6",
      icon: "🗓️",
      labelColor: "#1d4ed8",
      labelBg: "#dbeafe",
    },
    soon: {
      bg: "#fffbeb",
      border: "#f59e0b",
      icon: "⚠️",
      labelColor: "#92400e",
      labelBg: "#fef3c7",
    },
    urgent: {
      bg: "#fff1f2",
      border: "#ef4444",
      icon: "🚨",
      labelColor: "#991b1b",
      labelBg: "#fee2e2",
    },
  };

  function formatDate(deadline) {
    return new Date(deadline).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function getLabel(daysLeft) {
    if (daysLeft === 0) return "Due today!";
    if (daysLeft < 0) return "Deadline passed";
    if (daysLeft === 1) return "1 day left!";
    if (daysLeft <= 3) return `${daysLeft} days left!`;
    return `${daysLeft} days left`;
  }

  function injectStyles() {
    if (document.getElementById("deadline-banner-styles")) return;
    const style = document.createElement("style");
    style.id = "deadline-banner-styles";
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&display=swap');

      #deadline-banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        padding: 12px 16px;
        border-radius: 6px;
        margin-bottom: 20px;
        font-family: 'Sora', sans-serif;
        animation: bannerSlideDown 0.3s ease;
        box-sizing: border-box;
      }

      @keyframes bannerSlideDown {
        from { opacity: 0; transform: translateY(-8px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      #deadline-banner .db-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      #deadline-banner .db-icon {
        font-size: 20px;
        line-height: 1;
      }

      #deadline-banner .db-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      #deadline-banner .db-heading {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #6b7280;
      }

      #deadline-banner .db-date {
        font-size: 14px;
        font-weight: 600;
        color: #111827;
      }

      #deadline-banner .db-right {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      #deadline-banner .db-badge {
        font-size: 12px;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 20px;
        white-space: nowrap;
      }

      #deadline-banner .db-dismiss {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 14px;
        color: #9ca3af;
        padding: 2px 6px;
        border-radius: 4px;
        line-height: 1;
        font-family: inherit;
      }

      #deadline-banner .db-dismiss:hover {
        color: #374151;
        background: rgba(0,0,0,0.06);
      }
    `;
    document.head.appendChild(style);
  }

  function init({ deadline, containerId = "banner-container", onDismiss }) {
    injectStyles();

    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`DeadlineBanner: No element found with id "${containerId}"`);
      return;
    }

    const daysLeft = getDaysLeft(deadline);
    const urgency = getUrgency(daysLeft);
    const config = urgencyConfig[urgency];
    const label = getLabel(daysLeft);

    const banner = document.createElement("div");
    banner.id = "deadline-banner";
    banner.style.backgroundColor = config.bg;
    banner.style.borderLeft = `4px solid ${config.border}`;

    banner.innerHTML = `
      <div class="db-left">
        <span class="db-icon">${config.icon}</span>
        <div class="db-text">
          <span class="db-heading">Application Deadline</span>
          <span class="db-date">${formatDate(deadline)}</span>
        </div>
      </div>
      <div class="db-right">
        <span class="db-badge" style="background:${config.labelBg}; color:${config.labelColor};">${label}</span>
        <button class="db-dismiss" aria-label="Dismiss">✕</button>
      </div>
    `;

    banner.querySelector(".db-dismiss").addEventListener("click", () => {
      banner.remove();
      if (typeof onDismiss === "function") onDismiss();
    });

    container.appendChild(banner);
  }

  return { init };
})();
