const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf-8");
const js = fs.readFileSync("main.js", "utf-8");

const virtualConsole = new jsdom.VirtualConsole();
virtualConsole.on("error", (err) => {
  console.error("JSDOM ERROR:", err);
});
virtualConsole.on("log", (log) => {
  console.log("JSDOM LOG:", log);
});

const dom = new JSDOM(html, {
  url: "http://localhost/",
  runScripts: "dangerously",
  resources: "usable",
  virtualConsole
});

dom.window.eval(js);

setTimeout(() => {
    console.log("App Object exists:", !!dom.window.app);
    if (!dom.window.app) {
       console.log("MobileApp instantiation failed or stuck!");
    } else {
       console.log("MobileApp instantiated successfully.");
       console.log("Driver Name loaded:", dom.window.document.getElementById('driver-name').innerText);
    }
}, 1000);
