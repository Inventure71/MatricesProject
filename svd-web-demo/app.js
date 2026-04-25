let targetUserIndex = 9;
const factorOptions = [1, 2, 3, 4, 5, 6];
function getInitialFactorCount() {
  const requested = Number(new URLSearchParams(window.location.search).get("k"));
  return factorOptions.includes(requested) ? requested : 2;
}

let factorCount = getInitialFactorCount();
const energyTargetCount = 5;
const enoughFactorCount = 6;
const focusUserIndices = [0, 1, 4, 6, 9];
const focusMovieIndices = [0, 1, 2, 3, 4, 5, 7, 10, 11];
const baselineExample = { row: 9, column: 0 };
const predictionExample = { row: 9, column: 5 };
const defaultTargetRatings = [...ratings[targetUserIndex]];

function categoryClassName(category) {
  return `category-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function movieHeaderHTML(movieIndex) {
  const category = movieCategories[movieIndex];
  return `
    <div class="cell movie-header ${categoryClassName(category)}">
      <span>
        <b>${category}</b>
        <em>${movies[movieIndex]}</em>
      </span>
    </div>
  `;
}

function userHeaderHTML(rowIndex, isTargetRow) {
  const classNames = ["cell", "user-header"];
  if (isTargetRow) classNames.push("target-user-cell", "target-user-header");

  return `
    <div class="${classNames.join(" ")}">
      <span>
        <b>${users[rowIndex]}</b>
        <em>${userSegments[rowIndex]}</em>
      </span>
    </div>
  `;
}
const mapView = { scale: 1, x: 0, y: 0 };

function targetLastUserIndices() {
  return users.map((_, index) => index).filter((index) => index !== targetUserIndex).concat(targetUserIndex);
}

const els = {
  workspace: document.querySelector(".workspace"),
  visualPlane: document.querySelector("#visualPlane"),
  inspector: document.querySelector("#inspector"),
  stepCount: document.querySelector("#stepCount"),
  stepTitle: document.querySelector("#stepTitle"),
  stepText: document.querySelector("#stepText"),
  stageNote: document.querySelector("#stageNote"),
  stageNoteTitle: document.querySelector("#stageNoteTitle"),
  stageNoteText: document.querySelector("#stageNoteText"),
  inspectorTitle: document.querySelector("#inspectorTitle"),
  inspectorText: document.querySelector("#inspectorText"),
  stepRail: document.querySelector("#stepRail"),
  totalCells: document.querySelector("#totalCells"),
  knownRatings: document.querySelector("#knownRatings"),
  sparsity: document.querySelector("#sparsity"),
  previousStep: document.querySelector("#previousStep"),
  nextStep: document.querySelector("#nextStep"),
  playPause: document.querySelector("#playPause"),
  playLabel: document.querySelector("#playLabel"),
  kControl: document.querySelector("#kControl"),
  tabs: [],
};

const sparseStepIndex = 2;

function computeModel() {
  return computeSvdRecommendationModel({
    ratings,
    movies,
    factorCount,
    targetUserIndex,
    energyTargetCount,
    enoughFactorCount,
  });
}

let model = computeModel();
let totalCells = 0;
let knownRatings = 0;
let sparsity = 0;

function refreshMetrics() {
  totalCells = users.length * movies.length;
  knownRatings = model.sparseEntries.length;
  sparsity = (totalCells - knownRatings) / totalCells;

  els.totalCells.textContent = totalCells;
  els.knownRatings.textContent = knownRatings;
  els.sparsity.textContent = `${(sparsity * 100).toFixed(1)}%`;
}

function format(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : "";
}

function signedFormat(value, digits = 2) {
  if (!Number.isFinite(value)) return "";
  return `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(digits)}`;
}

function heatColor(value, min, max, positive = true) {
  const range = max - min || 1;
  const normalized = Math.max(0, Math.min(1, (value - min) / range));
  const hue = positive ? 174 : 17;
  const saturation = 60;
  const lightness = 80 - normalized * 38;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function matrixHTML({
  title,
  note,
  values,
  mode = "ratings",
  highlightMissingForUser = false,
  highlightTargetRow = false,
  embedded = false,
  showImplicitZeros = false,
  rowIndices = users.map((_, index) => index),
  movieIndices = movies.map((_, index) => index),
}) {
  const selectedValues = rowIndices.flatMap((rowIndex) =>
    movieIndices.map((columnIndex) => values[rowIndex][columnIndex])
  );
  const flatNumbers = selectedValues.filter((value) => value !== null && Number.isFinite(value));
  const min = Math.min(...flatNumbers);
  const max = Math.max(...flatNumbers);
  const isWideMatrix = movieIndices.length > 12;
  const columns = isWideMatrix
    ? `66px repeat(${movieIndices.length}, minmax(38px, 1fr))`
    : `90px repeat(${movieIndices.length}, minmax(72px, 1fr))`;

  const header = [
    `<div class="cell"><span></span></div>`,
    ...movieIndices.map((movieIndex) => movieHeaderHTML(movieIndex)),
  ].join("");

  const body = values
    .filter((_, rowIndex) => rowIndices.includes(rowIndex))
    .map((row, filteredRowIndex) => {
      const rowIndex = rowIndices[filteredRowIndex];
      const isTargetRow = highlightTargetRow && rowIndex === targetUserIndex;
      const rowHeader = userHeaderHTML(rowIndex, isTargetRow);
      const cells = movieIndices
        .map((columnIndex) => {
          const value = row[columnIndex];
          const isMissing = ratings[rowIndex][columnIndex] === null;
          const isRecommendation =
            highlightMissingForUser && rowIndex === targetUserIndex && isMissing;
          const classNames = ["cell", categoryClassName(movieCategories[columnIndex])];
          if (isTargetRow) classNames.push("target-user-cell");
          let text = "";
          let style = "";

          if (value === null) {
            if (showImplicitZeros) {
              classNames.push("implicit-zero");
              text = "0*";
            } else {
              classNames.push("missing");
              text = "blank";
            }
          } else {
            text = mode === "residuals" ? format(value, 2) : format(value, 1);
            if (mode === "residuals") {
              classNames.push(value >= 0 ? "residual-positive" : "residual-negative");
              style = `--cell-opacity:${Math.min(0.78, Math.abs(value) / 3 + 0.16)};`;
            } else {
              classNames.push("known");
              style = `--cell-color:${heatColor(value, min, max)};--cell-opacity:0.86;`;
            }
          }

          if (isRecommendation) classNames.push("recommendation");

          return `<div class="${classNames.join(" ")}" style="${style}"><span>${text}</span></div>`;
        })
        .join("");
      return rowHeader + cells;
    })
    .join("");

  return `
    <div class="matrix-wrap${embedded ? " embedded" : ""}${isWideMatrix ? " wide" : ""}">
      <div class="matrix-title">
        <strong>${title}</strong>
        <span>${note}</span>
      </div>
      <div class="matrix-grid" style="grid-template-columns:${columns}">
        ${header}
        ${body}
      </div>
    </div>
  `;
}

function ratingEditorHTML() {
  const controls = movies
    .map((movie, columnIndex) => {
      const currentRating = ratings[targetUserIndex][columnIndex];
      const ratingButtons = [1, 2, 3, 4, 5]
        .map((rating) => {
          const isActive = currentRating === rating;
          return `
            <button
              class="rating-choice${isActive ? " is-active" : ""}"
              type="button"
              data-rating-column="${columnIndex}"
              data-rating-value="${rating}"
              aria-pressed="${isActive}"
              aria-label="Set ${movie} rating to ${rating}"
            >${rating}</button>
          `;
        })
        .join("");
      const isUnrated = currentRating === null;

      return `
        <div class="rating-control">
          <span class="rating-movie">${movie}</span>
          <div class="rating-options" aria-label="${movie} rating">
            ${ratingButtons}
            <button
              class="rating-clear${isUnrated ? " is-active" : ""}"
              type="button"
              data-rating-column="${columnIndex}"
              data-clear-rating="true"
              aria-pressed="${isUnrated}"
              aria-label="Clear ${movie} rating"
              title="Clear rating"
            >Clear</button>
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <section class="rating-editor" aria-label="Your editable movie ratings">
      <div class="rating-editor-head">
        <div>
          <strong>Your ratings</strong>
          <span>Clear means unrated, so the movie can be recommended again.</span>
        </div>
        <button class="reset-ratings" type="button" data-reset-ratings="true">Reset</button>
      </div>
      <div class="rating-grid">${controls}</div>
    </section>
  `;
}

function recomputeModel() {
  model = computeModel();
  refreshMetrics();
}

function kControlHTML() {
  return `
    <span class="k-label">k</span>
    ${factorOptions
      .map(
        (value) => `
          <button
            class="k-choice${value === factorCount ? " is-active" : ""}"
            type="button"
            data-k-value="${value}"
            aria-pressed="${value === factorCount}"
            aria-label="Use k equals ${value}"
          >${value}</button>
        `
      )
      .join("")}
  `;
}

function renderKControl() {
  els.kControl.innerHTML = kControlHTML();
  els.kControl.querySelectorAll("[data-k-value]").forEach((button) => {
    button.addEventListener("click", () => {
      setPlaying(false);
      setFactorCount(Number(button.dataset.kValue));
    });
  });
}

function setFactorCount(nextFactorCount) {
  factorCount = nextFactorCount;
  recomputeModel();
  renderKControl();
  renderStep(currentStep);

  const params = new URLSearchParams(window.location.search);
  params.set("k", String(factorCount));
  params.set("step", String(currentStep));
  window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
}

function updateTargetRating(columnIndex, value) {
  ratings[targetUserIndex][columnIndex] = value;
  recomputeModel();
  renderStep(currentStep);
}

function resetTargetRatings() {
  ratings[targetUserIndex] = [...defaultTargetRatings];
  recomputeModel();
  renderStep(currentStep);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function updateMapView(nextView) {
  mapView.scale = clamp(nextView.scale ?? mapView.scale, 0.65, 7);
  mapView.x = clamp(nextView.x ?? mapView.x, -900, 900);
  mapView.y = clamp(nextView.y ?? mapView.y, -680, 680);
}

function applyMapView(mapElement) {
  if (!mapElement) return;
  const zoomValue = mapElement.closest(".preference-map-scene")?.querySelector("[data-map-zoom-value]");
  const centerX = mapElement.clientWidth / 2;
  const centerY = mapElement.clientHeight / 2;

  mapElement.querySelectorAll("[data-map-base-x]").forEach((element) => {
    const baseX = (Number(element.dataset.mapBaseX) / 100) * mapElement.clientWidth;
    const baseY = (Number(element.dataset.mapBaseY) / 100) * mapElement.clientHeight;
    const x = centerX + (baseX - centerX) * mapView.scale + mapView.x;
    const y = centerY + (baseY - centerY) * mapView.scale + mapView.y;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  });

  mapElement.style.setProperty("--map-scale", mapView.scale);
  mapElement.style.setProperty("--map-pan-x", `${mapView.x}px`);
  mapElement.style.setProperty("--map-pan-y", `${mapView.y}px`);
  if (zoomValue) zoomValue.textContent = `${Math.round(mapView.scale * 100)}%`;
}

function bindPreferenceMap() {
  const mapElement = els.visualPlane.querySelector(".preference-map");
  if (!mapElement) return;

  applyMapView(mapElement);

  els.visualPlane.querySelectorAll("[data-map-zoom]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.mapZoom;
      if (action === "reset") {
        updateMapView({ scale: 1, x: 0, y: 0 });
      } else {
        const direction = action === "in" ? 1 : -1;
        updateMapView({ scale: mapView.scale + direction * 0.5 });
      }
      applyMapView(mapElement);
    });
  });

  mapElement.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const direction = event.deltaY < 0 ? 1 : -1;
      updateMapView({ scale: mapView.scale + direction * 0.28 });
      applyMapView(mapElement);
    },
    { passive: false }
  );

  let dragStart = null;
  mapElement.addEventListener("pointerdown", (event) => {
    dragStart = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      viewX: mapView.x,
      viewY: mapView.y,
    };
    mapElement.classList.add("is-dragging");
    mapElement.setPointerCapture(event.pointerId);
  });

  mapElement.addEventListener("pointermove", (event) => {
    if (!dragStart || event.pointerId !== dragStart.pointerId) return;
    updateMapView({
      x: dragStart.viewX + event.clientX - dragStart.x,
      y: dragStart.viewY + event.clientY - dragStart.y,
    });
    applyMapView(mapElement);
  });

  const stopDragging = (event) => {
    if (!dragStart || event.pointerId !== dragStart.pointerId) return;
    dragStart = null;
    mapElement.classList.remove("is-dragging");
  };
  mapElement.addEventListener("pointerup", stopDragging);
  mapElement.addEventListener("pointercancel", stopDragging);
}

function bindRatingEditor() {
  els.visualPlane.querySelectorAll("[data-rating-value]").forEach((button) => {
    button.addEventListener("click", () => {
      setPlaying(false);
      updateTargetRating(Number(button.dataset.ratingColumn), Number(button.dataset.ratingValue));
    });
  });

  els.visualPlane.querySelectorAll("[data-clear-rating]").forEach((button) => {
    button.addEventListener("click", () => {
      setPlaying(false);
      updateTargetRating(Number(button.dataset.ratingColumn), null);
    });
  });

  els.visualPlane.querySelectorAll("[data-reset-ratings]").forEach((button) => {
    button.addEventListener("click", () => {
      setPlaying(false);
      resetTargetRatings();
    });
  });

  els.visualPlane.querySelectorAll("[data-map-k]").forEach((button) => {
    button.addEventListener("click", () => {
      setPlaying(false);
      setFactorCount(Number(button.dataset.mapK));
    });
  });

  bindPreferenceMap();
}

function infoPreviewHTML({ label, title, body }) {
  return `
    <span class="info-preview">
      <button class="info-button" type="button" aria-label="${label}">i</button>
      <span class="preview-popover" role="tooltip">
        <span class="preview-title">${title}</span>
        ${body}
      </span>
    </span>
  `;
}

function residualMatrixPreviewHTML() {
  const rowIndices = focusUserIndices.slice(0, 4);
  const movieIndices = focusMovieIndices.slice(0, 5);
  const columns = `86px repeat(${movieIndices.length}, minmax(48px, 1fr))`;
  const header = [
    `<span class="mini-matrix-cell is-empty"></span>`,
    ...movieIndices.map((columnIndex) => `<span class="mini-matrix-cell is-header">${movies[columnIndex]}</span>`),
  ].join("");
  const body = rowIndices
    .map((rowIndex) => {
      const cells = movieIndices
        .map((columnIndex) => {
          const value = ratings[rowIndex][columnIndex] === null ? null : model.residualMatrix[rowIndex][columnIndex];
          return `<span class="mini-matrix-cell ${value === null ? "is-implicit" : ""}">${value === null ? "0*" : format(value, 2)}</span>`;
        })
        .join("");
      return `<span class="mini-matrix-cell is-header">${users[rowIndex]}</span>${cells}`;
    })
    .join("");

  return `
    <span class="mini-matrix-preview" style="grid-template-columns:${columns}">
      ${header}
      ${body}
    </span>
  `;
}

function residualVectorPreviewHTML({ axis, index }) {
  const entries =
    axis === "row"
      ? focusMovieIndices.map((movieIndex) => ({
          label: movies[movieIndex],
          value: ratings[index][movieIndex] === null ? null : model.residualMatrix[index][movieIndex],
        }))
      : focusUserIndices.map((userIndex) => ({
          label: users[userIndex],
          value: ratings[userIndex][index] === null ? null : model.residualMatrix[userIndex][index],
        }));

  return `
    <span class="vector-preview">
      ${entries
        .map(
          (entry) => `
            <span>${entry.label}</span>
            <strong class="${entry.value === null ? "is-implicit" : ""}">${entry.value === null ? "0*" : format(entry.value, 2)}</strong>
          `
        )
        .join("")}
    </span>
  `;
}

function coordinatePreviewHTML() {
  const { row, column } = predictionExample;
  const userVector = model.userFactors[row];
  const movieVector = model.movieFactors.map((factorRow) => factorRow[column]);
  const columns = `96px repeat(${factorCount}, minmax(82px, 1fr))`;

  return `
    <span class="coordinate-preview" style="grid-template-columns:${columns}">
      <span></span>
      ${userVector.map((_, index) => `<strong>Factor ${index + 1}</strong>`).join("")}
      <span>${users[row]}</span>
      ${userVector.map((value) => `<b>${format(value, 2)}</b>`).join("")}
      <span>${movies[column]}</span>
      ${movieVector.map((value) => `<b>${format(value, 2)}</b>`).join("")}
    </span>
  `;
}

function hiddenFactorsPreviewHTML() {
  return `
    <span class="hidden-factor-preview">
      ${model.singularValues
        .map(
          (value, index) => `
            <span>Factor ${index + 1}</span>
            <strong>${format(value, 2)}</strong>
            <em>${index === 0 ? "strongest direction in A" : "next strongest direction in A"}</em>
          `
        )
        .join("")}
    </span>
  `;
}

function factorCalculationHTML() {
  const topRows = model.componentEnergy.slice(0, factorCount);
  const formulaRows = topRows
    .map(
      (item) => `
        <div class="factor-source-row${item.component <= factorCount ? " is-kept" : ""}">
          <span>Factor ${item.component}</span>
          <strong>${format(item.singularValue, 2)}</strong>
          <em>${format(item.energy, 2)}</em>
          <b>${format(item.cumulativeShare * 100, 1)}%</b>
        </div>
      `
    )
    .join("");

  return `
    <div class="factor-source-scene">
      <div class="factor-source-panel">
        <div class="matrix-title">
          <strong>How one factor is found</strong>
          ${sourcePillHTML({
            label: "source A",
            title: "A is the residual matrix",
            body: residualMatrixPreviewHTML(),
          })}
        </div>
        <div class="factor-flow">
          <div>
            <span>1</span>
            <strong>Start from A</strong>
            <p>A is the sparse residual matrix: known rating minus movie average.</p>
          </div>
          <div>
            <span>2</span>
            <strong>Build A<sup>T</sup>A</strong>
            <p>This compares movie columns with movie columns, so similar rating-deviation patterns line up.</p>
          </div>
          <div>
            <span>3</span>
            <strong>Find eigenvectors</strong>
            <p>Each eigenvector becomes a hidden movie direction. The biggest eigenvalue gives the strongest direction.</p>
          </div>
          <div>
            <span>4</span>
            <strong>Take square roots</strong>
            <p>The singular value is sqrt(eigenvalue). Bigger singular values explain more of A.</p>
          </div>
        </div>
      </div>
      <div class="factor-source-panel">
        <div class="matrix-title">
          <strong>Ranked factor strength</strong>
          <span>energy = singular value squared</span>
        </div>
        <div class="factor-source-table">
          <span>Factor</span>
          <span>Singular value</span>
          <span>Energy</span>
          <span>Cumulative</span>
          ${formulaRows}
        </div>
      </div>
    </div>
  `;
}

function factorCoordinateRowsHTML({ values, description }) {
  return `
    <div class="factor-coordinate-rows">
      ${values
        .map(
          (value, index) => `
            <div>
              <span>Factor ${index + 1}</span>
              <strong>${format(value, 2)}</strong>
              <em>${description(index)}</em>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function sourcePillHTML({ label, title, body }) {
  return `
    <span class="source-pill">
      ${label}
      ${infoPreviewHTML({ label: `Preview ${label}`, title, body })}
    </span>
  `;
}

function sparseMapHTML({ focused = false } = {}) {
  const rowSet = new Set(focused ? focusUserIndices : users.map((_, index) => index));
  const columnSet = new Set(focused ? focusMovieIndices : movies.map((_, index) => index));
  const rowPosition = new Map((focused ? focusUserIndices : users.map((_, index) => index)).map((value, index) => [value, index]));
  const columnPosition = new Map((focused ? focusMovieIndices : movies.map((_, index) => index)).map((value, index) => [value, index]));
  const visibleEntries = model.sparseEntries.filter(
    (entry) => rowSet.has(entry.row) && columnSet.has(entry.column)
  );
  const visibleRows = focused ? focusUserIndices.length : users.length;
  const visibleColumns = focused ? focusMovieIndices.length : movies.length;

  const list = visibleEntries
    .map(
      (entry) =>
        `<div>${users[entry.row]} / ${movies[entry.column]} -> rating ${entry.rating}, residual ${format(entry.residual, 2)}</div>`
    )
    .join("");

  const dots = visibleEntries
    .map((entry, index) => {
      const x = ((columnPosition.get(entry.column) + 0.5) / visibleColumns) * 100;
      const y = ((rowPosition.get(entry.row) + 0.5) / visibleRows) * 100;
      return `<span class="dot" style="left:${x}%;top:${y}%;--delay:${index * 32}ms"></span>`;
    })
    .join("");

  return `
    <div class="sparse-map">
      <div>
        <div class="matrix-title">
          <strong>Only known ratings are stored</strong>
          <span>${visibleEntries.length} visible coordinates; ${knownRatings} used by the calculation</span>
        </div>
        <div class="dot-field" style="background-size:calc(100% / ${visibleColumns}) calc(100% / ${visibleRows})">${dots}</div>
      </div>
      <div class="coordinate-list">${list}</div>
    </div>
  `;
}

function hiddenAxesHTML() {
  const chosenEnergy = model.componentEnergy[factorCount - 1];
  const targetEnergy = model.componentEnergy[energyTargetCount - 1];
  const enoughEnergy = model.componentEnergy[enoughFactorCount - 1];
  const targetSentence =
    factorCount === energyTargetCount
      ? `This is the report-style choice closest to the 80%-90% target for the larger demo dataset.`
      : `For the report-style target range on this larger dataset, k = ${energyTargetCount} is the closest clear choice and preserves ${format(targetEnergy.cumulativeShare * 100, 1)}%.`;
  const energyRows = model.componentEnergy
    .slice(0, Math.min(enoughFactorCount, model.componentEnergy.length))
    .map((item) => {
      const width = `${item.cumulativeShare * 100}%`;
      const label = item.target
        ? "target"
        : item.component === energyTargetCount - 1
          ? "some loss"
          : item.comparison
            ? "small gain"
            : "";
      return `
        <div class="energy-row${item.kept ? " is-kept" : ""}${item.target ? " is-target" : ""}${item.component === energyTargetCount - 1 ? " is-before-target" : ""}${item.comparison ? " is-comparison" : ""}">
          <span>k = ${item.component}</span>
          <strong>${format(item.cumulativeShare * 100, 1)}%</strong>
          <em>${label}</em>
          <div class="energy-bar"><span style="--w:${width}"></span></div>
        </div>
      `;
    })
    .join("");

  const bars = model.singularValues
    .map((value, index) => {
      const width = `${(value / model.singularValues[0]) * 100}%`;
      return `
        <div class="axis-row" style="--delay:${index * 140}ms">
          <span>Hidden factor ${index + 1}</span>
          <strong>${format(value, 2)}</strong>
          <div class="axis-bar"><span style="--w:${width}"></span></div>
        </div>
      `;
    })
    .join("");

  return `
    <div class="svd-origin-scene">
      <div class="origin-panel">
        <div class="matrix-title">
          <strong>Source matrix A</strong>
          ${sourcePillHTML({
            label: "from Step 5",
            title: "A is the sparse residual matrix",
            body: residualMatrixPreviewHTML(),
          })}
        </div>
        <p>The input is not raw star ratings. It is the residual matrix: known rating minus movie average. In this demo matrix, missing entries are left unstored and behave like 0* residuals during the calculation.</p>
      </div>
      <div class="origin-panel">
        <div class="matrix-title">
          <strong>SVD ranks directions</strong>
          ${sourcePillHTML({
            label: "kept factors",
            title: `${factorCount} strongest direction${factorCount === 1 ? "" : "s"}`,
            body: hiddenFactorsPreviewHTML(),
          })}
        </div>
        <p>Like the report, the demo chooses k by energy: square each singular value, add the strongest ones, and compare how much of the residual pattern is preserved.</p>
        <div class="energy-list">${energyRows}</div>
        <p>The current demo is using k = ${factorCount}, preserving ${format(chosenEnergy.cumulativeShare * 100, 1)}% of the residual energy. ${targetSentence} k = ${enoughFactorCount} preserves ${format(enoughEnergy.cumulativeShare * 100, 1)}%, so it adds only ${format((enoughEnergy.cumulativeShare - targetEnergy.cumulativeShare) * 100, 1)} percentage points after k = ${energyTargetCount}.</p>
      </div>
      <div class="axis-list">${bars}</div>
    </div>
  `;
}

function userCoordinatesHTML() {
  const { row } = predictionExample;
  const userCoordinates = model.userFactors[row];
  const userVector = userCoordinates.map((value) => format(value, 2)).join(", ");

  return `
    <div class="coordinate-origin-scene">
      <div class="origin-panel">
        <div class="matrix-title">
          <strong>${users[row]}'s residual row</strong>
          <span>row from A</span>
        </div>
        <p>This row is the source. It says how ${users[row]}'s known ratings differ from each movie's average.</p>
        <div class="inline-source-preview">
          <strong>${users[row]}'s visible residuals</strong>
          ${residualVectorPreviewHTML({ axis: "row", index: row })}
        </div>
      </div>
      <div class="coordinate-arrow">=</div>
      <div class="origin-panel">
        <div class="matrix-title">
          <strong>User coordinates</strong>
          ${sourcePillHTML({
            label: "hidden axes",
            title: "Coordinates use these same factors",
            body: hiddenFactorsPreviewHTML(),
          })}
        </div>
        <p>SVD compares that row with each hidden factor and gives the user one number per factor.</p>
        ${factorCoordinateRowsHTML({
          values: userCoordinates,
          description: (index) => `${users[row]}'s position on hidden factor ${index + 1}`,
        })}
        <span class="factor-label">${users[row]} -> [${userVector}]</span>
      </div>
    </div>
  `;
}

function movieCoordinatesHTML() {
  const { column } = predictionExample;
  const movieCoordinates = model.movieFactors.map((factorRow) => factorRow[column]);
  const movieVector = movieCoordinates.map((value) => format(value, 2)).join(", ");

  return `
    <div class="coordinate-origin-scene">
      <div class="origin-panel">
        <div class="matrix-title">
          <strong>${movies[column]}'s residual column</strong>
          <span>column from A</span>
        </div>
        <p>This column is the source. It says which users rated ${movies[column]} above or below that movie's average.</p>
        <div class="inline-source-preview">
          <strong>${movies[column]}'s visible residuals</strong>
          ${residualVectorPreviewHTML({ axis: "column", index: column })}
        </div>
      </div>
      <div class="coordinate-arrow">=</div>
      <div class="origin-panel">
        <div class="matrix-title">
          <strong>Movie coordinates</strong>
          ${sourcePillHTML({
            label: "same axes",
            title: "Movies use the same hidden factors",
            body: hiddenFactorsPreviewHTML(),
          })}
        </div>
        <p>SVD learns movie coordinates from relationships between movie columns in A<sup>T</sup>A. Those coordinates use the same hidden factors as the users, so the next step can compare matching positions.</p>
        ${factorCoordinateRowsHTML({
          values: movieCoordinates,
          description: (index) => `${movies[column]}'s position on hidden factor ${index + 1}`,
        })}
        <span class="factor-label">${movies[column]} -> [${movieVector}]</span>
      </div>
    </div>
  `;
}

function preferenceMapHTML() {
  if (factorCount !== 2) {
    return `
      <div class="map-switch-scene">
        <div>
          <strong>2D view needs exactly two factors</strong>
          <p>The map uses x = hidden factor 1 and y = hidden factor 2. You are currently using k = ${factorCount}, so the model lives in ${factorCount} dimensions.</p>
        </div>
        <button class="primary-button map-switch-button" type="button" data-map-k="2">Switch to k = 2</button>
      </div>
    `;
  }

  const userPoints = users.map((user, rowIndex) => ({
    type: "user",
    label: user,
    segment: userSegments[rowIndex],
    x: model.userFactors[rowIndex][0],
    y: model.userFactors[rowIndex][1],
    target: rowIndex === targetUserIndex,
  }));
  const moviePoints = movies.map((movie, columnIndex) => ({
    type: "movie",
    label: movie,
    category: movieCategories[columnIndex],
    x: model.movieFactors[0][columnIndex],
    y: model.movieFactors[1][columnIndex],
    target: columnIndex === predictionExample.column,
    columnIndex,
  }));
  const points = [...userPoints, ...moviePoints];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const mapPadding = 0.12;
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  const xScale = (value) => mapPadding * 100 + ((value - xMin) / xRange) * (100 - mapPadding * 200);
  const yScale = (value) => 100 - (mapPadding * 100 + ((value - yMin) / yRange) * (100 - mapPadding * 200));
  const importantMovieIndices = new Set([
    predictionExample.column,
    ...model.recommendations.slice(0, 3).map((item) => movies.indexOf(item.movie)),
  ]);

  const pointHTML = points
    .map((point) => {
      const baseX = xScale(point.x);
      const baseY = yScale(point.y);
      const shouldLabel =
        point.type === "user" ||
        point.target ||
        point.type === "movie" ||
        (point.type === "movie" && importantMovieIndices.has(point.columnIndex));
      const categoryClass =
        point.type === "movie" ? ` ${categoryClassName(point.category)}` : "";
      const title =
        point.type === "movie"
          ? `${point.label} (${point.category}): (${format(point.x, 2)}, ${format(point.y, 2)})`
          : `${point.label} (${point.segment}): (${format(point.x, 2)}, ${format(point.y, 2)})`;
      const labelHTML =
        point.type === "movie"
          ? `<em><b>${point.label}</b><small>${point.category}</small></em>`
          : `<em><b>${point.label}</b><small>${point.segment}</small></em>`;
      return `
        <span
          class="map-point ${point.type}${categoryClass}${point.target ? " is-target" : ""}"
          style="--x:${baseX}%;--y:${baseY}%;"
          data-map-base-x="${baseX}"
          data-map-base-y="${baseY}"
          title="${title}"
        >
          ${shouldLabel ? labelHTML : ""}
        </span>
      `;
    })
    .join("");
  const userGuide = users
    .map(
      (user, index) => `
        <div class="map-user-row${index === targetUserIndex ? " is-you" : ""}">
          <strong>${user}</strong>
          <span>${userSegments[index]}</span>
          <em>${userDescriptions[index]}</em>
        </div>
      `
    )
    .join("");
  const categoryGuide = Object.entries(categoryDescriptions)
    .map(
      ([category, description]) => `
        <div class="map-category-row ${categoryClassName(category)}">
          <b></b>
          <strong>${category}</strong>
          <span>${description}</span>
        </div>
      `
    )
    .join("");

  return `
    <div class="preference-map-scene">
      <div class="map-explainer">
        <strong>Hidden preference space</strong>
        <p>With k = 2, each user and movie has two learned coordinates. Category colors explain the movie labels; point positions still come from SVD.</p>
        <div class="map-legend">
          <span><b class="legend-user"></b> Users</span>
          <span><b class="legend-movie category-sci-fi"></b> Sci-Fi</span>
          <span><b class="legend-movie category-action"></b> Action</span>
          <span><b class="legend-movie category-comedy"></b> Comedy</span>
          <span><b class="legend-movie category-romance"></b> Romance</span>
          <span><b class="legend-you"></b> You</span>
        </div>
        <div class="map-toolbar" aria-label="Map controls">
          <button type="button" data-map-zoom="out" aria-label="Zoom out">-</button>
          <strong data-map-zoom-value>100%</strong>
          <button type="button" data-map-zoom="in" aria-label="Zoom in">+</button>
          <button type="button" data-map-zoom="reset">Reset</button>
        </div>
        <p class="map-hint">Drag the map to move around. Scroll or use + to zoom up to 700% into crowded points.</p>
        <div class="map-guide">
          <strong>User profiles</strong>
          ${userGuide}
        </div>
        <div class="map-guide">
          <strong>Movie columns</strong>
          ${categoryGuide}
        </div>
      </div>
      <div class="preference-map" aria-label="2D hidden preference map">
        <div class="map-layer">
          <span class="map-axis x-axis"></span>
          <span class="map-axis y-axis"></span>
          <span class="axis-label x-label">Hidden factor 1</span>
          <span class="axis-label y-label">Hidden factor 2</span>
        </div>
        ${pointHTML}
      </div>
    </div>
  `;
}

function baselineCalculationHTML() {
  const { row, column } = baselineExample;
  const knownColumnRatings = ratings
    .map((ratingRow, rowIndex) => ({ user: users[rowIndex], rating: ratingRow[column] }))
    .filter((item) => item.rating !== null);
  const average = model.movieAverages[column];
  const rating = ratings[row][column];
  const residual = rating - average;
  const sum = knownColumnRatings.reduce((total, item) => total + item.rating, 0);
  const terms = knownColumnRatings.map((item) => item.rating).join(" + ");

  return `
    <div class="calculation-scene">
      <div class="calc-panel">
        <div class="matrix-title">
          <strong>Follow one known rating</strong>
          <span>${users[row]} rated ${movies[column]} = ${rating}</span>
        </div>
        <div class="formula-stack">
          <div class="formula-line">
            <span>1. Use this movie's known ratings to find its normal score</span>
            <strong>(${terms}) / ${knownColumnRatings.length} = ${format(average, 2)}</strong>
          </div>
          <div class="formula-line">
            <span>2. Convert the raw rating into distance from normal</span>
            <strong>${rating} - ${format(average, 2)} = ${format(residual, 2)}</strong>
          </div>
          <div class="formula-line emphasis">
            <span>3. SVD receives the deviation, not the raw rating</span>
            <strong>${users[row]} is ${format(Math.abs(residual), 2)} ${residual >= 0 ? "above" : "below"} this movie's baseline</strong>
          </div>
        </div>
      </div>
      <div class="column-list">
        ${knownColumnRatings
          .map((item) => `<div><span>${item.user}</span><strong>${item.rating}</strong></div>`)
          .join("")}
      </div>
    </div>
  `;
}

function svdCalculationHTML() {
  const { row, column } = predictionExample;
  const userVector = model.userFactors[row];
  const movieVector = model.movieFactors.map((factorRow) => factorRow[column]);
  const contributions = userVector.map((value, index) => value * movieVector[index]);
  const predictedResidual = contributions.reduce((total, value) => total + value, 0);
  const baseline = model.movieAverages[column];
  const predicted = Math.min(5, Math.max(1, baseline + predictedResidual));

  return `
    <div class="calculation-scene dot-product-scene">
      <div class="calc-panel dot-product-panel">
        <div class="matrix-title">
          <strong>One blank cell</strong>
          <span>
            Predict ${movies[column]} for ${users[row]}
            ${infoPreviewHTML({
              label: "Preview the SVD coordinates from the previous step",
              title: "These coordinates came from Steps 7 and 8",
              body: coordinatePreviewHTML(),
            })}
          </span>
        </div>

        <div class="dot-intro">
          <strong>The selected k factors are hidden taste axes learned by SVD.</strong>
          <span>We did not name them as genres. They are compressed patterns from the residual matrix, and every user and movie gets one coordinate per selected factor.</span>
        </div>

        <div class="factor-compare-grid">
          <div class="factor-heading"></div>
          <div class="factor-heading">${users[row]}</div>
          <div class="factor-heading">${movies[column]}</div>
          <div class="factor-heading">Product</div>
          ${userVector
            .map(
              (userValue, index) => `
                <div class="factor-label-cell">Hidden factor ${index + 1}</div>
                <div class="factor-value">${format(userValue, 2)}</div>
                <div class="factor-value">${format(movieVector[index], 2)}</div>
                <div class="factor-value factor-product">
                  <span>${format(userValue, 2)} x ${format(movieVector[index], 2)}</span>
                  <b>${signedFormat(contributions[index], 2)}</b>
                </div>
              `
            )
            .join("")}
        </div>

        <div class="dot-formula-strip">
          <div>
            <span>1. Multiply matching factors</span>
            <strong>Factor 1 with Factor 1, then repeat through Factor ${factorCount}</strong>
          </div>
          <div>
            <span>2. Add product results</span>
            <strong>${contributions.map((value) => signedFormat(value, 2)).join(" ")} = ${signedFormat(predictedResidual, 2)}</strong>
          </div>
          <div class="is-final">
            <span>3. Add movie average back</span>
            <strong>${format(baseline, 2)} ${signedFormat(predictedResidual, 2)} = ${format(predicted, 2)}</strong>
          </div>
        </div>
      </div>
      <div class="mini-rank dot-summary">
        <strong>Plain meaning</strong>
        <p>Think of each factor as one question SVD invented to explain rating patterns. Changing k changes how many questions the model keeps.</p>
        <div>
          <span>Not a genre label</span>
          <b>The factors do not literally mean sci-fi, romance, or any manual category.</b>
        </div>
        <div>
          <span>Same sign</span>
          <b>Positive product, rating moves up</b>
        </div>
        <div>
          <span>Opposite sign</span>
          <b>Negative product, rating moves down</b>
        </div>
        <div>
          <span>Final role</span>
          <b>The dot product is only the SVD adjustment. The final rating is average plus adjustment.</b>
        </div>
      </div>
    </div>
  `;
}

function recommendationsHTML() {
  const rowCells = model.predictedRatings[targetUserIndex]
    .map((score, columnIndex) => {
      const ratedByYou = ratings[targetUserIndex][columnIndex] !== null;
      const classNames = ["cell", ratedByYou ? "known" : "recommendation"];
      const style = ratedByYou
        ? "--cell-color:hsl(174 45% 72%);--cell-opacity:0.82;"
        : "--cell-color:hsl(43 66% 72%);--cell-opacity:0.9;";
      return `
        <div class="${classNames.join(" ")}" style="${style}">
          <span>${movies[columnIndex]}<br>${format(score, 2)}</span>
        </div>
      `;
    })
    .join("");

  const items = model.recommendations
    .map((item, index) => {
      const width = `${(item.score / 5) * 100}%`;
      return `
        <div class="rank-item" style="--delay:${index * 120}ms">
          <span class="rank-number">${index + 1}</span>
          <strong>${item.movie}</strong>
          <span class="rank-score">${format(item.score, 2)}</span>
          <div class="rank-bar"><span style="--w:${width}"></span></div>
        </div>
      `;
    })
    .join("");

  return `
    <div class="recommend-scene">
      <div class="target-user-panel">
        <div class="matrix-title">
          <strong>${users[targetUserIndex]} predicted ratings</strong>
          <span>gold outline = currently unrated</span>
        </div>
        <div class="target-row">${rowCells}</div>
        ${ratingEditorHTML()}
      </div>
      <div class="rank-list">${items}</div>
    </div>
  `;
}

const steps = [
  {
    tab: "Full Matrix",
    title: "Start with the full rating matrix",
    text: "The highlighted row is you. It starts with sample ratings, and you can edit that row below to see how the recommendations change.",
    inspectorTitle: "Your row",
    inspectorText: "Blank means unrated. Clearing a rating removes it from your known row, so that movie becomes eligible for recommendation again.",
    render: () => `
      <div class="editable-matrix-scene">
        ${matrixHTML({
          title: "Original user-movie ratings",
          note: "highlighted row = editable",
          values: ratings,
          highlightTargetRow: true,
          rowIndices: targetLastUserIndices(),
        })}
        ${ratingEditorHTML()}
      </div>
    `,
  },
  {
    tab: "Focus",
    title: "We crop the view for visualization purposes",
    text: "The calculation still uses the full matrix, but the visualization now focuses on a smaller slice so each step is readable.",
    inspectorTitle: "Display-only crop",
    inspectorText: "This crop includes sci-fi fans, romance fans, and you. It does not change the calculation result.",
    render: () =>
      matrixHTML({
            title: "Focused working view",
            note: "cropped UI; full 10 x 16 matrix still used",
        values: ratings,
        rowIndices: focusUserIndices,
        movieIndices: focusMovieIndices,
      }),
  },
  {
    tab: "Sparse",
    title: "Sparse storage keeps only known ratings",
    text: "The matrix has many blanks, so the sparse representation stores coordinates and values only for ratings that actually exist.",
    inspectorTitle: "Sparse matrix",
    inspectorText: "This is why sparse matrices are useful: the system avoids pretending every user watched every movie.",
    render: () => sparseMapHTML({ focused: true }),
  },
  {
    tab: "Average",
    title: "Compute each movie-average baseline",
    text: "Before SVD, each movie gets a simple baseline: its average known rating. Then every real rating is standardized as rating minus movie average, so 0 means normal for that movie instead of badly rated. This lets SVD learn users' preference trends instead of confusing missing or average ratings with dislike.",
    inspectorTitle: "Baseline idea",
    inspectorText: "The movie average is the starting prediction. SVD works on deviations from that start. Blanks stay unknown here; they are not treated as low ratings.",
    render: baselineCalculationHTML,
  },
  {
    tab: "Residual",
    title: "Build the SVD input matrix",
    text: "Known ratings become residual numbers representing how much the user liked or disliked the movie compared to the movie average. Missing ratings are shown as 0* because they are unstored entries with no known deviation, not real zero-star ratings.",
    inspectorTitle: "SVD input",
    inspectorText: "0* is not a rating. It marks an unstored residual entry in this demo's matrix, so the calculation does not pretend the user gave that movie a low score.",
    render: () =>
      matrixHTML({
        title: "Sparse residual matrix",
        note: `0* = implicit zero residual; known 0.00 = real known residual`,
        values: model.residualMatrix.map((row, rowIndex) =>
          row.map((value, columnIndex) => (ratings[rowIndex][columnIndex] === null ? null : value))
        ),
        mode: "residuals",
        showImplicitZeros: true,
        rowIndices: focusUserIndices,
        movieIndices: focusMovieIndices,
      }),
  },
  {
    tab: "Hidden Axes",
    title: "Choose k by preserved energy",
    text: "Use the k buttons at the top to choose how many hidden factors SVD keeps. The energy table updates with the current choice; k = 5 is the report-style choice near the 80%-90% target, and k = 6 shows the extra gain is small.",
    inspectorTitle: "Why compare k = 5 and k = 6",
    inspectorText: "The top control changes the actual calculation. k = 5 keeps the strongest pattern set near the target range, while k = 6 shows that the next factor adds only a small amount.",
    render: hiddenAxesHTML,
  },
  {
    tab: "Factor Math",
    title: "How factors are calculated",
    text: "SVD does not guess factor names. It builds directions from the residual matrix using A transposed times A, eigenvectors, and singular values.",
    inspectorTitle: "Factor source",
    inspectorText: "Eigenvectors give the hidden directions. Singular values rank those directions by strength. Keeping the first k directions gives the low-rank approximation.",
    render: factorCalculationHTML,
  },
  {
    tab: "User Coords",
    title: "A user row becomes coordinates",
    text: `For ${users[predictionExample.row]}, SVD turns the user's residual row into one coordinate on each hidden factor.`,
    inspectorTitle: "User coordinate source",
    inspectorText: "A user's coordinates come from that user's row in A. The row is compared with the hidden axes found in the previous step.",
    render: userCoordinatesHTML,
  },
  {
    tab: "Movie Coords",
    title: "A movie gets matching coordinates",
    text: `For ${movies[predictionExample.column]}, SVD learns movie coordinates from A transposed times A, so the movie can be placed on the same hidden factors as the users.`,
    inspectorTitle: "Movie coordinate source",
    inspectorText: "A movie's coordinates come from the hidden directions learned from A transposed times A. Users and movies must use the same axes so their matching coordinates can be multiplied.",
    render: movieCoordinatesHTML,
  },
  {
    tab: "2D Map",
    title: "See the hidden preference map",
    text: "When k = 2, the first hidden factor becomes the x-axis and the second hidden factor becomes the y-axis. This lets us draw users and movies as points in the same learned preference space.",
    inspectorTitle: "Why only k = 2",
    inspectorText: "A normal x-y graph can only show two dimensions. Larger k values still work for prediction, but they need more dimensions than a simple flat map can show.",
    render: preferenceMapHTML,
  },
  {
    tab: "Dot Product",
    title: "Compare coordinates with a dot product",
    text: "For one blank cell, SVD compares the user's coordinates and the movie's coordinates on the same hidden factors. The result becomes an adjustment to the movie average.",
    inspectorTitle: "Dot product",
    inspectorText: "A factor is an unnamed pattern learned from the residual matrix. Matching signs increase the prediction; opposite signs decrease it.",
    render: svdCalculationHTML,
  },
  {
    tab: "Predict",
    title: "The matrix is reconstructed as predictions",
    text: "The model reconstructs estimated residuals for every cell, then adds movie averages back to get predicted ratings from 1 to 5.",
    inspectorTitle: "Prediction",
    inspectorText: "The prediction is movie average plus SVD adjustment. This is why missing cells can now receive estimated scores.",
    render: () =>
      matrixHTML({
        title: "Predicted ratings after SVD",
        note: "movie average + reconstructed residual",
        values: model.predictedRatings,
        rowIndices: focusUserIndices,
        movieIndices: focusMovieIndices,
      }),
  },
  {
    tab: "Recommend",
    title: "Recommend the highest unrated movies",
    text: `For ${users[targetUserIndex]}, the system filters out movies already rated and ranks the remaining predictions.`,
    inspectorTitle: "Final rule",
    inspectorText: "Recommendations are not taken from watched movies. They come from the highest predicted scores among cells that are currently blank.",
    render: recommendationsHTML,
  },
];

function getInitialStep() {
  const requested = Number(new URLSearchParams(window.location.search).get("step"));
  return Number.isInteger(requested) && requested >= 0 && requested < steps.length ? requested : 0;
}

let currentStep = getInitialStep();
let playTimer = null;

function renderStepTabs() {
  els.stepRail.innerHTML = steps
    .map(
      (step, index) => `
        <button class="step-tab" type="button" data-step="${index}">
          <span>${String(index + 1).padStart(2, "0")}</span>
          ${step.tab}
        </button>
      `
    )
    .join("");

  els.tabs = [...els.stepRail.querySelectorAll(".step-tab")];
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setPlaying(false);
      renderStep(Number(tab.dataset.step));
    });
  });
}

function renderStep(index) {
  currentStep = (index + steps.length) % steps.length;
  const step = steps[currentStep];
  const showsSparseInspector = currentStep === sparseStepIndex;

  els.stepCount.textContent = `Step ${currentStep + 1} of ${steps.length}`;
  els.stepTitle.textContent = step.title;
  els.stepText.textContent = step.text;
  els.workspace.classList.toggle("has-side-inspector", showsSparseInspector);
  els.inspector.hidden = !showsSparseInspector;
  els.stageNote.hidden = showsSparseInspector;
  els.stageNoteTitle.textContent = step.inspectorTitle;
  els.stageNoteText.textContent = step.inspectorText;
  els.inspectorTitle.textContent = step.inspectorTitle;
  els.inspectorText.textContent = step.inspectorText;
  els.visualPlane.innerHTML = step.render();
  bindRatingEditor();

  els.tabs.forEach((tab) => {
    tab.classList.toggle("is-active", Number(tab.dataset.step) === currentStep);
  });
}

function setPlaying(nextPlaying) {
  if (nextPlaying) {
    els.playLabel.textContent = "Pause";
    playTimer = window.setInterval(() => renderStep(currentStep + 1), 3800);
  } else {
    els.playLabel.textContent = "Play";
    window.clearInterval(playTimer);
    playTimer = null;
  }
}

els.previousStep.addEventListener("click", () => {
  setPlaying(false);
  renderStep(currentStep - 1);
});

els.nextStep.addEventListener("click", () => {
  setPlaying(false);
  renderStep(currentStep + 1);
});

els.playPause.addEventListener("click", () => {
  setPlaying(!playTimer);
});

renderStepTabs();
renderKControl();
refreshMetrics();
renderStep(currentStep);
