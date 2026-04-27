let targetUserIndex = 9;
const factorOptions = [1, 2, 3, 4, 5, 6];
function getInitialFactorCount() {
  const requested = Number(new URLSearchParams(window.location.search).get("k"));
  return factorOptions.includes(requested) ? requested : 2;
}

let factorCount = getInitialFactorCount();
const energyTargetCount = 5;
const enoughFactorCount = 6;
const allUserIndices = users.map((_, index) => index);
const allMovieIndices = movies.map((_, index) => index);
const baselineExample = { row: 9, column: 0 };
const predictionExample = { row: 9, column: 5 };
const defaultTargetRatings = [...ratings[targetUserIndex]];

function categoryClassName(category) {
  return `category-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function userLabelHTML(rowIndex) {
  return rowIndex === targetUserIndex ? `<strong class="target-user-name">You</strong>` : users[rowIndex];
}

function userLabelText(rowIndex) {
  return rowIndex === targetUserIndex ? "You" : users[rowIndex];
}

function targetUserLabelHTML() {
  return userLabelHTML(targetUserIndex);
}

function movieHeaderHTML(movieIndex) {
  const category = movieCategories[movieIndex];
  const movie = movies[movieIndex];
  return `
    <div class="cell movie-header ${categoryClassName(category)}">
      <span>
        <b>${category}</b>
        <em title="${movie}">${movie}</em>
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
        <b>${userLabelHTML(rowIndex)}</b>
        ${rowIndex === targetUserIndex ? "" : `<em>${userSegments[rowIndex]}</em>`}
      </span>
    </div>
  `;
}
const mapView = { scale: 1, x: 0, y: 0 };
const factorLineView = { zoom: 1, dragging: false, startX: 0, startScrollLeft: 0 };
let showClosestUnwatchedMovie = false;
let showMovieLabels = true;

function targetLastUserIndices() {
  return allUserIndices.filter((index) => index !== targetUserIndex).concat(targetUserIndex);
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

const sparseStepIndex = 1;

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
  rowIndices = allUserIndices,
  movieIndices = allMovieIndices,
}) {
  const selectedValues = rowIndices.flatMap((rowIndex) =>
    movieIndices.map((columnIndex) => values[rowIndex][columnIndex])
  );
  const flatNumbers = selectedValues.filter((value) => value !== null && Number.isFinite(value));
  const min = Math.min(...flatNumbers);
  const max = Math.max(...flatNumbers);
  const isWideMatrix = movieIndices.length > 12;
  const columns = isWideMatrix
    ? `66px repeat(${movieIndices.length}, minmax(58px, 1fr))`
    : `90px repeat(${movieIndices.length}, minmax(86px, 1fr))`;

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

function matrixSceneHTML(options) {
  return `<div class="matrix-scene">${matrixHTML(options)}</div>`;
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
      const category = movieCategories[columnIndex];

      return `
        <div class="rating-control">
          <span class="rating-movie">
            <span>${movie}</span>
            <b class="rating-category-tag ${categoryClassName(category)}">${category}</b>
          </span>
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
    <section class="rating-editor" aria-label="Editable movie ratings for You">
      <div class="rating-editor-head">
        <div>
          <strong>Ratings for ${targetUserLabelHTML()}</strong>
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
  const scaledPoint = (basePercentX, basePercentY) => {
    const baseX = (basePercentX / 100) * mapElement.clientWidth;
    const baseY = (basePercentY / 100) * mapElement.clientHeight;
    return {
      x: centerX + (baseX - centerX) * mapView.scale + mapView.x,
      y: centerY + (baseY - centerY) * mapView.scale + mapView.y,
    };
  };

  mapElement.querySelectorAll("[data-map-base-x]").forEach((element) => {
    const point = scaledPoint(Number(element.dataset.mapBaseX), Number(element.dataset.mapBaseY));
    element.style.left = `${point.x}px`;
    element.style.top = `${point.y}px`;
  });

  mapElement.querySelectorAll("[data-closest-link]").forEach((line) => {
    const start = scaledPoint(Number(line.dataset.startX), Number(line.dataset.startY));
    const end = scaledPoint(Number(line.dataset.endX), Number(line.dataset.endY));
    line.setAttribute("x1", String(start.x));
    line.setAttribute("y1", String(start.y));
    line.setAttribute("x2", String(end.x));
    line.setAttribute("y2", String(end.y));
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

  els.visualPlane.querySelectorAll("[data-show-closest]").forEach((button) => {
    button.addEventListener("click", () => {
      showClosestUnwatchedMovie = !showClosestUnwatchedMovie;
      button.setAttribute("aria-pressed", String(showClosestUnwatchedMovie));
      button.classList.toggle("is-active", showClosestUnwatchedMovie);
      mapElement.classList.toggle("is-showing-closest", showClosestUnwatchedMovie);
      applyMapView(mapElement);
    });
  });

  els.visualPlane.querySelectorAll("[data-show-movie-labels]").forEach((button) => {
    button.addEventListener("click", () => {
      showMovieLabels = !showMovieLabels;
      button.setAttribute("aria-pressed", String(showMovieLabels));
      button.classList.toggle("is-active", showMovieLabels);
      renderStep(currentStep);
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
  const columns = `86px repeat(${allMovieIndices.length}, minmax(48px, 1fr))`;
  const header = [
    `<span class="mini-matrix-cell is-empty"></span>`,
    ...allMovieIndices.map((columnIndex) => `<span class="mini-matrix-cell is-header">${movies[columnIndex]}</span>`),
  ].join("");
  const body = allUserIndices
    .map((rowIndex) => {
      const cells = allMovieIndices
        .map((columnIndex) => {
          const value = ratings[rowIndex][columnIndex] === null ? null : model.residualMatrix[rowIndex][columnIndex];
          return `<span class="mini-matrix-cell ${value === null ? "is-implicit" : ""}">${value === null ? "0*" : format(value, 2)}</span>`;
        })
        .join("");
      return `<span class="mini-matrix-cell is-header">${userLabelHTML(rowIndex)}</span>${cells}`;
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
      ? allMovieIndices.map((movieIndex) => ({
          label: movies[movieIndex],
          value: ratings[index][movieIndex] === null ? null : model.residualMatrix[index][movieIndex],
        }))
      : allUserIndices.map((userIndex) => ({
          label: userLabelHTML(userIndex),
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
      <span>${userLabelHTML(row)}</span>
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

function svdDecompositionHTML() {
  const firstFactor = model.componentEnergy[0];
  const factorOneMovieValues = allMovieIndices.map((movieIndex) => ({
    movieIndex,
    movie: movies[movieIndex],
    value: model.movieFactors[0][movieIndex],
  }));
  const minFactorOneValue = Math.min(...factorOneMovieValues.map((item) => item.value));
  const maxFactorOneValue = Math.max(...factorOneMovieValues.map((item) => item.value));
  const factorOneRange = maxFactorOneValue - minFactorOneValue || 1;
  const sortedFactorLineMovies = [...factorOneMovieValues].sort((a, b) => a.value - b.value);
  const factorLinePoints = sortedFactorLineMovies
    .map((item, index, sorted) => {
      const position = (item.value - minFactorOneValue) / factorOneRange;
      const isAnchor = index === 0 || index === sorted.length - 1;
      return `
        <button class="factor-line-point ${item.value < 0 ? "is-negative" : "is-positive"} ${index % 2 === 0 ? "is-top" : "is-bottom"} ${isAnchor ? "is-anchor" : ""}" type="button" style="--x:${position}" title="${item.movie}: ${format(item.value, 3)}">
          <i></i>
          <b>${item.movie}</b>
          <em>${format(item.value, 3)}</em>
        </button>
      `;
    })
    .join("");
  const factorVectorRows = allMovieIndices
    .map(
      (movieIndex) => `
        <div>
          <span>${movies[movieIndex]}</span>
          <strong>${format(model.movieFactors[0][movieIndex], 3)}</strong>
        </div>
      `
    )
    .join("");
  const pendingUserRows = targetLastUserIndices()
    .map(
      (userIndex) => `
        <div class="is-pending${userIndex === targetUserIndex ? " is-target" : ""}">
          <span>${userLabelHTML(userIndex)}</span>
          <strong>?</strong>
        </div>
      `
    )
    .join("");

  return `
    <div class="svd-story-scene">
      <div class="svd-machine">
        <div class="svd-machine-side">
          <span>Input</span>
          <strong>A</strong>
          <p>Residual matrix from Step 4</p>
        </div>
        <div class="svd-machine-core">
          <span>Run SVD</span>
          <strong>A ~= U &Sigma; V<sup>T</sup></strong>
          <p>SVD discovers all the hidden factors it can find from the residual matrix A.</p>
        </div>
        <div class="svd-machine-side">
          <span>Output</span>
          <strong>shared factors</strong>
          <p>Here we show the movie-side vectors and strength numbers first. User coordinates are projected in Step 7.</p>
        </div>
      </div>

      <div class="svd-story-grid">
        <div class="svd-story-panel">
          <span>Movie side</span>
          <strong>Factor 1 vector</strong>
          <p>All ${movies.length} movie values. Each value says where that movie sits on this hidden direction.</p>
          <div class="factor-vector-mini is-compact is-scrollable">
            <div>
              <span>Movie</span>
              <strong>value</strong>
            </div>
            ${factorVectorRows}
          </div>
        </div>
        <div class="svd-story-panel">
          <span>User side</span>
          <strong>User coordinates come next</strong>
          <p>Each user will get one value on this same factor, but we calculate those by doing the dot product of user rows with this movie vector in Step 7.</p>
          <div class="factor-vector-mini is-compact is-scrollable">
            <div>
              <span>User</span>
              <strong>coordinate</strong>
            </div>
            ${pendingUserRows}
          </div>
        </div>
        <div class="svd-story-panel">
          <span>Strength</span>
          <strong>singular value = ${format(firstFactor.singularValue, 2)}</strong>
          <p>One number for the whole factor. It says how important this direction is compared with the others.</p>
          <div class="factor-line-card">
            <div class="factor-line-head">
              <small>All movies on Factor 1</small>
              <div class="factor-line-controls" aria-label="Factor line zoom controls">
                <button type="button" data-factor-line-zoom="-1" title="Zoom out">-</button>
                <button type="button" data-factor-line-reset title="Reset view">Reset</button>
                <button type="button" data-factor-line-zoom="1" title="Zoom in">+</button>
              </div>
            </div>
            <div class="factor-line-viewport" data-factor-line-viewport aria-label="Movies placed on Factor 1">
              <div class="factor-line-track" data-factor-line-track>
                <div class="factor-line-axis">
                  <span>negative</span>
                  <span>positive</span>
                </div>
                <div class="factor-line-zero"></div>
                ${factorLinePoints}
              </div>
            </div>
          </div>
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

function userFactorDotProductHTML({ row, factorIndex }) {
  const factorVector = model.movieFactors[factorIndex];
  const products = allMovieIndices.map((movieIndex) => {
    const isKnown = ratings[row][movieIndex] !== null;
    const residual = model.residualMatrix[row][movieIndex];
    const factorValue = factorVector[movieIndex];

    return {
      movie: movies[movieIndex],
      isKnown,
      residual,
      factorValue,
      product: residual * factorValue,
    };
  });
  const coordinate = products.reduce((total, item) => total + item.product, 0);

  return `
    <div class="user-factor-dot">
      <div class="matrix-title">
        <strong>Calculate ${userLabelHTML(row)}'s Factor ${factorIndex + 1} coordinate</strong>
        <span>user row x movie factor</span>
      </div>
      <p>Take ${userLabelHTML(row)}'s residual row from A and multiply it column-by-column with the Factor ${factorIndex + 1} movie vector from Step 5. The sum is the user coordinate.</p>
      <div class="dot-product-table">
        <span>Movie</span>
        <span>${userLabelHTML(row)} residual</span>
        <span>Factor ${factorIndex + 1}</span>
        <span>Product</span>
        ${products
          .map(
            (item) => `
              <div class="dot-product-row${item.isKnown ? "" : " is-implicit"}">
                <span>${item.movie}</span>
                <strong>${item.isKnown ? format(item.residual, 2) : "0*"}</strong>
                <strong>${format(item.factorValue, 4)}</strong>
                <b>${format(item.product, 4)}</b>
              </div>
            `
          )
          .join("")}
      </div>
      <div class="coordinate-sum">
        <span>Add the product column</span>
        <strong>${format(coordinate, 2)}</strong>
      </div>
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

function sparseMapHTML() {
  const rowPosition = new Map(allUserIndices.map((value, index) => [value, index]));
  const columnPosition = new Map(allMovieIndices.map((value, index) => [value, index]));
  const fullEntries = model.sparseEntries;
  const visibleRows = users.length;
  const visibleColumns = movies.length;

  const list = fullEntries
    .map(
      (entry) =>
        `<div>${userLabelHTML(entry.row)} / ${movies[entry.column]} -> rating ${entry.rating}, residual ${format(entry.residual, 2)}</div>`
    )
    .join("");

  const dots = fullEntries
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
          <span>${fullEntries.length} stored coordinates in the full table</span>
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
  const totalEnergy = model.totalEnergy;
  const firstFactor = model.componentEnergy[0];
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

  return `
    <div class="k-choice-scene">
      <div class="k-choice-explainer">
        <div>
          <span>Goal</span>
          <p>SVD gives ranked hidden factors. Keeping more factors preserves more detail, but also makes the model less compressed. k is the number of factors we keep.</p>
        </div>
        <div>
          <span>Rule</span>
          <strong>${format(firstFactor.singularValue, 2)}<sup>2</sup> = ${format(firstFactor.energy, 2)}</strong>
          <p>${format(firstFactor.energy, 2)} / ${format(totalEnergy, 2)} = ${format((firstFactor.energy / totalEnergy) * 100, 1)}% of the residual pattern.</p>
        </div>
        <div>
          <span>Current choice</span>
          <strong>k = ${factorCount} keeps ${format(chosenEnergy.cumulativeShare * 100, 1)}%</strong>
          <p>${targetSentence} k = ${enoughFactorCount} adds only ${format((enoughEnergy.cumulativeShare - targetEnergy.cumulativeShare) * 100, 1)} percentage points after k = ${energyTargetCount}.</p>
        </div>
      </div>

      <div class="k-choice-main">
        <div class="matrix-title">
          <strong>Add factors from strongest to weakest</strong>
          <span>cumulative preserved energy</span>
        </div>
        <div class="energy-list">${energyRows}</div>
      </div>
    </div>
  `;
}

function userCoordinatesHTML() {
  const { row } = predictionExample;
  const userCoordinates = model.userFactors[row];
  const userVector = userCoordinates.map((value) => format(value, 2)).join(", ");

  return `
    <div class="coordinate-origin-scene user-coordinate-scene">
      ${userFactorDotProductHTML({ row, factorIndex: 0 })}
      <div class="origin-panel">
        <div class="matrix-title">
          <strong>Now the placeholders are filled</strong>
          ${sourcePillHTML({
            label: "hidden axes",
            title: "Coordinates use these same factors",
            body: hiddenFactorsPreviewHTML(),
          })}
        </div>
        <p>Repeat that same dot product with every kept movie factor. Each sum fills one user coordinate that was left as ? in Step 5.</p>
        ${factorCoordinateRowsHTML({
          values: userCoordinates,
          description: (index) => `${userLabelHTML(row)}'s row multiplied by Factor ${index + 1}`,
        })}
        <span class="factor-label">${userLabelHTML(row)} -> [${userVector}]</span>
      </div>
    </div>
  `;
}

function movieCoordinatesHTML() {
  const { column } = predictionExample;
  const movieCoordinates = model.movieFactors.map((factorRow) => factorRow[column]);
  const movieVector = movieCoordinates.map((value) => format(value, 2)).join(", ");
  const factorRows = movieCoordinates
    .map(
      (value, index) => `
        <div class="movie-factor-row">
          <span>Factor ${index + 1}</span>
          <strong>${format(value, 4)}</strong>
          <em>${movies[column]} in Factor ${index + 1}</em>
        </div>
      `
    )
    .join("");

  return `
    <div class="movie-coordinate-scene">
      <div class="origin-panel">
        <div class="matrix-title">
          <strong>Use V<sup>T</sup> from SVD</strong>
          <span>movie factor vectors</span>
        </div>
        <p>SVD already produced one movie vector per hidden factor. To locate a movie, read that movie's value inside each kept factor vector.</p>
        <div class="inline-source-preview">
          <strong>Factor 1 is a full vector across all movies</strong>
          <div class="factor-vector-mini is-scrollable">
            <div>
              <span>Movie</span>
              <strong>Factor 1 value</strong>
            </div>
            ${allMovieIndices
              .map(
                (movieIndex) => `
                  <div class="${movieIndex === column ? "is-target" : ""}">
                    <span>${movies[movieIndex]}</span>
                    <strong>${format(model.movieFactors[0][movieIndex], 4)}</strong>
                  </div>
                `
              )
              .join("")}
          </div>
        </div>
      </div>
      <div class="origin-panel">
        <div class="matrix-title">
          <strong>${movies[column]}'s movie coordinates</strong>
          <span>same axes as users</span>
        </div>
        <p>Repeat the lookup for every kept factor. The result is the short movie coordinate vector used in the prediction dot product.</p>
        <div class="movie-factor-rows">${factorRows}</div>
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
          <p>The map uses x = hidden factor 1 and y = hidden factor 2. Current k is ${factorCount}, so the model lives in ${factorCount} dimensions.</p>
        </div>
        <button class="primary-button map-switch-button" type="button" data-map-k="2">Switch to k = 2</button>
      </div>
    `;
  }

  const userPoints = users.map((user, rowIndex) => ({
    type: "user",
    label: userLabelHTML(rowIndex),
    labelText: userLabelText(rowIndex),
    segment: rowIndex === targetUserIndex ? "" : userSegments[rowIndex],
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
  const youPoint = userPoints[targetUserIndex];
  const youDisplayPoint = { x: xScale(youPoint.x), y: yScale(youPoint.y) };
  const closestRecommendation = model.recommendations
    .map((recommendation) => {
      const movieIndex = movies.indexOf(recommendation.movie);
      const moviePoint = moviePoints[movieIndex];
      const endX = xScale(moviePoint.x);
      const endY = yScale(moviePoint.y);
      return {
        recommendation,
        movieIndex,
        endX,
        endY,
        distance: Math.hypot(youDisplayPoint.x - endX, youDisplayPoint.y - endY),
      };
    })
    .sort((left, right) => left.distance - right.distance)[0];
  const closestLink =
    closestRecommendation
      ? {
          startX: youDisplayPoint.x,
          startY: youDisplayPoint.y,
          endX: closestRecommendation.endX,
          endY: closestRecommendation.endY,
          movie: closestRecommendation.recommendation.movie,
          category: movieCategories[closestRecommendation.movieIndex],
          score: closestRecommendation.recommendation.score,
        }
      : null;
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
          : `${point.labelText}${point.segment ? ` (${point.segment})` : ""}: (${format(point.x, 2)}, ${format(point.y, 2)})`;
      const labelHTML =
        point.type === "movie"
          ? `<em><b>${point.label}</b><small>${point.category}</small></em>`
          : `<em><b>${point.label}</b>${point.segment ? `<small>${point.segment}</small>` : ""}</em>`;
      const visibleLabel =
        point.type === "movie" ? showMovieLabels && shouldLabel : shouldLabel;
      return `
        <span
          class="map-point ${point.type}${categoryClass}${point.target ? " is-target" : ""}"
          style="--x:${baseX}%;--y:${baseY}%;"
          data-map-base-x="${baseX}"
          data-map-base-y="${baseY}"
          title="${title}"
        >
          ${visibleLabel ? labelHTML : ""}
        </span>
      `;
    })
    .join("");
  const userGuide = users
    .map(
      (user, index) => `
        <div class="map-user-row${index === targetUserIndex ? " is-you" : ""}">
          <strong>${userLabelHTML(index)}</strong>
          <span>${index === targetUserIndex ? "" : userSegments[index]}</span>
          <em>${index === targetUserIndex ? "" : userDescriptions[index]}</em>
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
  const movieGuide = moviePoints
    .map(
      (point) => `
        <div class="map-movie-row ${categoryClassName(point.category)}${point.target ? " is-target" : ""}">
          <b></b>
          <strong>${point.label}</strong>
          <span>${point.category}</span>
          <em>${format(point.x, 2)}, ${format(point.y, 2)}</em>
        </div>
      `
    )
    .join("");

  return `
    <div class="preference-map-scene">
      <div class="map-explainer">
        <strong>All users and all movies</strong>
        <p>With k = 2, every user and every movie has two coordinates: Factor 1 on x and Factor 2 on y. This map plots all ${users.length} users and all ${movies.length} movies.</p>
        <div class="map-legend">
          <span><b class="legend-user"></b> Users</span>
          <span><b class="legend-movie category-sci-fi"></b> Sci-Fi</span>
          <span><b class="legend-movie category-action"></b> Action</span>
          <span><b class="legend-movie category-comedy"></b> Comedy</span>
          <span><b class="legend-movie category-romance"></b> Romance</span>
          <span><b class="legend-you"></b> ${targetUserLabelHTML()}</span>
        </div>
        <div class="map-toolbar" aria-label="Map controls">
          <button type="button" data-map-zoom="out" aria-label="Zoom out">-</button>
          <strong data-map-zoom-value>100%</strong>
          <button type="button" data-map-zoom="in" aria-label="Zoom in">+</button>
          <button type="button" data-map-zoom="reset">Reset</button>
          <button
            class="closest-button${showClosestUnwatchedMovie ? " is-active" : ""}"
            type="button"
            data-show-closest="true"
            aria-pressed="${showClosestUnwatchedMovie}"
          >show closest unwatched movie</button>
          <button
            class="closest-button${showMovieLabels ? " is-active" : ""}"
            type="button"
            data-show-movie-labels="true"
            aria-pressed="${showMovieLabels}"
          >all movie names</button>
        </div>
        ${
          closestLink
            ? `<p class="closest-summary">Closest unrated movie on this 2D map: <strong>${closestLink.movie}</strong> <span class="rank-category ${categoryClassName(closestLink.category)}">${closestLink.category}</span>, predicted ${format(closestLink.score, 2)}.</p>`
            : ""
        }
        <p class="map-hint">Drag the map to move around. Scroll or use + to zoom into crowded points; every plotted point stays part of the map.</p>
        <div class="map-guide">
          <strong>All user coordinates</strong>
          ${userGuide}
        </div>
        <div class="map-guide">
          <strong>Movie color key</strong>
          ${categoryGuide}
        </div>
        <div class="map-guide map-movie-guide">
          <strong>All movie coordinates</strong>
          ${movieGuide}
        </div>
      </div>
      <div class="preference-map${showClosestUnwatchedMovie ? " is-showing-closest" : ""}" aria-label="2D hidden preference map">
        ${
          closestLink
            ? `<svg class="closest-link-layer${showClosestUnwatchedMovie ? " is-visible" : ""}" aria-hidden="true">
                <line
                  data-closest-link="true"
                  data-start-x="${closestLink.startX}"
                  data-start-y="${closestLink.startY}"
                  data-end-x="${closestLink.endX}"
                  data-end-y="${closestLink.endY}"
                ></line>
              </svg>`
            : ""
        }
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
    .map((ratingRow, rowIndex) => ({ user: userLabelHTML(rowIndex), rating: ratingRow[column] }))
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
          <span>${userLabelHTML(row)} rated ${movies[column]} = ${rating}</span>
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
            <strong>${userLabelHTML(row)} is ${format(Math.abs(residual), 2)} ${residual >= 0 ? "above" : "below"} this movie's baseline</strong>
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
            Predict ${movies[column]} for ${userLabelHTML(row)}
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
          <div class="factor-heading">${userLabelHTML(row)}</div>
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
      const movieIndex = movies.indexOf(item.movie);
      const category = movieCategories[movieIndex];
      return `
        <div class="rank-item" style="--delay:${index * 120}ms">
          <span class="rank-number">${index + 1}</span>
          <strong>
            ${item.movie}
            <b class="rank-category ${categoryClassName(category)}">${category}</b>
          </strong>
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
          <strong>${targetUserLabelHTML()} predicted ratings</strong>
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
    text: `The highlighted row is ${targetUserLabelHTML()}. It starts with sample ratings, and that row can be edited below to see how the recommendations change.`,
    inspectorTitle: `${targetUserLabelHTML()}'s row`,
    inspectorText: `Blank means unrated. Clearing a rating removes it from ${targetUserLabelHTML()}'s known row, so that movie becomes eligible for recommendation again.`,
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
    tab: "Sparse",
    title: "Sparse storage keeps only known ratings",
    text: "The matrix has many blanks, so the sparse representation stores coordinates and values only for ratings that actually exist.",
    inspectorTitle: "Sparse matrix",
    inspectorText: "This is why sparse matrices are useful: the system avoids pretending every user watched every movie.",
    render: sparseMapHTML,
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
      matrixSceneHTML({
        title: "Sparse residual matrix",
        note: `0* = implicit zero residual; known 0.00 = real known residual`,
        values: model.residualMatrix.map((row, rowIndex) =>
          row.map((value, columnIndex) => (ratings[rowIndex][columnIndex] === null ? null : value))
        ),
        mode: "residuals",
        showImplicitZeros: true,
      }),
  },
  {
    tab: "Run SVD",
    title: "Run SVD on the residual matrix",
    text: "SVD discovers hidden movie-side factor vectors from matrix A and gives each factor a singular value for strength. We leave user coordinates as placeholders until Step 7 projects users onto those vectors.",
    inspectorTitle: "What SVD gives us",
    inspectorText: "The movie vector says how movies line up with the factor. The singular value says how important the factor is. User coordinates are calculated next by A times the movie factors.",
    render: svdDecompositionHTML,
  },
  {
    tab: "Choose k",
    title: "Choose how many factors to keep",
    text: "SVD may produce many hidden factors. We square each singular value into energy, add the strongest factors first, and choose k where enough pattern is preserved.",
    inspectorTitle: "Why keep only k factors",
    inspectorText: "Keeping only the strongest k factors compresses the model: fewer numbers to store, faster dot products later, and less weak/noisy detail. The tradeoff is that the prediction keeps most of the useful pattern, not every tiny variation.",
    render: hiddenAxesHTML,
  },
  {
    tab: "User Coords",
    title: "Calculate user coordinates",
    text: `Now we fill the user-coordinate placeholders from Step 5. ${userLabelHTML(predictionExample.row)}'s residual row is multiplied by each kept movie factor vector; each dot product becomes one user coordinate.`,
    inspectorTitle: "Projection onto factors",
    inspectorText: "This is A times the movie factor vectors. A long user row becomes a short coordinate vector with k numbers.",
    render: userCoordinatesHTML,
  },
  {
    tab: "Movie Coords",
    title: "A movie gets matching coordinates",
    text: `A movie's coordinates come directly from the movie factor vectors SVD produced. For ${movies[predictionExample.column]}, read that movie's value in each kept factor.`,
    inspectorTitle: "Movie coordinate source",
    inspectorText: "The user and the movie now live on the same kept hidden factors, so the next step can multiply matching coordinates.",
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
    text: "For one blank cell, SVD multiplies matching user and movie coordinates across the kept factors. The sum becomes an adjustment to the movie average.",
    inspectorTitle: "Dot product",
    inspectorText: "Step 7 calculated dot products between a long user row and the factor vectors. This step calculates a dot product between the short user-coordinate vector and the short movie-coordinate vector.",
    render: svdCalculationHTML,
  },
  {
    tab: "Predict",
    title: "The matrix is reconstructed as predictions",
    text: "The model reconstructs estimated residuals for every cell, then adds movie averages back. These are model estimates, so even already-rated cells can differ from the original ratings.",
    inspectorTitle: "Prediction",
    inspectorText: "The prediction is movie average plus SVD adjustment. Recommendations still filter to movies that were originally blank.",
    render: () =>
      matrixSceneHTML({
        title: "Predicted ratings after SVD",
        note: "model estimate = movie average + reconstructed residual",
        values: model.predictedRatings,
      }),
  },
  {
    tab: "Recommend",
    title: "Recommend the highest unrated movies",
    text: `For ${targetUserLabelHTML()}, the system filters out movies already rated and ranks the remaining predictions.`,
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

function bindFactorLineExplorer() {
  const viewport = els.visualPlane.querySelector("[data-factor-line-viewport]");
  const track = els.visualPlane.querySelector("[data-factor-line-track]");
  if (!viewport || !track) return;

  const setTrackWidth = () => {
    track.style.width = `${Math.round(760 * factorLineView.zoom)}px`;
  };

  const setZoom = (nextZoom) => {
    const previousWidth = track.offsetWidth || 760;
    const viewportCenter = viewport.scrollLeft + viewport.clientWidth / 2;
    const centerRatio = viewportCenter / previousWidth;
    factorLineView.zoom = Math.max(1, Math.min(3.5, nextZoom));
    setTrackWidth();
    viewport.scrollLeft = centerRatio * track.offsetWidth - viewport.clientWidth / 2;
  };

  setTrackWidth();

  els.visualPlane.querySelectorAll("[data-factor-line-zoom]").forEach((button) => {
    button.addEventListener("click", () => {
      setZoom(factorLineView.zoom + Number(button.dataset.factorLineZoom) * 0.5);
    });
  });

  const resetButton = els.visualPlane.querySelector("[data-factor-line-reset]");
  resetButton?.addEventListener("click", () => {
    factorLineView.zoom = 1;
    setTrackWidth();
    viewport.scrollLeft = 0;
  });

  viewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    factorLineView.dragging = true;
    factorLineView.startX = event.clientX;
    factorLineView.startScrollLeft = viewport.scrollLeft;
    viewport.setPointerCapture(event.pointerId);
  });

  viewport.addEventListener("pointermove", (event) => {
    if (!factorLineView.dragging) return;
    viewport.scrollLeft = factorLineView.startScrollLeft - (event.clientX - factorLineView.startX);
  });

  const stopDragging = () => {
    factorLineView.dragging = false;
  };
  viewport.addEventListener("pointerup", stopDragging);
  viewport.addEventListener("pointercancel", stopDragging);
}

function renderStep(index = currentStep) {
  currentStep = (index + steps.length) % steps.length;
  const step = steps[currentStep];
  const showsSparseInspector = currentStep === sparseStepIndex;

  els.stepCount.textContent = `Step ${currentStep + 1} of ${steps.length}`;
  els.stepTitle.textContent = step.title;
  els.stepText.innerHTML = step.text;
  els.workspace.classList.toggle("has-side-inspector", showsSparseInspector);
  els.inspector.hidden = !showsSparseInspector;
  els.stageNote.hidden = showsSparseInspector;
  els.stageNoteTitle.innerHTML = step.inspectorTitle;
  els.stageNoteText.innerHTML = step.inspectorText;
  els.inspectorTitle.innerHTML = step.inspectorTitle;
  els.inspectorText.innerHTML = step.inspectorText;
  els.visualPlane.innerHTML = step.render();
  bindRatingEditor();
  bindFactorLineExplorer();

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
