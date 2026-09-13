(() => {
  const source = document.querySelector("#qhs-manual-slides");
  const root = document.querySelector("#qh-slide-root");
  const articleContent = document.querySelector("#qhs-article-content");
  const modeButtons = Array.from(document.querySelectorAll("[data-qh-view]"));
  if (!source || !root || !articleContent || modeButtons.length === 0) return;

  const stage = root.querySelector(".qhs-stage");
  const scaler = root.querySelector(".qhs-scaler");
  const rail = root.querySelector(".qhs-rail");
  const railHandle = root.querySelector(".qhs-rail-handle");
  const thumbList = root.querySelector(".qhs-thumb-list");
  const thumbTotal = root.querySelector(".qhs-thumb-total");
  const previousButton = root.querySelector("[data-qhs-action='previous']");
  const nextButton = root.querySelector("[data-qhs-action='next']");
  const fullscreenButton = root.querySelector("[data-qhs-action='fullscreen']");
  const noClickAdvanceButton = root.querySelector("[data-qhs-action='no-click-advance']");
  const range = root.querySelector(".qhs-range");
  const counterCurrent = root.querySelector(".qhs-counter strong");
  const counterTotal = root.querySelector(".qhs-counter span");
  const liveRegion = root.querySelector(".qhs-live");

  const courseCode = root.dataset.qhsCourse || "PHYS598500";
  const weekLabel = root.dataset.qhsWeek || "WEEK";
  const titleSuffix = root.dataset.qhsTitleSuffix || "QH-2026F";
  const slides = [];
  const articleAnchors = [];
  const slideSourceIndices = [];
  const sourceToSlideIndex = new Map();
  const fittedSlides = new Set();
  let currentIndex = 0;
  let mode = "slides";
  let articleScrollY = 0;
  let thumbnailsBuilt = false;
  let thumbCurrentIndex = null;
  let wheelLock = false;
  let pointerStart = null;
  let noClickAdvance = root.dataset.qhsNoClickAdvance === "true";
  let suppressClickAdvance = false;

  const pad = (value) => String(value).padStart(2, "0");
  const clamp = (value) => Math.max(0, Math.min(slides.length - 1, value));
  const cleanText = (node) => (node?.textContent || "").replace(/\s+/g, " ").trim();

  function hashIndex() {
    const match = location.hash.match(/slide=(\d+)/i);
    return match ? Math.max(0, Number(match[1]) - 1) : 0;
  }

  function viewFromUrl() {
    try {
      return new URL(location.href).searchParams.get("view") === "article" ? "article" : "slides";
    } catch (_) {
      return "slides";
    }
  }

  function updateUrl(nextMode) {
    try {
      const url = new URL(location.href);
      if (nextMode === "article") {
        url.searchParams.set("view", "article");
        url.hash = "";
      } else {
        url.searchParams.delete("view");
        url.hash = `slide=${pad(currentIndex + 1)}`;
      }
      history.replaceState(null, "", url.href);
    } catch (_) {
      // Local file previews may block URL updates without affecting the deck.
    }
  }

  function setModeButtonState(nextMode) {
    modeButtons.forEach((button) => {
      const active = button.dataset.qhView === nextMode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  const slideDirectiveSelector = [
    "[data-slide-width]",
    "[data-slide-height]",
    "[data-slide-max-width]",
    "[data-slide-max-height]",
    "[data-slide-align]",
    "[data-slide-position]",
    "[data-slide-left]",
    "[data-slide-top]",
    "[data-slide-right]",
    "[data-slide-bottom]",
    "[data-slide-z]",
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
      const {
        slideWidth, slideHeight, slideMaxWidth, slideMaxHeight, slideAlign,
        slidePosition, slideLeft, slideTop, slideRight, slideBottom, slideZ,
        slideX, slideY, slideFit, slideHidden
      } = element.dataset;
      const hasAbsoluteCoordinates = slideLeft || slideTop || slideRight || slideBottom;
      const isAbsolute = slidePosition === "absolute" || hasAbsoluteCoordinates;

      if (isAbsolute) element.style.setProperty("position", "absolute", "important");
      else if (slidePosition === "relative") element.style.setProperty("position", "relative", "important");
      if (slideLeft) element.style.setProperty("left", cssLength(slideLeft), "important");
      if (slideTop) element.style.setProperty("top", cssLength(slideTop), "important");
      if (slideRight) element.style.setProperty("right", cssLength(slideRight), "important");
      if (slideBottom) element.style.setProperty("bottom", cssLength(slideBottom), "important");
      if (slideZ) element.style.setProperty("z-index", slideZ, "important");
      if (slideWidth) element.style.setProperty("width", cssLength(slideWidth), "important");
      if (slideHeight) element.style.setProperty("height", cssLength(slideHeight), "important");
      if (slideMaxWidth) element.style.setProperty("max-width", cssLength(slideMaxWidth), "important");
      if (slideMaxHeight) element.style.setProperty("max-height", cssLength(slideMaxHeight), "important");
      if (slideFit) element.style.setProperty("object-fit", slideFit, "important");

      if (isAbsolute && !element.matches("img")) {
        const directLink = Array.from(element.children).find((child) => child.matches("a"));
        const framedImages = Array.from(element.querySelectorAll(":scope > img, :scope > a > img"));
        if (directLink) {
          directLink.style.setProperty("display", "block", "important");
          directLink.style.setProperty("width", "100%", "important");
          directLink.style.setProperty("height", "100%", "important");
        }
        framedImages.forEach((image) => {
          image.style.setProperty("width", "100%", "important");
          image.style.setProperty("height", "100%", "important");
          image.style.setProperty("max-width", "none", "important");
          image.style.setProperty("max-height", "none", "important");
          image.style.setProperty("margin", "0", "important");
          image.style.setProperty("object-fit", slideFit || "contain", "important");
        });
      }

      if (["left", "center", "right"].includes(slideAlign)) {
        const gridAlignment = { left: "start", center: "center", right: "end" }[slideAlign];
        element.style.setProperty("justify-self", gridAlignment, "important");
        element.style.setProperty("margin-left", slideAlign === "left" ? "0" : "auto", "important");
        element.style.setProperty("margin-right", slideAlign === "right" ? "0" : "auto", "important");
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

  function flattenDetailsForSlide(scope) {
    const staticContents = (details) => {
      const fragment = document.createDocumentFragment();
      Array.from(details.childNodes).forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE && child.matches("summary")) return;
        fragment.appendChild(child);
      });
      return fragment;
    };

    Array.from(scope.querySelectorAll?.("details") || []).reverse().forEach((details) => {
      details.replaceWith(staticContents(details));
    });
    return scope.matches?.("details") ? staticContents(scope) : scope;
  }

  function sanitizeClone(node) {
    let clone = node.cloneNode(true);
    clone.removeAttribute?.("id");
    clone.querySelectorAll?.("[id]").forEach((child) => child.removeAttribute("id"));
    clone.querySelectorAll?.("script").forEach((child) => child.remove());
    clone.querySelectorAll?.("img").forEach((image) => {
      image.removeAttribute("loading");
      image.removeAttribute("width");
      image.removeAttribute("height");
    });
    clone = flattenDetailsForSlide(clone);
    applySlideDirectives(clone);
    return clone;
  }

  function articleClone(node) {
    const clone = node.cloneNode(true);
    if (clone.dataset?.articleHidden === "true") return document.createDocumentFragment();
    clone.removeAttribute?.("id");
    clone.querySelectorAll?.("[id]").forEach((child) => child.removeAttribute("id"));
    clone.querySelectorAll?.("script").forEach((child) => child.remove());
    clone.querySelectorAll?.("[data-article-hidden='true']").forEach((child) => child.remove());
    return clone;
  }

  function slideShell(title, options = {}) {
    const slide = document.createElement("section");
    slide.className = `qhs-slide${options.cover ? " qhs-cover" : ""}${options.divider ? " qhs-divider-slide" : ""}${options.absoluteLayout ? " qhs-absolute-layout" : ""}`;
    slide.dataset.title = title;
    slide.dataset.autoFit = options.autoFit === false ? "false" : "true";
    slide.setAttribute("aria-hidden", "true");

    const head = document.createElement("div");
    head.className = "qhs-slide-head";
    head.innerHTML = '<span class="qhs-kicker"></span><span class="qhs-section-name"></span>';
    head.querySelector(".qhs-kicker").textContent = `${courseCode} · ${weekLabel}`;
    head.querySelector(".qhs-section-name").textContent = title;

    const body = document.createElement("div");
    body.className = "qhs-slide-body";
    const inner = document.createElement("div");
    inner.className = "qhs-content-inner";
    body.appendChild(inner);

    const foot = document.createElement("div");
    foot.className = "qhs-slide-foot";
    foot.innerHTML = '<span>Manual slide source</span><span class="qhs-number"></span>';
    slide.append(head, body, foot);
    return { slide, inner };
  }

  function buildDeck() {
    const definitions = Array.from(source.children).filter((node) => node.matches("section[data-manual-slide]"));
    let activeCoverTitle = "";

    definitions.forEach((definition, sourceIndex) => {
      if (definition.dataset.slideHidden === "true") return;

      const slideIndex = slides.length;
      const hasAbsoluteLayout = Boolean(definition.querySelector(
        "[data-slide-position='absolute'], [data-slide-left], [data-slide-top], [data-slide-right], [data-slide-bottom]"
      ));
      const isCover = definition.hasAttribute("data-cover");
      const headingTitle = cleanText(definition.querySelector("h1, h2, h3"));
      if (isCover) {
        activeCoverTitle = definition.dataset.title || headingTitle || activeCoverTitle;
      }
      const title = definition.dataset.title
        || (isCover ? headingTitle : activeCoverTitle)
        || headingTitle
        || activeCoverTitle
        || `Slide ${slideIndex + 1}`;
      const built = slideShell(title, {
        cover: isCover,
        divider: definition.hasAttribute("data-divider"),
        absoluteLayout: hasAbsoluteLayout,
        autoFit: definition.dataset.autoFit !== "false" && !hasAbsoluteLayout
      });

      Array.from(definition.childNodes).forEach((node) => {
        built.inner.appendChild(node.nodeType === Node.ELEMENT_NODE ? sanitizeClone(node) : node.cloneNode(true));
      });
      if (!isCover) {
        built.inner.querySelector(".qh-section")?.classList.add("qhs-slide-title");
      }
      scaler.appendChild(built.slide);
      slides.push(built.slide);
      slideSourceIndices.push(sourceIndex);
      sourceToSlideIndex.set(sourceIndex, slideIndex);
    });

    slides.forEach((slide, index) => {
      slide.querySelector(".qhs-number").textContent = `${pad(index + 1)} / ${pad(slides.length)}`;
    });
    range.max = String(slides.length);
    thumbTotal.textContent = `${slides.length} slides`;
    counterTotal.textContent = `/ ${pad(slides.length)}`;
  }

  function buildArticle() {
    const fragment = document.createDocumentFragment();
    const definitions = Array.from(source.children).filter((node) => node.matches("section[data-manual-slide]"));
    definitions.forEach((definition, index) => {
      const block = document.createElement(index === 0 ? "div" : "section");
      block.className = index === 0 ? "qhs-article-cover-source" : "qhs-article-slide-source";
      block.dataset.sourceSlide = String(index);
      if (definition.dataset.articleHidden === "true") block.hidden = true;
      Array.from(definition.childNodes).forEach((node) => {
        block.appendChild(node.nodeType === Node.ELEMENT_NODE ? articleClone(node) : node.cloneNode(true));
      });
      articleAnchors.push(block);
      fragment.appendChild(block);
    });
    articleContent.replaceChildren(fragment);
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
      button.setAttribute("aria-label", `Go to slide ${index + 1}: ${labelFor(slide, index)}`);
      const screen = document.createElement("div");
      screen.className = "qhs-thumb-screen";
      const canvas = document.createElement("div");
      canvas.className = "qhs-thumb-canvas";
      const clone = sanitizeClone(slide);
      clone.classList.remove("is-active", "was-active");
      canvas.appendChild(clone);
      screen.appendChild(canvas);

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

  function setNoClickAdvance(enabled) {
    noClickAdvance = Boolean(enabled);
    root.classList.toggle("is-no-click-advance", noClickAdvance);
    noClickAdvanceButton?.classList.toggle("is-active", noClickAdvance);
    noClickAdvanceButton?.setAttribute("aria-pressed", noClickAdvance ? "true" : "false");
    if (noClickAdvanceButton) {
      noClickAdvanceButton.textContent = noClickAdvance
        ? "Click/drag page change: Off"
        : "Click/drag page change: On";
      noClickAdvanceButton.title = noClickAdvance
        ? "Mouse clicks and horizontal drags will not change slides"
        : "Click or horizontally drag the slide canvas to advance";
    }
    liveRegion.textContent = noClickAdvance
      ? "Mouse click and drag advance off. Text selection, slide controls, previews, keyboard, wheel, and touch swipe remain available."
      : "Mouse click and drag advance on.";
  }

  function ensureThumbnails() {
    if (!thumbnailsBuilt) buildThumbnails();
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
    const previous = slides[currentIndex];
    if (previous && previous !== slides[next]) {
      previous.classList.remove("is-active");
      previous.classList.toggle("was-active", currentIndex < next);
      previous.setAttribute("aria-hidden", "true");
    }

    const slide = slides[next];
    slide.classList.add("is-active");
    slide.classList.remove("was-active");
    slide.setAttribute("aria-hidden", "false");
    currentIndex = next;
    if (mode === "slides") fitSlide(currentIndex);

    previousButton.disabled = currentIndex === 0;
    nextButton.disabled = currentIndex === slides.length - 1;
    range.value = String(currentIndex + 1);
    counterCurrent.textContent = pad(currentIndex + 1);
    liveRegion.textContent = `Slide ${currentIndex + 1} of ${slides.length}. ${labelFor(slide, currentIndex)}`;
    if (mode === "slides") document.title = `${pad(currentIndex + 1)} · ${labelFor(slide, currentIndex)} | ${titleSuffix}`;
    updateThumbState();
    if (mode === "slides" && options.updateLocation !== false) updateUrl("slides");
  }

  function resizeStage() {
    const availableWidth = Math.max(320, stage.clientWidth - 34);
    const availableHeight = Math.max(180, stage.clientHeight - 26);
    const scale = Math.min(availableWidth / 1440, availableHeight / 810);
    scaler.style.setProperty("--qhs-scale", scale.toFixed(5));
  }

  function fitSlide(index, options = {}) {
    if (fittedSlides.has(index) && !options.force) return;
    const slide = slides[index];
    if (!slide || slide.dataset.autoFit === "false") return;
    const body = slide.querySelector(".qhs-slide-body");
    const inner = slide.querySelector(".qhs-content-inner");
    inner.style.transform = "none";
    inner.style.width = "100%";
    const bodyStyle = getComputedStyle(body);
    const available = body.clientHeight
      - parseFloat(bodyStyle.paddingTop || 0)
      - parseFloat(bodyStyle.paddingBottom || 0)
      - 14;
    const required = inner.scrollHeight;
    if (required > available && available > 0) {
      const scale = Math.max(.54, Math.min(1, (available / required) * .95));
      inner.style.width = `${(100 / scale).toFixed(2)}%`;
      inner.style.transform = `scale(${scale.toFixed(4)})`;
    }
    fittedSlides.add(index);
  }

  function setDrawer(open) {
    if (open) ensureThumbnails();
    rail.classList.toggle("is-open", open);
    railHandle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function findArticleIndex() {
    const targetY = Math.min(innerHeight * .34, 260);
    let bestIndex = 0;
    let bestDistance = Infinity;
    articleAnchors.forEach((anchor, index) => {
      if (anchor.hidden) return;
      const distance = Math.abs(anchor.getBoundingClientRect().top - targetY);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    return bestIndex;
  }

  function slideIndexForSource(sourceIndex) {
    if (!slides.length) return 0;
    if (sourceToSlideIndex.has(sourceIndex)) return sourceToSlideIndex.get(sourceIndex);

    for (let distance = 1; distance < articleAnchors.length; distance += 1) {
      const next = sourceIndex + distance;
      if (sourceToSlideIndex.has(next)) return sourceToSlideIndex.get(next);
      const previous = sourceIndex - distance;
      if (sourceToSlideIndex.has(previous)) return sourceToSlideIndex.get(previous);
    }
    return 0;
  }

  function showSlides(options = {}) {
    let targetIndex = currentIndex;
    if (mode === "article") {
      articleScrollY = window.scrollY;
      if (!options.initial) targetIndex = slideIndexForSource(findArticleIndex());
    }
    mode = "slides";
    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    document.body.classList.add("qh-slide-active");
    setModeButtonState("slides");
    goTo(targetIndex, { updateLocation: false });
    updateUrl("slides");
    requestAnimationFrame(() => {
      resizeStage();
      fitSlide(currentIndex, { force: true });
    });
  }

  function showArticle(options = {}) {
    const sourceIndex = slideSourceIndices[currentIndex] ?? 0;
    const returnAnchor = articleAnchors[sourceIndex];
    mode = "article";
    setDrawer(false);
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    document.body.classList.remove("qh-slide-active");
    setModeButtonState("article");
    document.title = `Article · Superconducting-Circuit Quantization and Transmon Design | ${titleSuffix}`;
    updateUrl("article");
    if (!options.initial) {
      requestAnimationFrame(() => {
        if (returnAnchor?.scrollIntoView) returnAnchor.scrollIntoView({ block: "start", behavior: "smooth" });
        else window.scrollTo({ top: articleScrollY, behavior: "smooth" });
      });
    }
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (_) {
      // Embedded previews may block fullscreen without affecting the deck.
    }
  }

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.qhView === "article") showArticle();
      else showSlides();
    });
  });

  previousButton.addEventListener("click", () => {
    goTo(currentIndex - 1);
  });
  nextButton.addEventListener("click", () => {
    goTo(currentIndex + 1);
  });
  fullscreenButton.addEventListener("click", toggleFullscreen);
  noClickAdvanceButton?.addEventListener("click", () => setNoClickAdvance(!noClickAdvance));
  range.addEventListener("input", (event) => {
    goTo(Number(event.target.value) - 1);
  });
  railHandle.addEventListener("click", () => setDrawer(!rail.classList.contains("is-open")));
  rail.addEventListener("pointerenter", ensureThumbnails);
  rail.addEventListener("focusin", ensureThumbnails);
  rail.addEventListener("pointerleave", () => setDrawer(false));
  stage.addEventListener("pointerenter", () => setDrawer(false));

  document.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || mode !== "slides") return;
    if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(event.key)) {
      event.preventDefault();
      goTo(currentIndex + 1);
    } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key)) {
      event.preventDefault();
      goTo(currentIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      goTo(0);
    } else if (event.key === "End") {
      event.preventDefault();
      goTo(slides.length - 1);
    } else if (event.key.toLowerCase() === "f") {
      event.preventDefault();
      toggleFullscreen();
    } else if (event.key === "Escape") {
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
    if (noClickAdvance && event.pointerType === "mouse") {
      pointerStart = null;
      return;
    }
    pointerStart = { x: event.clientX, y: event.clientY, pointerType: event.pointerType };
  });
  stage.addEventListener("pointerup", (event) => {
    if (!pointerStart) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    pointerStart = null;
    if (window.getSelection()?.toString().trim()) return;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy)) {
      suppressClickAdvance = true;
      goTo(currentIndex + (dx < 0 ? 1 : -1));
      window.setTimeout(() => { suppressClickAdvance = false; }, 0);
    }
  });

  stage.addEventListener("click", (event) => {
    if (mode !== "slides" || suppressClickAdvance) return;
    if (event.target.closest("a, button, input, select, textarea, label, summary, [role='button'], [contenteditable='true']")) return;
    if (!noClickAdvance) goTo(currentIndex + 1);
  });

  window.addEventListener("resize", resizeStage);
  document.addEventListener("fullscreenchange", resizeStage);

  buildDeck();
  buildArticle();
  setNoClickAdvance(noClickAdvance);
  currentIndex = clamp(hashIndex());
  if (viewFromUrl() === "article") showArticle({ initial: true });
  else showSlides({ initial: true });

  const refreshAfterTypeset = () => {
    fittedSlides.clear();
    requestAnimationFrame(() => fitSlide(currentIndex, { force: true }));
  };
  if (window.MathJax?.startup?.promise) {
    window.MathJax.startup.promise.then(refreshAfterTypeset).catch(() => {});
  } else {
    window.setTimeout(refreshAfterTypeset, 1200);
  }
  if (document.fonts?.ready) document.fonts.ready.then(refreshAfterTypeset).catch(() => {});
})();
