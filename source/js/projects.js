/**
 * Project Progress Panel — embedded in blog homepage
 * Renders project cards with progress bars from embedded data.
 */
(function () {
  // Only render on homepage
  if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') return;

  const projects = [
    { name: "GK Research Paper", desc: "Graduate-level academic paper — multi-chapter study with empirical analysis", progress: 85, status: "Active", color: "green" },
    { name: "SHARK Quant System", desc: "A-share factor research engine with live paper trading", progress: 70, status: "Active", color: "green" },
    { name: "VERSION2.5 Strategy", desc: "American multi-factor quantitative strategy with revival research", progress: 65, status: "Active", color: "orange" },
    { name: "Wittgenstein Corpus", desc: "Seven-volume facsimile & transcription edition (v1.1 released)", progress: 98, status: "Published", color: "blue" },
    { name: "Android App Suite", desc: "Five apps submitted for F-Droid inclusion", progress: 90, status: "Review", color: "orange" },
    { name: "LLM Price Benchmark", desc: "Pricing and capability tracking for open-weight language models", progress: 80, status: "Active", color: "green" },
    { name: "Personal Blog", desc: "Hexo + Butterfly academic blog with bilingual support", progress: 95, status: "Launched", color: "purple" },
    { name: "Novel Research", desc: "Weimar Republic historical research for fiction writing", progress: 40, status: "Research", color: "gold" },
    { name: "Remote Compute Cluster", desc: "Multi-node distributed research infrastructure", progress: 85, status: "Active", color: "green" },
    { name: "ML Training Pipeline", desc: "Automated training infrastructure with watchdog monitoring", progress: 75, status: "Active", color: "green" },
  ];

  const statusClass = {
    "Active": "status-active",
    "Published": "status-published",
    "Review": "status-review",
    "Launched": "status-launched",
    "Research": "status-research",
  };

  const progressColor = {
    green: "#4caf50",
    orange: "#ff9800",
    blue: "#2196f3",
    purple: "#9c27b0",
    gold: "#B08D57",
  };

  function createProjectCard(p) {
    return `
      <div class="proj-card">
        <div class="proj-header">
          <span class="proj-name">${p.name}</span>
          <span class="proj-status ${statusClass[p.status] || ''}">${p.status}</span>
        </div>
        <div class="proj-desc">${p.desc}</div>
        <div class="proj-progress-wrap">
          <div class="proj-bar-bg">
            <div class="proj-bar-fill" style="width:${p.progress}%;background:${progressColor[p.color]||'#4caf50'}"></div>
          </div>
          <span class="proj-pct">${p.progress}%</span>
        </div>
      </div>`;
  }

  function render() {
    // Find insertion point — before the first post card on the homepage
    const container = document.querySelector('#recent-posts') || document.querySelector('.recent-posts') || document.querySelector('body');

    const panel = document.createElement('section');
    panel.id = 'project-panel';
    panel.innerHTML = `
      <div style="max-width:900px;margin:0 auto 2rem;padding:0 1rem;">
        <h2 style="font-size:1.4rem;font-weight:700;color:#B08D57;margin-bottom:1.25rem;border-bottom:1px solid #333355;padding-bottom:0.75rem;">
          Active Projects
        </h2>
        <div class="proj-grid">
          ${projects.map(createProjectCard).join('')}
        </div>
      </div>`;

    // Insert at top of main content
    const main = document.querySelector('#recent-posts') || container;
    if (main && main.parentNode) {
      main.parentNode.insertBefore(panel, main);
    } else {
      container.insertBefore(panel, container.firstChild);
    }
  }

  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    .proj-grid { display:grid;grid-template-columns:1fr;gap:0.75rem; }
    @media(min-width:640px) { .proj-grid { grid-template-columns:1fr 1fr; } }
    .proj-card { background:#22223a;border:1px solid #333355;border-radius:10px;padding:1rem;transition:all 0.2s; }
    .proj-card:hover { border-color:#B08D57;transform:translateY(-1px); }
    .proj-header { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.5rem;gap:0.5rem; }
    .proj-name { font-weight:600;font-size:0.9rem;color:#e0e0e0;line-height:1.3; }
    .proj-status { font-size:0.65rem;padding:0.15rem 0.5rem;border-radius:999px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;flex-shrink:0; }
    .proj-desc { font-size:0.8rem;color:#999;line-height:1.4;margin-bottom:0.75rem; }
    .proj-progress-wrap { display:flex;align-items:center;gap:0.6rem; }
    .proj-bar-bg { flex:1;height:5px;background:#333355;border-radius:3px;overflow:hidden; }
    .proj-bar-fill { height:100%;border-radius:3px;transition:width 0.6s ease; }
    .proj-pct { font-size:0.75rem;font-weight:600;color:#D4A85C;min-width:2.5rem;text-align:right; }
    .status-active { background:rgba(76,175,80,0.18);color:#4caf50; }
    .status-published { background:rgba(33,150,243,0.18);color:#2196f3; }
    .status-review { background:rgba(255,152,0,0.18);color:#ff9800; }
    .status-launched { background:rgba(156,39,176,0.18);color:#9c27b0; }
    .status-research { background:rgba(176,141,87,0.18);color:#B08D57; }
  `;
  document.head.appendChild(style);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
