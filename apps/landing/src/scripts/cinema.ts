// Scroll-scrubbed stage: every layer is driven by CSS custom properties computed from scroll distance and pointer position.

const section = document.querySelector<HTMLElement>(".cinema-scroll")!;
const root = document.documentElement;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const track = document.querySelector<HTMLElement>(".sights-track")!;
const controls = document.querySelector<HTMLElement>(".sights-controls")!;
const originals = [...document.querySelectorAll<HTMLElement>(".sight-card")];

let targetMouseX = 0,
  targetMouseY = 0,
  mouseX = 0,
  mouseY = 0;
let targetScroll = 0,
  smoothScroll = 0;
let initialized = false,
  rafPending = false;
let cards: HTMLElement[] = [];
const count = originals.length;
let active = count;

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const smoothstep = (e0: number, e1: number, v: number) => {
  const x = clamp((v - e0) / (e1 - e0));
  return x * x * (3 - 2 * x);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const segmentInOut = (s: number, a: number, b: number, c: number, d: number) => {
  const enter = smoothstep(a, b, s),
    exit = smoothstep(c, d, s);
  return { enter, exit, active: enter * (1 - exit) };
};
const scrollDistance = () => clamp(-section.getBoundingClientRect().top, 0, section.offsetHeight - window.innerHeight);
const set = (name: string, value: string | number) => root.style.setProperty(name, String(value));

function update() {
  rafPending = false;
  targetScroll = scrollDistance();
  if (!initialized || reduceMotion.matches) {
    smoothScroll = targetScroll;
    initialized = true;
  } else {
    smoothScroll = lerp(smoothScroll, targetScroll, 0.14);
  }
  if (Math.abs(smoothScroll - targetScroll) < 0.08) smoothScroll = targetScroll;

  mouseX = lerp(mouseX, targetMouseX, 0.12);
  mouseY = lerp(mouseY, targetMouseY, 0.12);

  const frame2 = segmentInOut(smoothScroll, 560, 900, 1300, 1620);
  const frame3 = segmentInOut(smoothScroll, 1760, 2140, 2540, 2700);
  const progress = clamp(smoothScroll / 2700);
  const introExit = smoothstep(90, 650, smoothScroll);
  const sightsEnter = smoothstep(2760, 3560, smoothScroll) ** 1.55;
  const controlsEnter = smoothstep(3360, 3660, smoothScroll);
  const blurActive = clamp(frame2.active + frame3.active);
  const splitDrift = frame2.enter ** 1.5;
  const backScale = 0.76 + progress * 0.2 + frame2.enter * 0.18 + frame3.enter * 0.16;
  const heroY = progress * -74;
  const heroScale = progress * 0.23;
  const sightsScreenTop = Math.min(220, Math.max(112, window.innerHeight * 0.19)) - 50;
  const sightsParentTop = window.innerHeight - (window.innerHeight - sightsScreenTop) / backScale;

  set("--mx", reduceMotion.matches ? 0 : mouseX.toFixed(4));
  set("--my", reduceMotion.matches ? 0 : mouseY.toFixed(4));

  set("--back-opacity", 1 - frame2.active * 0.06);
  set("--back-x", `${mouseX * -12}px`);
  set("--back-y", `${mouseY * -4}px`);
  set("--back-scale", backScale);
  set("--four-y", `${10 + progress * 10}vh`);
  set("--four-scale", 0.78 + progress * 0.16);
  set("--bazaar-y", `${20 - progress * 8}vh`);
  set("--blur-px", `${blurActive * 14}px`);
  set("--back-brightness", 1 - blurActive * 0.255);
  set("--bazaar-blur-px", `${frame2.active * 14}px`);
  set("--bazaar-brightness", 1 - frame2.active * 0.255 - frame3.active * 0.06);
  set("--bazaar-saturation", 1 + frame3.active * 0.18);
  set("--shade-opacity", "1");
  set("--shade-z", frame2.active > 0.02 ? "2" : "0");
  set("--shade-top-alpha", blurActive * 0.465);
  set("--shade-mid-alpha", blurActive * 0.42);
  set("--shade-bottom-alpha", blurActive * 0.51);

  set("--title-y", `${introExit * -210}px`);
  set("--title-scale", 1 - introExit * 0.08);
  set("--title-opacity", 1 - introExit);

  set("--bridge-x", `calc(-50% + ${mouseX * 18}px)`);
  set("--bridge-y", `${mouseY * 8 + heroY - frame2.exit * 760}px`);
  set("--bridge-bottom", `${5 - frame2.enter * 13}vh`);
  set("--bridge-width", `${67.2 + frame2.enter * 37.8}vw`);
  set("--bridge-scale", 1.02 + heroScale + frame2.exit * 0.46);

  set("--split-left-x", `calc(-50% + ${-splitDrift * 46}vw + ${mouseX * 22}px)`);
  set("--split-left-y", `${mouseY * 10 + heroY - splitDrift * 180}px`);
  set("--split-left-scale", 1 + heroScale + frame2.enter * 0.74);
  set("--split-right-x", `calc(-50% + ${splitDrift * 46}vw + ${mouseX * 22}px)`);
  set("--split-right-y", `${mouseY * 10 + heroY - splitDrift * 180}px`);
  set("--split-right-scale", 1 + heroScale + frame2.enter * 0.74);

  set("--frame2-opacity", frame2.active * (1 - frame3.enter));
  set("--frame2-x", `calc(-50% + ${mouseX * 10}px)`);
  set("--frame2-y", `calc(-50% + ${mouseY * 8 - frame2.exit * 150}px)`);
  set("--frame2-scale", 1.06 + frame2.enter * 0.08 + frame2.exit * 0.08);

  set("--intro-copy-y", `${introExit * 90}px`);
  set("--intro-copy-opacity", 1 - introExit);
  set("--panel2-opacity", frame2.active * (1 - frame2.exit));
  set("--panel2-y", `calc(-50% + ${-frame2.exit * 86 + (1 - frame2.enter) * 58}px)`);
  set("--panel3-opacity", frame3.active * (1 - frame3.exit));
  set("--panel3-y", `calc(-50% + ${-frame3.exit * 86 + (1 - frame3.enter) * 58}px)`);

  set("--sights-opacity", sightsEnter);
  set("--sights-controls-opacity", controlsEnter);
  controls.classList.toggle("is-ready", controlsEnter > 0.98);
  set("--sights-visibility", sightsEnter > 0.01 ? "visible" : "hidden");
  set("--sights-y", "0px");
  set("--sights-enter-x", `${(1 - sightsEnter) * 420}vw`);
  set("--sights-scale", 1 / backScale);
  set("--sights-top", `${sightsParentTop}px`);
  set("--sights-screen-top", `${sightsScreenTop}px`);

  if (
    Math.abs(smoothScroll - targetScroll) > 0.08 ||
    Math.abs(mouseX - targetMouseX) > 0.001 ||
    Math.abs(mouseY - targetMouseY) > 0.001
  )
    requestTick();
}

function requestTick() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(update);
}

// Infinite slider: three copies of the cards, starting on the middle copy and jumping back to it without a transition.
function updateSlider() {
  const first = cards[0];
  if (!first) return;
  const gap = parseFloat(getComputedStyle(track).columnGap || "0");
  set("--sights-shift", `${-(first.offsetWidth + gap) * active}px`);
  for (const [i, card] of cards.entries()) card.classList.toggle("is-active", i === active);
}

function moveSlider(dir: number) {
  active += dir;
  updateSlider();
}

function selectCard(card: HTMLElement) {
  const i = Number(card.dataset.sightIndex);
  if (Number.isFinite(i)) active = i;
  updateSlider();
}

function jumpSlider(i: number) {
  track.classList.add("is-jumping");
  active = i;
  updateSlider();
  requestAnimationFrame(() => requestAnimationFrame(() => track.classList.remove("is-jumping")));
}

function normalizeSlider() {
  if (active >= count * 2) jumpSlider(active - count);
  else if (active < count) jumpSlider(active + count);
}

function setupSlider() {
  track.replaceChildren();
  for (let setIndex = 0; setIndex < 3; setIndex++) {
    originals.forEach((card, cardIndex) => {
      const clone = card.cloneNode(true) as HTMLElement;
      clone.dataset.sightIndex = String(setIndex * count + cardIndex);
      clone.addEventListener("click", () => selectCard(clone));
      clone.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        selectCard(clone);
      });
      track.append(clone);
    });
  }
  cards = [...track.querySelectorAll<HTMLElement>(".sight-card")];
  active = count;
  track.addEventListener("transitionend", normalizeSlider);
  updateSlider();
}

window.addEventListener("scroll", requestTick, { passive: true });
window.addEventListener("resize", () => {
  updateSlider();
  requestTick();
});
window.addEventListener(
  "pointermove",
  (e) => {
    targetMouseX = e.clientX / window.innerWidth - 0.5;
    targetMouseY = e.clientY / window.innerHeight - 0.5;
    requestTick();
  },
  { passive: true },
);
document.querySelector(".sight-prev")!.addEventListener("click", () => moveSlider(-1));
document.querySelector(".sight-next")!.addEventListener("click", () => moveSlider(1));

setupSlider();
requestTick();
