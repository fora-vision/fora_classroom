import Stats from "stats.js";

const stats = new Stats();
stats.showPanel(2); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);
stats.dom.hidden = true;
stats.dom.classList.add("metrics");

export const predictStats = stats.addPanel(new Stats.Panel("ms pred", "#ff8", "#221"));
export const initStats = stats.addPanel(new Stats.Panel("ms init", "#ff8", "#221"));
export const uploadStats = stats.addPanel(new Stats.Panel("kb upload", "#ff8", "#221"));
export const framesStats = stats.addPanel(new Stats.Panel("frames", "#ff8", "#221"));
export const loadStats = new Stats.Panel("kb load", "#ff8", "#221");

export default stats;
