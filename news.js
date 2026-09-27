(() => {
  "use strict";

  const cfg = window.HEALTH_CENTER_SITE_CONFIG || {};
  const facebookUrl = cfg.facebookPageUrl || "#";

  function setFacebookLinks() {
    ["facebookTopLink","facebookMainLink"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.href = facebookUrl;
    });
  }

  function card(item) {
    const article = document.createElement("article");
    article.className = "news-page-card";

    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = item.content_type === "WebsiteAnnouncement" ? "ประกาศ" : "ข่าวสาร";

    const title = document.createElement("h3");
    title.textContent = item.value1 || "ข่าวประชาสัมพันธ์";

    const summary = document.createElement("p");
    summary.textContent = item.value2 || "";

    const meta = document.createElement("small");
    meta.className = "news-meta";
    meta.textContent = "เผยแพร่โดย THC Health";

    article.append(tag,title,summary,meta);
    return article;
  }

  function paint(news, error = false) {
    const grid = document.getElementById("newsPageGrid");
    if (!grid) return;
    grid.replaceChildren();

    if (!Array.isArray(news) || !news.length) {
      const article = document.createElement("article");
      article.className = "news-page-card";
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = "ข่าวสาร";
      const title = document.createElement("h3");
      title.textContent = error ? "ไม่สามารถโหลดข่าวจากระบบได้" : "ยังไม่มีข่าวที่เผยแพร่ใน THC Health";
      const p = document.createElement("p");
      p.textContent = "สามารถติดตามข่าวและภาพกิจกรรมต้นฉบับได้จาก Facebook Page ของศูนย์บริการ";
      article.append(tag,title,p);
      grid.append(article);
      return;
    }

    news.forEach(item => grid.append(card(item)));
  }

  async function load() {
    setFacebookLinks();
    paint([]);
    try {
      const response = await fetch(cfg.publicApiUrl, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || data?.success !== true) throw new Error("public api unavailable");
      paint(data.news || []);
    } catch (_) {
      paint([], true);
    }
  }

  load();
})();