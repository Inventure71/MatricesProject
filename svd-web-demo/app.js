let users = [
  "User 1",
  "User 2",
  "User 3",
  "User 4",
  "User 5",
  "User 6",
  "User 7",
  "User 8",
  "User 9",
  "You",
];
let movies = [
  "The Matrix",
  "Interstellar",
  "Inception",
  "Dune",
  "Blade Runner",
  "Arrival",
  "Mad Max",
  "The Martian",
  "Titanic",
  "The Notebook",
  "La La Land",
  "Barbie",
  "Pride & Prejudice",
  "Before Sunrise",
  "Little Women",
  "Amelie",
];
let ratings = [
  [5, 5, 4, 5, 4, 5, 4, 5, null, 1, null, 1, null, null, null, null],
  [4, 5, 5, 4, 5, null, null, null, 2, null, null, null, 2, null, null, null],
  [5, 4, null, 5, 5, 4, 5, 4, null, 1, null, null, 1, null, null, null],
  [4, null, 5, 4, 4, null, 4, null, null, null, 2, null, null, null, null, null],
  [null, 2, null, null, null, null, null, null, 5, 5, 4, 4, 5, 5, 4, 4],
  [null, null, null, null, null, null, null, null, 4, 5, 5, 4, 4, 4, 5, 5],
  [null, null, 2, 1, null, null, 1, null, 5, 4, 5, 5, 5, null, 5, null],
  [null, null, null, null, 2, null, null, null, 4, null, 5, 5, null, 5, 4, 4],
  [5, 5, null, null, null, null, 4, null, null, null, 1, 1, 1, 1, 1, 1],
  [3, 4, 4, 3, null, 4, null, 4, 3, null, 4, null, 5, 4, 5, 4],
];

let targetUserIndex = 9;
const factorCount = 2;
const focusUserIndices = [0, 1, 4, 6, 9];
const focusMovieIndices = [0, 1, 2, 3, 4, 5, 7, 10, 11];
const baselineExample = { row: 9, column: 0 };
const predictionExample = { row: 9, column: 4 };
const defaultTargetRatings = [...ratings[targetUserIndex]];

function targetLastUserIndices() {
  return users.map((_, index) => index).filter((index) => index !== targetUserIndex).concat(targetUserIndex);
}

const els = {
  visualPlane: document.querySelector("#visualPlane"),
  stepCount: document.querySelector("#stepCount"),
  stepTitle: document.querySelector("#stepTitle"),
  stepText: document.querySelector("#stepText"),
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
  tabs: [],
};

function mean(values) {
  const known = values.filter((value) => value !== null && Number.isFinite(value));
  if (!known.length) return null;
  return known.reduce((sum, value) => sum + value, 0) / known.length;
}

function transpose(matrix) {
  return matrix[0].map((_, columnIndex) => matrix.map((row) => row[columnIndex]));
}

function multiply(a, b) {
  const bT = transpose(b);
  return a.map((row) =>
    bT.map((column) => row.reduce((sum, value, index) => sum + value * column[index], 0))
  );
}

function matrixVectorMultiply(matrix, vector) {
  return matrix.map((row) => row.reduce((sum, value, index) => sum + value * vector[index], 0));
}

function identity(size) {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => (row === column ? 1 : 0))
  );
}

function jacobiEigenDecomposition(symmetricMatrix, maxIterations = 120, tolerance = 1e-10) {
  const size = symmetricMatrix.length;
  const a = symmetricMatrix.map((row) => [...row]);
  const eigenvectors = identity(size);

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let p = 0;
    let q = 1;
    let largest = Math.abs(a[p][q]);

    for (let row = 0; row < size; row += 1) {
      for (let column = row + 1; column < size; column += 1) {
        const value = Math.abs(a[row][column]);
        if (value > largest) {
          largest = value;
          p = row;
          q = column;
        }
      }
    }

    if (largest < tolerance) break;

    const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
    const sign = theta >= 0 ? 1 : -1;
    const t = sign / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
    const c = 1 / Math.sqrt(t * t + 1);
    const s = t * c;

    const app = a[p][p];
    const aqq = a[q][q];
    const apq = a[p][q];

    a[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
    a[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
    a[p][q] = 0;
    a[q][p] = 0;

    for (let k = 0; k < size; k += 1) {
      if (k !== p && k !== q) {
        const akp = a[k][p];
        const akq = a[k][q];
        a[k][p] = c * akp - s * akq;
        a[p][k] = a[k][p];
        a[k][q] = s * akp + c * akq;
        a[q][k] = a[k][q];
      }

      const vkp = eigenvectors[k][p];
      const vkq = eigenvectors[k][q];
      eigenvectors[k][p] = c * vkp - s * vkq;
      eigenvectors[k][q] = s * vkp + c * vkq;
    }
  }

  const pairs = a
    .map((row, index) => ({
      value: Math.max(0, row[index]),
      vector: eigenvectors.map((vectorRow) => vectorRow[index]),
    }))
    .sort((left, right) => right.value - left.value);

  return pairs;
}

function computeModel() {
  const flattenedKnownRatings = ratings.flat().filter((value) => value !== null);
  const globalAverage = mean(flattenedKnownRatings);
  const movieAverages = movies.map((_, columnIndex) => {
    const columnValues = ratings.map((row) => row[columnIndex]);
    return mean(columnValues) ?? globalAverage;
  });

  const residualMatrix = ratings.map((row, rowIndex) =>
    row.map((rating, columnIndex) =>
      rating === null ? 0 : rating - movieAverages[columnIndex]
    )
  );

  const sparseEntries = [];
  ratings.forEach((row, rowIndex) => {
    row.forEach((rating, columnIndex) => {
      if (rating !== null) {
        sparseEntries.push({
          row: rowIndex,
          column: columnIndex,
          rating,
          residual: rating - movieAverages[columnIndex],
        });
      }
    });
  });

  const residualT = transpose(residualMatrix);
  const covariance = multiply(residualT, residualMatrix);
  const eigenPairs = jacobiEigenDecomposition(covariance).slice(0, factorCount);
  const singularValues = eigenPairs.map((pair) => Math.sqrt(pair.value));
  const components = eigenPairs.map((pair) => pair.vector);
  const componentColumns = transpose(components);

  const userFactors = residualMatrix.map((row) =>
    components.map((component) => row.reduce((sum, value, index) => sum + value * component[index], 0))
  );

  const predictedResiduals = userFactors.map((factorRow) =>
    componentColumns.map((componentColumn) =>
      factorRow.reduce((sum, value, index) => sum + value * componentColumn[index], 0)
    )
  );

  const predictedRatings = predictedResiduals.map((row, rowIndex) =>
    row.map((residual, columnIndex) =>
      Math.min(5, Math.max(1, residual + movieAverages[columnIndex]))
    )
  );

  const recommendations = predictedRatings[targetUserIndex]
    .map((score, columnIndex) => ({
      movie: movies[columnIndex],
      score,
      rated: ratings[targetUserIndex][columnIndex] !== null,
    }))
    .filter((item) => !item.rated)
    .sort((left, right) => right.score - left.score);

  return {
    globalAverage,
    movieAverages,
    residualMatrix,
    sparseEntries,
    covariance,
    singularValues,
    components,
    userFactors,
    movieFactors: components,
    predictedRatings,
    recommendations,
  };
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
    ...movieIndices.map((movieIndex) => `<div class="cell"><span>${movies[movieIndex]}</span></div>`),
  ].join("");

  const body = values
    .filter((_, rowIndex) => rowIndices.includes(rowIndex))
    .map((row, filteredRowIndex) => {
      const rowIndex = rowIndices[filteredRowIndex];
      const isTargetRow = highlightTargetRow && rowIndex === targetUserIndex;
      const rowHeaderClassNames = ["cell"];
      if (isTargetRow) rowHeaderClassNames.push("target-user-cell", "target-user-header");
      const rowHeader = `<div class="${rowHeaderClassNames.join(" ")}"><span>${users[rowIndex]}</span></div>`;
      const cells = movieIndices
        .map((columnIndex) => {
          const value = row[columnIndex];
          const isMissing = ratings[rowIndex][columnIndex] === null;
          const isRecommendation =
            highlightMissingForUser && rowIndex === targetUserIndex && isMissing;
          const classNames = ["cell"];
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

  return `
    <span class="coordinate-preview">
      <span></span>
      <strong>Factor 1</strong>
      <strong>Factor 2</strong>
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
        <p>The input is not raw star ratings. It is the residual matrix: known rating minus movie average, with missing values behaving as 0*.</p>
      </div>
      <div class="origin-panel">
        <div class="matrix-title">
          <strong>SVD finds directions</strong>
          ${sourcePillHTML({
            label: "kept factors",
            title: "Two strongest directions",
            body: hiddenFactorsPreviewHTML(),
          })}
        </div>
        <p>TruncatedSVD keeps the two strongest hidden directions in A. They are not genre labels; they are mathematical patterns that explain residuals.</p>
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
          ${sourcePillHTML({
            label: "row from A",
            title: `${users[row]}'s visible residuals`,
            body: residualVectorPreviewHTML({ axis: "row", index: row }),
          })}
        </div>
        <p>This row is the source. It says how ${users[row]}'s known ratings differ from each movie's average.</p>
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
          ${sourcePillHTML({
            label: "column from A",
            title: `${movies[column]}'s visible residuals`,
            body: residualVectorPreviewHTML({ axis: "column", index: column }),
          })}
        </div>
        <p>This column is the source. It says which users rated ${movies[column]} above or below that movie's average.</p>
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
        <p>SVD places the movie on the same hidden factors as the users, so the next step can compare matching coordinates.</p>
        ${factorCoordinateRowsHTML({
          values: movieCoordinates,
          description: (index) => `${movies[column]}'s position on hidden factor ${index + 1}`,
        })}
        <span class="factor-label">${movies[column]} -> [${movieVector}]</span>
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
          <strong>Factor 1 and Factor 2 are hidden taste axes learned by SVD.</strong>
          <span>We did not name them as genres. They are compressed patterns from the ratings, and every user and movie gets a coordinate on each axis.</span>
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
            <strong>Factor 1 with Factor 1, Factor 2 with Factor 2</strong>
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
        <p>Think of each factor as one question SVD invented to explain rating patterns. The demo keeps two factors so the calculation fits on screen.</p>
        <div>
          <span>Not a genre label</span>
          <b>Factor 1 does not literally mean sci-fi, and Factor 2 does not literally mean romance.</b>
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
    title: "Compute one movie-average baseline",
    text: "Before SVD, each movie gets a simple baseline: its average known rating. Then every real rating is replaced by rating minus movie average, so SVD learns what is unusually high or low instead of relearning that some movies are generally rated higher.",
    inspectorTitle: "Baseline idea",
    inspectorText: "The movie average is the starting prediction. SVD works on deviations from that start. Blanks stay unknown here; they are not treated as low ratings.",
    render: baselineCalculationHTML,
  },
  {
    tab: "Residual",
    title: "Build the SVD input matrix",
    text: "Known ratings become residual numbers representing how much the user liked or disliked the movie compared to the movie average. Missing ratings become implicit zero residuals, shown as 0*, meaning no known deviation from the movie average.",
    inspectorTitle: "SVD input",
    inspectorText: "0* is not a rating. It is how the sparse matrix behaves mathematically for unstored entries during TruncatedSVD.",
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
    title: "SVD first finds hidden axes",
    text: "The residual matrix A is the source. TruncatedSVD looks through A and keeps the two strongest directions that explain rating deviations.",
    inspectorTitle: "Where axes come from",
    inspectorText: "The axes come from the residual matrix, not from manual genre labels. Their singular values show how strong those two directions are.",
    render: hiddenAxesHTML,
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
    title: "A movie column becomes coordinates",
    text: `For ${movies[predictionExample.column]}, SVD turns the movie's residual column into matching coordinates on the same hidden factors.`,
    inspectorTitle: "Movie coordinate source",
    inspectorText: "A movie's coordinates come from that movie's column in A. Users and movies must use the same axes so their matching coordinates can be multiplied.",
    render: movieCoordinatesHTML,
  },
  {
    tab: "Dot Product",
    title: "Compare coordinates with a dot product",
    text: "For one blank cell, SVD compares the user's coordinates and the movie's coordinates on the same hidden factors. The result becomes an adjustment to the movie average.",
    inspectorTitle: "Dot product",
    inspectorText: "A factor is an unnamed rating pattern learned from the data. Matching signs increase the prediction; opposite signs decrease it.",
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

  els.stepCount.textContent = `Step ${currentStep + 1} of ${steps.length}`;
  els.stepTitle.textContent = step.title;
  els.stepText.textContent = step.text;
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
refreshMetrics();
renderStep(currentStep);
