// Store all loaded JSON files here
let positionSources = {}; // { fileName: { sheetName: [rows] } }

// Build base path
const isGithub2 = location.hostname.includes("github.io");
const pathParts2 = window.location.pathname.split("/");
const repoName2 = pathParts2[1] || "";
const basePath2 = isGithub2 ? `/${repoName}/` : "/";

// Load JSON helper
function loadPositionFile(fileName) {
  return fetch(basePath2 + "translations/" + fileName)
    .then(res => {
      if (!res.ok) throw new Error(`Failed to load ${fileName}`);
      return res.json();
    })
    .then(data => {
      positionSources[fileName] = data;
    
    })
    .catch(err => console.warn(err));
}

function isMergedRow(row) {
  // Count how many of the first 6 cells have non-empty text
  let count = 0;
  for (let i = 0; i < 6; i++) {
    const cell = row[i];
    if (cell && cell.text && cell.text.trim() !== "") {
      count++;
    }
  }
  // If 0 or 1 cells have text → it's a merged row
  return count <= 1;
}



loadPositionFile("excellencies_ministers_webdisplay.json");
loadPositionFile("rear_eastern_palace_webdisplay.json");
loadPositionFile("central_court_webdisplay.json");
loadPositionFile("military_officials_webdisplay.json");
loadPositionFile("provincial_officials_webdisplay.json");



// --- Helpers ---
function normalize(str = "") {
  return String(str).replace(/'/g, "").toLowerCase().trim();
}

function convertToTraditional(input = "") {
  try {
    if (window.OpenCC && typeof OpenCC.Converter === "function") {
      const converter = OpenCC.Converter({ from: "cn", to: "tw" });
      return converter(String(input));
    }
  } catch (e) {
    console.warn("OpenCC conversion failed:", e);
  }
  return String(input);
}

function getLang() {
  return document.documentElement.lang === "zh" ? "zh" : "en";
}


// --- Search across ALL loaded JSONs, sheet by sheet ---
function searchPositions(term) {
  const keyword = normalize(convertToTraditional(term));
  if (!keyword) return [];

  const results = [];

  for (const [fileName, sheets] of Object.entries(positionSources)) {
    for (const [sheetName, rows] of Object.entries(sheets)) {
      if (rows.length < 2) continue; // skip if only headers

      const headers = rows[0].map(cell => cell.text); // row 0 = header texts

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
         if (isMergedRow(row)) continue;
        let found = false;

        // Only check first 6 columns
        for (let c = 0; c < 6; c++) {
          const cell = row[c];
          if (!cell || !cell.text) continue;

          if (normalize(cell.text).includes(keyword)) {
            found = true;
            break;
          }
        }

        if (found) {
         results.push({
          file: fileName,
          sheet: sheetName,
          weiZ: row[0]?.text || "",
          weiE: row[1]?.text || "",
          shuZ: row[2]?.text || "",
          shuE: row[3]?.text || "",
          wuZ:  row[4]?.text || "",
          wuE:  row[5]?.text || "",
          });
        }
      }
    }
  }

  return results;
}





// --- Search button handler ---
window.handleSearch = function () {
  const input = document.getElementById("searchInput")?.value?.trim() || "";
  const lang = getLang();

  let warningMsg = "";
  if ((/^[a-zA-Z]{1,3}$/).test(input) || input.length === 1) {
    warningMsg = lang === "zh"
      ? "當前輸入較短，或無法精準搜尋，可嘗試提供更具體的關鍵詞。"
      : "Search term is very short; you may get too many results. Consider refining your search.";
  }

  const results = searchPositions(input);

  // Prepare payload
  const payload = {
    query: input,
    lang,
    warning: warningMsg,
    results
  };

  // Store in localStorage
  localStorage.setItem("positionSearchResults", JSON.stringify(payload));

  // Open results page
  window.open("../scripts/search_results.html", "_blank");

  if (!results.length) {
    resultBox.innerHTML = lang === "zh"
      ? "<p>未找到相關內容。</p>"
      : "<p>No matching results found.</p>";
    return;
  }

  const labels = {
    Wei: lang === "zh" ? "魏" : "Wei",
    Shu: lang === "zh" ? "蜀" : "Shu",
    Wu:  lang === "zh" ? "吳" : "Wu",
  };

  resultBox.innerHTML = results.map(r => `
  <div class="result-entry">
    <p>[Link: <u>${getFileLabel(r.file)}</u> → ${r.sheet}]</p>
    <p><strong>${labels.Wei}:</strong> ${r.weiZ} || ${r.weiE}</p>
    <p><strong>${labels.Shu}:</strong> ${r.shuZ} || ${r.shuE}</p>
    <p><strong>${labels.Wu}:</strong> ${r.wuZ}  || ${r.wuE}</p>
  </div>
`).join("<hr>");
};
