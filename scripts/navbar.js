function setNavLinks(basePath = "/") {
  const home = document.getElementById("home-link");
  const about = document.getElementById("about-link");
  const lang = document.getElementById("lang-switch");

  if (home && about && lang) {
    home.href = `${basePath}index.html`;
    about.href = `${basePath}about.html`;
    lang.href = `${basePath}zh/index_zh.html`;
  } else {
    console.error("One or more navbar links not found");
  }
}
