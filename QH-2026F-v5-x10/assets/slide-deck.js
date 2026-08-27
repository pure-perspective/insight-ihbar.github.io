(() => {
  const source = document.querySelector(".post-content > .course-theme") || document.querySelector(".post-content");
  const root = document.querySelector("#qh-slide-root");
  const modeButtons = Array.from(document.querySelectorAll("[data-qh-view]"));

  if (!source || !root || modeButtons.length === 0) return;

  const stage = root.querySelector(".qhs-stage");
  const scaler = root.querySelector(".qhs-scaler");
  const rail = root.querySelector(".qhs-rail");
  const railHandle = root.querySelector(".qhs-rail-handle");
  const thumbList = root.querySelector(".qhs-thumb-list");
  const thumbTotal = root.querySelector(".qhs-thumb-total");
  const previousButton = root.querySelector("[data-qhs-action='previous']");
  const nextButton = root.querySelector("[data-qhs-action='next']");
  const fullscreenButton = root.querySelector("[data-qhs-action='fullscreen']");
  const range = root.querySelector(".qhs-range");
  const counterCurrent = root.querySelector(".qhs-counter strong");
  const counterTotal = root.querySelector(".qhs-counter span");
  const liveRegion = root.querySelector(".qhs-live");

  const baseTitle = document.title;
  const courseCode = root.dataset.qhsCourse || "PHYS598500";
  const weekLabel = root.dataset.qhsWeek || "WEEK";
  const topicLabel = root.dataset.qhsTopic || "Course slides";
  const titleSuffix = root.dataset.qhsTitleSuffix || "QH-2026F";
  const slides = [];
  const sourceAnchors = [];
  const sourceBlockToSlide = new Map();
  let currentIndex = 0;
  let mode = "article";
  let built = false;
  let wheelLock = false;
  let pointerStart = null;
  let articleScrollY = 0;
  let thumbnailsBuilt = false;
  let thumbCurrentIndex = null;
  const fittedSlides = new Set();

  const clamp = (value) => Math.max(0, Math.min(slides.length - 1, value));
  const pad = (value) => String(value).padStart(2, "0");
  const cleanText = (node) => (node?.textContent || "").replace(/\s+/g, " ").trim();

  function viewFromUrl() {
    try {
      return new URL(location.href).searchParams.get("view") === "slides" ? "slides" : "article";
    } catch (_) {
      return "article";
    }
  }

  function hashIndex() {
    const match = location.hash.match(/slide=(\d+)/i);
    return match ? Math.max(0, Number(match[1]) - 1) : 0;
  }

  function updateUrl(nextMode) {
    try {
      const url = new URL(location.href);
      if (nextMode === "slides") {
        url.searchParams.set("view", "slides");
        url.hash = `slide=${pad(currentIndex + 1)}`;
      } else {
        url.searchParams.delete("view");
        url.hash = "";
      }
      history.replaceState(null, "", url.href);
    } catch (_) {
      // The page still works if a restrictive file preview blocks URL updates.
    }
  }

  function setModeButtonState(nextMode) {
    modeButtons.forEach((button) => {
      const active = button.dataset.qhView === nextMode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function blockWeight(node) {
    const tag = node.tagName;
    if (tag === "TEMPLATE") return 0;
    if (tag === "IMG") return 330;
    if (tag === "TABLE") return 190 + node.querySelectorAll("tr").length * 58;
    if (tag === "UL" || tag === "OL") return 80 + node.querySelectorAll("li").length * 48;
    if (/^H[1-4]$/.test(tag)) return tag === "H4" ? 75 : 120;
    const imageCount = node.querySelectorAll?.("img").length || 0;
    const rows = node.querySelectorAll?.("tr").length || 0;
    return 45 + Math.ceil(cleanText(node).length / 90) * 30 + imageCount * 260 + rows * 48;
  }

  function semanticBlocks() {
    const containers = ".qh-week-meta,.qh-board,.qh-case,.qh-task,.qh-answer,.note,.learning-check,.equation";
    const selector = `h2,h3,h4,p,ul,ol,table,img,template[data-slide-only],${containers}`;
    const candidates = Array.from(source.querySelectorAll(selector));
    const set = new Set(candidates);

    return candidates.filter((node) => {
      const slideOnlyTemplate = node.matches("template[data-slide-only]");
      if (node.closest(".theme-header, .post-meta, #prev-next-nav, script, style")) return false;
      if (!slideOnlyTemplate && !cleanText(node) && node.tagName !== "IMG") return false;
      if (slideOnlyTemplate) return true;

      let parent = node.parentElement;
      while (parent && parent !== source) {
        if (set.has(parent)) return false;
        parent = parent.parentElement;
      }
      return true;
    });
  }

  function contentGroups() {
    const groups = [];
    const pageWeightLimit = 680;
    let current = null;
    let continuation = 1;
    let activeTitle = "本週定位";

    const flush = () => {
      if (current?.nodes.length) groups.push(current);
      current = null;
    };

    semanticBlocks().forEach((node) => {
      if (node.matches("template[data-slide-only]")) {
        flush();
        groups.push({
          title: node.dataset.slideTitle || "Slide 專屬內容",
          anchor: node.parentElement || source,
          nodes: [node],
          weight: 0,
          divider: false,
          slideOnly: true
        });
        return;
      }

      const startsSection = node.matches("h2, h3");
      const weight = blockWeight(node);

      if (startsSection) {
        flush();
        continuation = 1;
        activeTitle = cleanText(node);
        current = {
          title: activeTitle,
          anchor: node,
          nodes: [node],
          weight,
          divider: node.tagName === "H2"
        };
        return;
      }

      if (!current) {
        current = { title: activeTitle, anchor: node, nodes: [], weight: 0, divider: false };
      }

      // T2-2 contains long derivations made of consecutive paragraphs. Splitting only
      // at headings/images/tables leaves those derivations too tall even after scaling,
      // so any semantic block may start a continuation page once the page is full.
      if (current.weight + weight > pageWeightLimit && current.nodes.length > 1) {
        const previousTitle = current.title.replace(/（續 \d+）$/, "");
        flush();
        continuation += 1;
        current = {
          title: `${previousTitle}（續 ${continuation}）`,
          anchor: node,
          nodes: [],
          weight: 0,
          divider: false
        };
      }

      current.nodes.push(node);
      current.weight += weight;
    });

    flush();
    return groups;
  }

  const slideDirectiveSelector = [
    "[data-slide-width]",
    "[data-slide-max-height]",
    "[data-slide-align]",
    "[data-slide-x]",
    "[data-slide-y]",
    "[data-slide-fit]",
    "[data-slide-hidden]"
  ].join(",");

  function cssLength(value) {
    const normalized = String(value ?? "").trim();
    return /^-?(?:\d+|\d*\.\d+)$/.test(normalized) ? `${normalized}px` : normalized;
  }

  function applySlideDirectives(scope) {
    const directed = [];
    if (scope.matches?.(slideDirectiveSelector)) directed.push(scope);
    directed.push(...(scope.querySelectorAll?.(slideDirectiveSelector) || []));

    directed.forEach((element) => {
      const { slideWidth, slideMaxHeight, slideAlign, slideX, slideY, slideFit, slideHidden } = element.dataset;

      if (slideWidth) element.style.setProperty("width", cssLength(slideWidth), "important");
      if (slideMaxHeight) element.style.setProperty("max-height", cssLength(slideMaxHeight), "important");
      if (slideFit) element.style.setProperty("object-fit", slideFit, "important");

      if (["left", "center", "right"].includes(slideAlign)) {
        const gridAlignment = { left: "start", center: "center", right: "end" }[slideAlign];
        const leftMargin = slideAlign === "left" ? "0" : "auto";
        const rightMargin = slideAlign === "right" ? "0" : "auto";
        element.style.setProperty("justify-self", gridAlignment, "important");
        element.style.setProperty("margin-left", leftMargin, "important");
        element.style.setProperty("margin-right", rightMargin, "important");
      }

      if (slideX || slideY) {
        element.style.setProperty(
          "transform",
          `translate(${cssLength(slideX || 0)}, ${cssLength(slideY || 0)})`,
          "important"
        );
      }

      if (slideHidden === "true") element.style.setProperty("display", "none", "important");
    });
  }

  function sanitizeClone(node) {
    const clone = node.cloneNode(true);
    clone.removeAttribute?.("id");
    clone.querySelectorAll?.("[id]").forEach((child) => child.removeAttribute("id"));
    clone.querySelectorAll?.("script").forEach((child) => child.remove());
    clone.querySelectorAll?.("img").forEach((image) => {
      image.removeAttribute("loading");
      image.removeAttribute("width");
      image.removeAttribute("height");
    });
    applySlideDirectives(clone);
    return clone;
  }

  function slideOnlyContent(template) {
    const fragment = document.createDocumentFragment();
    const selector = template.dataset.slideUse;

    if (selector) {
      let referenced = null;
      try {
        referenced = source.querySelector(selector) || document.querySelector(selector);
      } catch (_) {
        referenced = null;
      }

      if (referenced) {
        const referenceSource = referenced.tagName === "TEMPLATE" ? referenced.content : referenced;
        fragment.appendChild(sanitizeClone(referenceSource));
      } else {
        const warning = document.createElement("p");
        warning.className = "qhs-reference-warning";
        warning.textContent = `找不到 Slide 引用來源：${selector}`;
        fragment.appendChild(warning);
      }
    }

    fragment.appendChild(sanitizeClone(template.content));
    return fragment;
  }

  function slideShell(title, options = {}) {
    const slide = document.createElement("section");
    slide.className = `qhs-slide${options.cover ? " qhs-cover" : ""}${options.divider ? " qhs-divider-slide" : ""}`;
    slide.dataset.title = title;
    slide.setAttribute("aria-hidden", "true");

    const head = document.createElement("div");
    head.className = "qhs-slide-head";
    head.innerHTML = `<span class="qhs-kicker"></span><span class="qhs-section-name"></span>`;
    head.querySelector(".qhs-kicker").textContent = `${courseCode} · ${weekLabel}`;
    head.querySelector(".qhs-section-name").textContent = title;

    const body = document.createElement("div");
    body.className = "qhs-slide-body";
    const inner = document.createElement("div");
    inner.className = "qhs-content-inner";
    body.appendChild(inner);

    const foot = document.createElement("div");
    foot.className = "qhs-slide-foot";
    foot.innerHTML = `<span>原始 HTML 即時同步</span><span class="qhs-number"></span>`;

    slide.append(head, body, foot);
    return { slide, inner };
  }

  function buildDeck() {
    if (built) return;
    built = true;

    const coverHeader = source.querySelector(".theme-header")
      || source.parentElement?.querySelector(":scope > .theme-header")
      || document.querySelector(".post-content > .theme-header");
    const coverTitle = cleanText(coverHeader?.querySelector("h1, h2")) || topicLabel;
    const cover = slideShell(coverTitle, { cover: true });
    cover.inner.appendChild(sanitizeClone(coverHeader || source.querySelector("h1, h2")));
    scaler.appendChild(cover.slide);
    slides.push(cover.slide);
    sourceAnchors.push(coverHeader || source);

    contentGroups().forEach((group) => {
      const builtSlide = slideShell(group.title, { divider: group.divider });
      group.nodes.forEach((node) => {
        if (node.matches("template[data-slide-only]")) {
          builtSlide.inner.appendChild(slideOnlyContent(node));
          return;
        }

        const clone = sanitizeClone(node);
        if (node.tagName === "IMG") {
          const imageBlock = document.createElement("div");
          imageBlock.className = "qhs-image-block";
          imageBlock.appendChild(clone);
          builtSlide.inner.appendChild(imageBlock);
        } else {
          builtSlide.inner.appendChild(clone);
        }
      });
      scaler.appendChild(builtSlide.slide);
      const index = slides.length;
      slides.push(builtSlide.slide);
      sourceAnchors.push(group.anchor);
      group.nodes.forEach((node) => sourceBlockToSlide.set(node, index));
    });

    slides.forEach((slide, index) => {
      slide.querySelector(".qhs-number").textContent = `${pad(index + 1)} / ${pad(slides.length)}`;
    });

    range.max = String(slides.length);
    thumbTotal.textContent = `${slides.length} slides`;
    counterTotal.textContent = `/ ${pad(slides.length)}`;
    goTo(hashIndex(), { force: true, updateLocation: false });
  }

  function labelFor(slide, index) {
    return slide.dataset.title || `Slide ${index + 1}`;
  }

  function buildThumbnails() {
    if (thumbnailsBuilt) return;
    thumbnailsBuilt = true;
    const fragment = document.createDocumentFragment();

    slides.forEach((slide, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "qhs-thumb-button";
      button.dataset.slideTarget = String(index);
      button.setAttribute("role", "listitem");
      button.setAttribute("aria-label", `前往第 ${index + 1} 頁：${labelFor(slide, index)}`);

      const screen = document.createElement("div");
      screen.className = "qhs-thumb-screen";
      const preview = document.createElement("div");
      preview.className = "qhs-thumb-preview";

      const previewKicker = document.createElement("span");
      previewKicker.className = "qhs-thumb-preview-kicker";
      previewKicker.textContent = `${weekLabel} · ${pad(index + 1)}`;

      const previewTitle = document.createElement("strong");
      previewTitle.className = "qhs-thumb-preview-title";
      previewTitle.textContent = labelFor(slide, index);

      const previewSummary = document.createElement("span");
      previewSummary.className = "qhs-thumb-preview-summary";
      const content = slide.querySelector(".qhs-content-inner");
      const summary = cleanText(content);
      previewSummary.textContent = summary.length > 86 ? `${summary.slice(0, 86)}…` : summary;

      const previewMeta = document.createElement("span");
      previewMeta.className = "qhs-thumb-preview-meta";
      const contentTypes = [];
      if (content?.querySelector("img")) contentTypes.push("圖");
      if (content?.querySelector("table")) contentTypes.push("表");
      if (content?.querySelector("mjx-container") || /\\\(|\\\[/.test(content?.textContent || "")) contentTypes.push("式");
      previewMeta.textContent = contentTypes.length ? contentTypes.join(" · ") : "內容";

      preview.append(previewKicker, previewTitle, previewSummary, previewMeta);
      screen.appendChild(preview);

      const label = document.createElement("span");
      label.className = "qhs-thumb-label";
      const number = document.createElement("strong");
      number.textContent = pad(index + 1);
      const title = document.createElement("span");
      title.textContent = labelFor(slide, index);
      label.append(number, title);

      button.append(screen, label);
      button.addEventListener("click", () => {
        goTo(index);
        button.blur();
        setDrawer(false);
      });
      fragment.appendChild(button);
    });

    thumbList.replaceChildren(fragment);
    thumbCurrentIndex = null;
    updateThumbState();
  }

  function ensureThumbnails() {
    if (built && !thumbnailsBuilt) buildThumbnails();
  }

  function updateThumbState() {
    if (!thumbnailsBuilt) return;
    if (thumbCurrentIndex !== null && thumbCurrentIndex !== currentIndex) {
      thumbList.querySelector(`[data-slide-target='${thumbCurrentIndex}']`)?.setAttribute("aria-current", "false");
    }
    const currentThumb = thumbList.querySelector(`[data-slide-target='${currentIndex}']`);
    currentThumb?.setAttribute("aria-current", "true");
    currentThumb?.scrollIntoView({ block: "nearest" });
    thumbCurrentIndex = currentIndex;
  }

  function goTo(nextIndex, options = {}) {
    if (!slides.length) return;
    const next = clamp(nextIndex);
    if (next === currentIndex && !options.force) return;

    const previousIndex = currentIndex;
    const previousSlide = slides[previousIndex];
    const nextSlide = slides[next];

    if (previousSlide && previousSlide !== nextSlide) {
      previousSlide.classList.remove("is-active");
      previousSlide.classList.toggle("was-active", previousIndex < next);
      previousSlide.setAttribute("aria-hidden", "true");
    }

    nextSlide.classList.add("is-active");
    nextSlide.classList.remove("was-active");
    nextSlide.setAttribute("aria-hidden", "false");

    currentIndex = next;
    if (mode === "slides" && !root.hidden) fitSlide(currentIndex);
    previousButton.disabled = currentIndex === 0;
    nextButton.disabled = currentIndex === slides.length - 1;
    range.value = String(currentIndex + 1);
    counterCurrent.textContent = pad(currentIndex + 1);
    liveRegion.textContent = `第 ${currentIndex + 1} 頁，共 ${slides.length} 頁。${labelFor(slides[currentIndex], currentIndex)}`;
    updateThumbState();

    if (mode === "slides") {
      document.title = `${pad(currentIndex + 1)} · ${labelFor(slides[currentIndex], currentIndex)} | ${titleSuffix}`;
      if (options.updateLocation !== false) updateUrl("slides");
    }
  }

  function resizeStage() {
    if (root.hidden) return;
    const availableWidth = Math.max(320, stage.clientWidth - 34);
    const availableHeight = Math.max(180, stage.clientHeight - 26);
    const scale = Math.min(availableWidth / 1440, availableHeight / 810);
    scaler.style.setProperty("--qhs-scale", scale.toFixed(5));
  }

  function fitSlide(index, options = {}) {
    if (root.hidden || (fittedSlides.has(index) && !options.force)) return;
    const slide = slides[index];
    if (!slide) return;

    const body = slide.querySelector(".qhs-slide-body");
    const inner = slide.querySelector(".qhs-content-inner");
    inner.style.transform = "none";
    inner.style.width = "100%";
    const required = inner.scrollHeight;
    const bodyStyle = getComputedStyle(body);
    const available = body.clientHeight
      - parseFloat(bodyStyle.paddingTop || 0)
      - parseFloat(bodyStyle.paddingBottom || 0)
      - 14;
    if (required > available && available > 0) {
      // Leave a small safety margin for MathJax/font reflow. The width expansion
      // keeps the rendered content aligned with the slide after scaling.
      const scale = Math.max(.54, Math.min(1, (available / required) * .95));
      inner.style.width = `${(100 / scale).toFixed(2)}%`;
      inner.style.transform = `scale(${scale.toFixed(4)})`;
    }
    fittedSlides.add(index);
  }

  function fitCurrentSlide(options = {}) {
    fitSlide(currentIndex, options);
  }

  function findArticleIndex() {
    const targetY = Math.min(innerHeight * .34, 260);
    let bestIndex = 0;
    let bestDistance = Infinity;
    sourceAnchors.forEach((anchor, index) => {
      if (!anchor?.getBoundingClientRect) return;
      const rect = anchor.getBoundingClientRect();
      const distance = Math.abs(rect.top - targetY);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    return bestIndex;
  }

  function setDrawer(open) {
    if (open) ensureThumbnails();
    rail.classList.toggle("is-open", open);
    railHandle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (_) {
      // Embedded previews may block fullscreen without affecting other controls.
    }
  }

  function showSlides(options = {}) {
    buildDeck();
    let targetIndex = currentIndex;
    if (mode === "article") {
      articleScrollY = window.scrollY;
      if (!options.initial) targetIndex = findArticleIndex();
    }

    mode = "slides";
    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    document.body.classList.add("qh-slide-active");
    setModeButtonState("slides");
    goTo(targetIndex, { force: true, updateLocation: false });
    updateUrl("slides");

    requestAnimationFrame(() => {
      resizeStage();
      fitCurrentSlide();
    });
  }

  function showArticle(options = {}) {
    const returnAnchor = sourceAnchors[currentIndex];
    mode = "article";
    setDrawer(false);
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    document.body.classList.remove("qh-slide-active");
    setModeButtonState("article");
    document.title = baseTitle;
    if (!options.initial) updateUrl("article");

    if (!options.initial) {
      requestAnimationFrame(() => {
        if (returnAnchor?.scrollIntoView) returnAnchor.scrollIntoView({ block: "start", behavior: "smooth" });
        else window.scrollTo({ top: articleScrollY, behavior: "smooth" });
      });
    }
  }

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.qhView === "slides") showSlides();
      else showArticle();
    });
  });

  previousButton.addEventListener("click", () => goTo(currentIndex - 1));
  nextButton.addEventListener("click", () => goTo(currentIndex + 1));
  fullscreenButton.addEventListener("click", toggleFullscreen);
  range.addEventListener("input", (event) => goTo(Number(event.target.value) - 1));
  railHandle.addEventListener("click", () => setDrawer(!rail.classList.contains("is-open")));
  rail.addEventListener("pointerenter", ensureThumbnails);
  rail.addEventListener("focusin", ensureThumbnails);
  rail.addEventListener("pointerleave", () => setDrawer(false));
  stage.addEventListener("pointerenter", () => {
    setDrawer(false);
    if (rail.contains(document.activeElement)) document.activeElement.blur();
  });

  document.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || mode !== "slides") return;
    const key = event.key;
    if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(key)) {
      event.preventDefault();
      goTo(currentIndex + 1);
    } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(key)) {
      event.preventDefault();
      goTo(currentIndex - 1);
    } else if (key === "Home") {
      event.preventDefault();
      goTo(0);
    } else if (key === "End") {
      event.preventDefault();
      goTo(slides.length - 1);
    } else if (key.toLowerCase() === "f") {
      event.preventDefault();
      toggleFullscreen();
    } else if (key === "Escape") {
      setDrawer(false);
    }
  });

  stage.addEventListener("wheel", (event) => {
    if (mode !== "slides" || wheelLock || Math.abs(event.deltaY) < 42) return;
    wheelLock = true;
    goTo(currentIndex + (event.deltaY > 0 ? 1 : -1));
    window.setTimeout(() => { wheelLock = false; }, 520);
  }, { passive: true });

  stage.addEventListener("pointerdown", (event) => {
    pointerStart = { x: event.clientX, y: event.clientY };
  });

  stage.addEventListener("pointerup", (event) => {
    if (!pointerStart || mode !== "slides") return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    pointerStart = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy)) goTo(currentIndex + (dx < 0 ? 1 : -1));
  });

  window.addEventListener("resize", () => {
    resizeStage();
  });

  document.addEventListener("fullscreenchange", resizeStage);

  buildDeck();
  const initialView = viewFromUrl();
  currentIndex = clamp(hashIndex());
  if (initialView === "slides") showSlides({ initial: true });
  else showArticle({ initial: true });

  const refreshAfterTypeset = () => {
    fittedSlides.clear();
    if (root.hidden) return;
    requestAnimationFrame(() => fitCurrentSlide({ force: true }));
  };

  if (window.MathJax?.startup?.promise) {
    window.MathJax.startup.promise.then(refreshAfterTypeset).catch(() => {});
  } else {
    window.setTimeout(refreshAfterTypeset, 1200);
  }

  if (document.fonts?.ready) document.fonts.ready.then(refreshAfterTypeset).catch(() => {});
})();
