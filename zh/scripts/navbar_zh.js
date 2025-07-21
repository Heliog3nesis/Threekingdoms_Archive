
function setNavLinks(basePath = "/") {
  const home = document.getElementById("home-link");
  const about = document.getElementById("about-link");
  const lang = document.getElementById("lang-switch");

  if (home && about && lang) {
    home.href = `${basePath}zh/index_zh.html`;
    about.href = `${basePath}zh/about_zh.html`;
    lang.href = `${basePath}index.html`;
  } else {
    console.error("One or more navbar links not found");
  }
}
