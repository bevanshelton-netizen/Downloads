(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const artboard = $("artboard");
  const statusText = $("statusText");
  const canvasSizeLabel = $("canvasSizeLabel");

  const initialState = {
    width: 1080,
    height: 1080,
    background: "#f6f2e8",
    selectedId: null,
    brand: {
      name: "IZAKHONO",
      primary: "#111111",
      accent: "#d6ff45",
      font: "Arial Black, Arial, sans-serif"
    },
    objects: []
  };

  let state = structuredClone(initialState);
  let history = [];
  let future = [];
  let drag = null;

  function uid() {
    return "layer-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function announce(message) {
    statusText.textContent = message;
  }

  function snapshot() {
    history.push(JSON.stringify(state));
    if (history.length > 60) history.shift();
    future = [];
  }

  function restore(serialized) {
    state = JSON.parse(serialized);
    render();
  }

  function undo() {
    if (!history.length) return;
    future.push(JSON.stringify(state));
    restore(history.pop());
    announce("Undo complete");
  }

  function redo() {
    if (!future.length) return;
    history.push(JSON.stringify(state));
    restore(future.pop());
    announce("Redo complete");
  }

  function selected() {
    return state.objects.find((o) => o.id === state.selectedId) || null;
  }

  function setSelected(id) {
    state.selectedId = id;
    renderInspector();
    document.querySelectorAll(".layer").forEach((el) => {
      el.classList.toggle("selected", el.dataset.id === id);
    });
  }

  function addText(text, kind = "heading") {
    snapshot();
    const isHeading = kind === "heading";
    const obj = {
      id: uid(),
      type: "text",
      text,
      x: Math.round(state.width * 0.1),
      y: Math.round(state.height * (isHeading ? 0.16 : 0.55)),
      width: Math.round(state.width * 0.8),
      fontSize: isHeading ? Math.round(state.width * 0.075) : Math.round(state.width * 0.028),
      color: state.brand.primary,
      fontFamily: isHeading ? state.brand.font : "Arial, sans-serif",
      fontWeight: isHeading ? 800 : 500,
      textAlign: isHeading ? "center" : "left",
      opacity: 1
    };
    state.objects.push(obj);
    state.selectedId = obj.id;
    render();
  }

  function addImage(dataUrl, naturalWidth, naturalHeight) {
    snapshot();
    const maxW = state.width * 0.62;
    const width = Math.min(maxW, naturalWidth || maxW);
    const ratio = naturalHeight && naturalWidth ? naturalHeight / naturalWidth : 1;
    const obj = {
      id: uid(),
      type: "image",
      src: dataUrl,
      x: Math.round((state.width - width) / 2),
      y: Math.round(state.height * 0.22),
      width: Math.round(width),
      height: Math.round(width * ratio),
      opacity: 1
    };
    state.objects.push(obj);
    state.selectedId = obj.id;
    render();
  }

  function blankCanvas(width, height, background = "#f6f2e8") {
    snapshot();
    state.width = width;
    state.height = height;
    state.background = background;
    state.objects = [];
    state.selectedId = null;
    render();
  }

  function applyTemplate(name) {
    snapshot();
    state.objects = [];
    state.selectedId = null;

    if (name === "social") {
      state.width = 1080; state.height = 1080; state.background = "#111111";
      state.objects.push(
        { id: uid(), type: "text", text: "MAKE IT\nUNMISSABLE.", x: 86, y: 120, width: 910, fontSize: 112, color: "#ffffff", fontFamily: state.brand.font, fontWeight: 900, textAlign: "left", opacity: 1 },
        { id: uid(), type: "text", text: "YOUR BRAND · YOUR STORY · YOUR WAY", x: 90, y: 820, width: 860, fontSize: 34, color: state.brand.accent, fontFamily: "Arial, sans-serif", fontWeight: 700, textAlign: "left", opacity: 1 }
      );
    } else if (name === "flyer") {
      state.width = 1080; state.height = 1350; state.background = "#f3efe5";
      state.objects.push(
        { id: uid(), type: "text", text: state.brand.name, x: 86, y: 90, width: 900, fontSize: 42, color: state.brand.primary, fontFamily: state.brand.font, fontWeight: 900, textAlign: "left", opacity: 1 },
        { id: uid(), type: "text", text: "CREATE\nWITHOUT\nLIMITS", x: 86, y: 265, width: 900, fontSize: 132, color: state.brand.primary, fontFamily: state.brand.font, fontWeight: 900, textAlign: "left", opacity: 1 },
        { id: uid(), type: "text", text: "Design · Brand · Publish", x: 90, y: 1120, width: 760, fontSize: 38, color: state.brand.primary, fontFamily: "Arial, sans-serif", fontWeight: 600, textAlign: "left", opacity: 1 }
      );
    } else if (name === "merch") {
      state.width = 1600; state.height = 1600; state.background = "#d6ff45";
      state.objects.push(
        { id: uid(), type: "text", text: "ORIGINAL\nBY DESIGN", x: 120, y: 420, width: 1360, fontSize: 185, color: "#111111", fontFamily: state.brand.font, fontWeight: 900, textAlign: "center", opacity: 1 },
        { id: uid(), type: "text", text: state.brand.name + " CREATIVE", x: 120, y: 1120, width: 1360, fontSize: 54, color: "#111111", fontFamily: "Arial, sans-serif", fontWeight: 800, textAlign: "center", opacity: 1 }
      );
    } else {
      state.width = 1600; state.height = 900; state.background = "#111111";
      state.objects.push(
        { id: uid(), type: "text", text: "BIG IDEA.\nCLEAR STORY.", x: 110, y: 170, width: 1380, fontSize: 138, color: "#ffffff", fontFamily: state.brand.font, fontWeight: 900, textAlign: "left", opacity: 1 },
        { id: uid(), type: "text", text: "A presentation built in IZAKHONO Creative Suite", x: 115, y: 690, width: 1200, fontSize: 34, color: state.brand.accent, fontFamily: "Arial, sans-serif", fontWeight: 650, textAlign: "left", opacity: 1 }
      );
    }

    render();
    announce("Template loaded");
  }

  function render() {
    artboard.innerHTML = "";
    artboard.style.background = state.background;
    artboard.style.aspectRatio = state.width + " / " + state.height;
    canvasSizeLabel.textContent = state.width + " × " + state.height;
    $("backgroundColor").value = state.background;

    const scale = artboard.clientWidth ? artboard.clientWidth / state.width : 0.7;

    state.objects.forEach((obj) => {
      const el = document.createElement("div");
      el.className = "layer " + obj.type + (obj.id === state.selectedId ? " selected" : "");
      el.dataset.id = obj.id;
      el.style.left = (obj.x / state.width * 100) + "%";
      el.style.top = (obj.y / state.height * 100) + "%";
      el.style.width = (obj.width / state.width * 100) + "%";
      el.style.opacity = obj.opacity ?? 1;

      if (obj.type === "text") {
        el.textContent = obj.text;
        el.style.fontSize = Math.max(9, obj.fontSize * scale) + "px";
        el.style.color = obj.color;
        el.style.fontFamily = obj.fontFamily;
        el.style.fontWeight = obj.fontWeight;
        el.style.textAlign = obj.textAlign;
      } else if (obj.type === "image") {
        el.style.height = (obj.height / state.height * 100) + "%";
        const img = document.createElement("img");
        img.src = obj.src;
        img.alt = "Uploaded design asset";
        img.style.height = "100%";
        img.style.objectFit = "contain";
        el.appendChild(img);
      }

      el.addEventListener("pointerdown", startDrag);
      artboard.appendChild(el);
    });

    renderInspector();
  }

  function renderInspector() {
    const obj = selected();
    $("emptyInspector").hidden = !!obj;
    $("layerInspector").hidden = !obj;

    if (!obj) {
      $("textContent").value = "";
      return;
    }

    $("posX").value = Math.round(obj.x);
    $("posY").value = Math.round(obj.y);
    $("layerWidth").value = Math.round(obj.width);
    $("layerOpacity").value = obj.opacity ?? 1;

    if (obj.type === "text") {
      $("textContent").value = obj.text;
      $("fontSize").value = obj.fontSize;
      $("textColor").value = obj.color;
    } else {
      $("textContent").value = "";
    }
  }

  function startDrag(event) {
    const id = event.currentTarget.dataset.id;
    setSelected(id);
    const obj = selected();
    if (!obj) return;

    const scaleX = state.width / artboard.clientWidth;
    const scaleY = state.height / artboard.clientHeight;

    drag = {
      id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: obj.x,
      startY: obj.y,
      scaleX,
      scaleY,
      moved: false
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  window.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const obj = state.objects.find((o) => o.id === drag.id);
    if (!obj) return;

    const dx = (event.clientX - drag.startClientX) * drag.scaleX;
    const dy = (event.clientY - drag.startClientY) * drag.scaleY;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) drag.moved = true;

    const maxX = Math.max(0, state.width - obj.width);
    const approxHeight = obj.height || obj.fontSize * 2.5;
    const maxY = Math.max(0, state.height - approxHeight);

    obj.x = Math.max(0, Math.min(maxX, drag.startX + dx));
    obj.y = Math.max(0, Math.min(maxY, drag.startY + dy));
    render();
  });

  window.addEventListener("pointerup", () => {
    if (!drag) return;
    if (drag.moved) {
      const current = JSON.stringify(state);
      const obj = state.objects.find((o) => o.id === drag.id);
      if (obj) {
        obj.x = drag.startX;
        obj.y = drag.startY;
        history.push(JSON.stringify(state));
        if (history.length > 60) history.shift();
        state = JSON.parse(current);
      }
      future = [];
      render();
    }
    drag = null;
  });

  function updateSelected(mutator, message = "Layer updated") {
    const obj = selected();
    if (!obj) return;
    snapshot();
    mutator(obj);
    render();
    announce(message);
  }

  async function exportPng() {
    const canvas = document.createElement("canvas");
    canvas.width = state.width;
    canvas.height = state.height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = state.background;
    ctx.fillRect(0, 0, state.width, state.height);

    for (const obj of state.objects) {
      ctx.save();
      ctx.globalAlpha = obj.opacity ?? 1;

      if (obj.type === "text") {
        ctx.fillStyle = obj.color;
        ctx.textBaseline = "top";
        ctx.font = (obj.fontWeight || 500) + " " + obj.fontSize + "px " + obj.fontFamily;
        ctx.textAlign = obj.textAlign === "center" ? "center" : "left";
        const x = obj.textAlign === "center" ? obj.x + obj.width / 2 : obj.x;
        const lines = String(obj.text).split("\n");
        lines.forEach((line, index) => {
          ctx.fillText(line, x, obj.y + index * obj.fontSize * 1.08, obj.width);
        });
      } else if (obj.type === "image") {
        const img = await loadImage(obj.src);
        ctx.drawImage(img, obj.x, obj.y, obj.width, obj.height);
      }

      ctx.restore();
    }

    const a = document.createElement("a");
    a.download = "izakhono-creative-" + Date.now() + ".png";
    a.href = canvas.toDataURL("image/png", 1);
    a.click();
    announce("PNG exported");
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function saveLocal() {
    localStorage.setItem("izakhono-creative-suite-v1", JSON.stringify(state));
    announce("Saved locally on this device");
  }

  function loadLocal() {
    const raw = localStorage.getItem("izakhono-creative-suite-v1");
    if (!raw) return false;
    try {
      state = JSON.parse(raw);
      announce("Recovered local design");
      return true;
    } catch {
      return false;
    }
  }

  function applyBrand() {
    snapshot();
    state.brand.name = $("brandName").value.trim() || "IZAKHONO";
    state.brand.primary = $("brandPrimary").value;
    state.brand.accent = $("brandAccent").value;
    state.brand.font = $("brandFont").value;
    state.objects.forEach((obj, index) => {
      if (obj.type !== "text") return;
      if (index === 0) {
        obj.fontFamily = state.brand.font;
        obj.color = state.brand.primary;
      }
    });
    render();
    announce("Brand kit applied");
  }

  function runLocalCommand() {
    const raw = $("commandInput").value.trim();
    const command = raw.toLowerCase();
    if (!command) return;

    if (command.includes("black background")) {
      snapshot(); state.background = "#111111"; render(); announce("Background set to black"); return;
    }
    if (command.includes("white background")) {
      snapshot(); state.background = "#ffffff"; render(); announce("Background set to white"); return;
    }

    const hex = raw.match(/background\s+(#[0-9a-fA-F]{6})/);
    if (hex) {
      snapshot(); state.background = hex[1]; render(); announce("Background updated"); return;
    }

    const heading = raw.match(/add heading\s+(.+)/i);
    if (heading) {
      addText(heading[1], "heading"); announce("Heading added"); return;
    }

    if (command.includes("make text white")) {
      snapshot();
      const obj = selected();
      (obj && obj.type === "text" ? [obj] : state.objects.filter((o) => o.type === "text")).forEach((o) => o.color = "#ffffff");
      render(); announce("Text set to white"); return;
    }

    if (command.includes("make text black")) {
      snapshot();
      const obj = selected();
      (obj && obj.type === "text" ? [obj] : state.objects.filter((o) => o.type === "text")).forEach((o) => o.color = "#111111");
      render(); announce("Text set to black"); return;
    }

    if (command.includes("square") || command.includes("social post")) {
      blankCanvas(1080, 1080, state.background); announce("Square canvas ready"); return;
    }

    if (command.includes("story")) {
      blankCanvas(1080, 1920, state.background); announce("Story canvas ready"); return;
    }

    if (command.includes("presentation") || command.includes("slide")) {
      blankCanvas(1600, 900, state.background); announce("Presentation canvas ready"); return;
    }

    if (command.includes("poster")) {
      applyTemplate("social"); announce("Starter poster created"); return;
    }

    announce("Command not recognized yet — use the supported examples");
  }

  document.querySelectorAll(".rail-tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".rail-tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".panel-page").forEach((p) => p.classList.remove("active"));
      button.classList.add("active");
      document.querySelector('[data-page="' + button.dataset.panel + '"]').classList.add("active");
    });
  });

  document.querySelectorAll(".template-card").forEach((button) => {
    button.addEventListener("click", () => applyTemplate(button.dataset.template));
  });

  $("addHeadingBtn").addEventListener("click", () => addText("YOUR HEADLINE", "heading"));
  $("addBodyBtn").addEventListener("click", () => addText("Add your message here.", "body"));
  $("undoBtn").addEventListener("click", undo);
  $("redoBtn").addEventListener("click", redo);
  $("saveBtn").addEventListener("click", saveLocal);
  $("exportBtn").addEventListener("click", exportPng);
  $("applyBrandBtn").addEventListener("click", applyBrand);
  $("runCommandBtn").addEventListener("click", runLocalCommand);

  $("backgroundColor").addEventListener("change", (event) => {
    snapshot(); state.background = event.target.value; render(); announce("Background updated");
  });

  $("imageUpload").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => addImage(String(reader.result), img.naturalWidth, img.naturalHeight);
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  });

  $("textContent").addEventListener("change", (event) => {
    updateSelected((obj) => { if (obj.type === "text") obj.text = event.target.value; });
  });

  $("fontSize").addEventListener("change", (event) => {
    updateSelected((obj) => { if (obj.type === "text") obj.fontSize = Number(event.target.value); });
  });

  $("textColor").addEventListener("change", (event) => {
    updateSelected((obj) => { if (obj.type === "text") obj.color = event.target.value; });
  });

  $("boldBtn").addEventListener("click", () => {
    updateSelected((obj) => { if (obj.type === "text") obj.fontWeight = Number(obj.fontWeight) >= 800 ? 500 : 900; });
  });

  $("centerBtn").addEventListener("click", () => {
    updateSelected((obj) => { if (obj.type === "text") obj.textAlign = obj.textAlign === "center" ? "left" : "center"; });
  });

  $("posX").addEventListener("change", (event) => updateSelected((obj) => obj.x = Math.max(0, Number(event.target.value))));
  $("posY").addEventListener("change", (event) => updateSelected((obj) => obj.y = Math.max(0, Number(event.target.value))));
  $("layerWidth").addEventListener("change", (event) => updateSelected((obj) => {
    const old = obj.width;
    obj.width = Math.max(20, Number(event.target.value));
    if (obj.type === "image" && obj.height) obj.height = obj.height * (obj.width / old);
  }));
  $("layerOpacity").addEventListener("change", (event) => updateSelected((obj) => obj.opacity = Number(event.target.value)));

  $("duplicateBtn").addEventListener("click", () => {
    const obj = selected();
    if (!obj) return;
    snapshot();
    const copy = structuredClone(obj);
    copy.id = uid();
    copy.x += 28; copy.y += 28;
    state.objects.push(copy);
    state.selectedId = copy.id;
    render();
    announce("Layer duplicated");
  });

  $("deleteBtn").addEventListener("click", () => {
    const obj = selected();
    if (!obj) return;
    snapshot();
    state.objects = state.objects.filter((o) => o.id !== obj.id);
    state.selectedId = null;
    render();
    announce("Layer deleted");
  });

  artboard.addEventListener("pointerdown", (event) => {
    if (event.target === artboard) setSelected(null);
  });

  artboard.addEventListener("keydown", (event) => {
    if ((event.key === "Delete" || event.key === "Backspace") && selected()) {
      event.preventDefault();
      $("deleteBtn").click();
    }
  });

  window.addEventListener("resize", render);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }

  if (!loadLocal()) {
    applyTemplate("social");
    history = [];
    future = [];
    announce("Ready · no telemetry");
  } else {
    render();
  }
})();