let townsData = [];
const isGithubjs = location.hostname.includes("github.io");
const pathPartsjs = window.location.pathname.split("/");
const repoNamejs = pathPartsjs[1] || "";
const basePathjs = isGithubjs ? `/${repoName}/` : "/";

fetch(basePathjs + "maps/All_Towns.json")
  .then((res) => res.json())
  .then((data) => {
    townsData = data.All_Towns_Details;
  });

function normalize(str) {
  return str.replace(/'/g, "").toLowerCase();
}

function convertToTraditional(input) {
  try {
    const converter = OpenCC.Converter({ from: 'cn', to: 'tw' });
    return converter(input);
  } catch (e) {
    console.warn("OpenCC conversion failed:", e);
    return input;
  }
}

function getLang() {
  return document.documentElement.lang === "zh" ? "zh" : "en";
}

function searchTowns(term, fuzzy = true) {
  const keyword = normalize(convertToTraditional(term));
  if (!keyword.trim()) return [];

  return townsData.filter((entry) => {
    const fields = [
      entry.Town_EN,
      entry.Town_CH,
      entry.Comm_EN,
      entry.Comm_CH,
      entry.Prov_EN,
      entry.Prov_CH
    ];

    return fields.some((field) => {
      const fieldNormalized = normalize(field);
      return fuzzy
        ? fieldNormalized.includes(keyword)
        : fieldNormalized === keyword;
    });
  });
}

window.handleSearch = function () {
  const input = document.getElementById("searchInput").value.trim();
  const resultBox = document.getElementById("searchResult");
  const warningBox = document.getElementById("searchWarning");
  const lang = getLang();

  warningBox.innerHTML = "";

  // Check fuzzy toggle
  const fuzzy = document.getElementById("fuzzyToggle")?.checked ?? true;

  // Warning for short input
  if ((/^[a-zA-Z]{1,3}$/).test(input) || input.length === 1) {
    warningBox.innerHTML = lang === "zh"
      ? "<p style='color:orange;'>當前輸入較短，無法精準搜尋，請嘗試更具體的名稱。</p>"
      : "<p style='color:orange;'>Search term is very short; you may get too many results. Consider refining your search.</p>";
  }

  const results = searchTowns(input, fuzzy);

  if (results.length === 0) {
    resultBox.innerHTML = lang === "zh"
      ? "<p>未找到相關内容。</p>"
      : "<p>No matching results found.</p>";
  } else {
    const labels = {
      town: lang === "zh" ? "地" : "Place",
      comm: lang === "zh" ? "郡" : "Commandery",
      prov: lang === "zh" ? "州" : "Province"
    };

    resultBox.innerHTML = results.map(r => `
      <div class="result-entry">
        <p><strong>${labels.town}:</strong> ${r.Town_EN} || ${r.Town_CH}</p>
        <p><strong>${labels.comm}:</strong> ${r.Comm_EN} || ${r.Comm_CH}</p>
        <p><strong>${labels.prov}:</strong> ${r.Prov_EN} || ${r.Prov_CH}</p>
      </div>
    `).join("<hr>");
  }
};
