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
  "User 10",
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

let targetUserIndex = 8;
const factorCount = 2;
const focusUserIndices = [0, 1, 4, 6, 8];
const focusMovieIndices = [0, 1, 2, 3, 4, 5, 7, 10, 11];
const baselineExample = { row: 8, column: 0 };
const predictionExample = { row: 8, column: 4 };

const els = {
  visualPlane: document.querySelector("#visualPlane"),
  stepCount: document.querySelector("#stepCount"),
  stepTitle: document.querySelector("#stepTitle"),
  stepText: document.querySelector("#stepText"),
  inspectorTitle: document.querySelector("#inspectorTitle"),
  inspectorText: document.querySelector("#inspectorText"),
  totalCells: document.querySelector("#totalCells"),
  knownRatings: document.querySelector("#knownRatings"),
  sparsity: document.querySelector("#sparsity"),
  previousStep: document.querySelector("#previousStep"),
  nextStep: document.querySelector("#nextStep"),
  playPause: document.querySelector("#playPause"),
  playLabel: document.querySelector("#playLabel"),
  tabs: [...document.querySelectorAll(".step-tab")],
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
      const rowHeader = `<div class="cell"><span>${users[rowIndex]}</span></div>`;
      const cells = movieIndices
        .map((columnIndex) => {
          const value = row[columnIndex];
          const isMissing = ratings[rowIndex][columnIndex] === null;
          const isRecommendation =
            highlightMissingForUser && rowIndex === targetUserIndex && isMissing;
          const classNames = ["cell"];
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
          <span>${visibleEntries.length} visible coordinates; ${knownRatings} used by the backend</span>
        </div>
        <div class="dot-field" style="background-size:calc(100% / ${visibleColumns}) calc(100% / ${visibleRows})">${dots}</div>
      </div>
      <div class="coordinate-list">${list}</div>
    </div>
  `;
}

function svdHTML() {
  const bars = model.singularValues
    .map((value, index) => {
      const width = `${(value / model.singularValues[0]) * 100}%`;
      return `<span class="factor-bar" style="--w:${width};--delay:${index * 140}ms"></span>`;
    })
    .join("");
  const { row, column } = predictionExample;
  const userVector = model.userFactors[row].map((value) => format(value, 2)).join(", ");
  const movieVector = model.movieFactors.map((factorRow) => format(factorRow[column], 2)).join(", ");

  return `
    <div class="svd-scene">
      <div class="formula-scene compact">
        <div class="factor-block">
          <span class="factor-label">Input</span>
          <strong class="factor-symbol">A</strong>
          <span class="factor-label">sparse residual matrix</span>
        </div>
        <div class="operator">=</div>
        <div class="factor-block">
          <span class="factor-label">Users become coordinates</span>
          <strong class="factor-symbol">U</strong>
          <span class="factor-label">${users[targetUserIndex]} -> [${userVector}]</span>
        </div>
        <div class="operator">x</div>
        <div class="factor-block">
          <span class="factor-label">Movies become coordinates</span>
          <strong class="factor-symbol">ΣVᵀ</strong>
          <div class="factor-mini">${bars}</div>
          <span class="factor-label">${movies[column]} -> [${movieVector}]</span>
        </div>
      </div>
      <div class="svd-note-grid">
        <div>
          <span class="factor-label">What SVD is doing</span>
          <strong>It compresses the residual matrix into two hidden axes.</strong>
        </div>
        <div>
          <span class="factor-label">What the axes mean</span>
          <strong>They are learned patterns, not manually named genres.</strong>
        </div>
        <div>
          <span class="factor-label">Why singular values matter</span>
          <strong>${model.singularValues.map((v) => format(v, 2)).join(" and ")} show how strong the two kept patterns are.</strong>
        </div>
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
            <span>1. Average the known ratings for ${movies[column]}</span>
            <strong>(${terms}) / ${knownColumnRatings.length} = ${format(average, 2)}</strong>
          </div>
          <div class="formula-line">
            <span>2. Subtract the average from the chosen rating</span>
            <strong>${rating} - ${format(average, 2)} = ${format(residual, 2)}</strong>
          </div>
          <div class="formula-line emphasis">
            <span>3. Store only this deviation</span>
            <strong>${users[row]} liked ${movies[column]} ${format(Math.abs(residual), 2)} above the movie average</strong>
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
          <span>Predict ${movies[column]} for ${users[row]}</span>
        </div>

        <div class="dot-intro">
          <strong>SVD has already given both sides hidden coordinates.</strong>
          <span>Now compare matching coordinates only: Factor 1 with Factor 1, Factor 2 with Factor 2.</span>
        </div>

        <div class="factor-compare-grid">
          <div class="factor-heading"></div>
          <div class="factor-heading">${users[row]}</div>
          <div class="factor-heading">${movies[column]}</div>
          <div class="factor-heading">Product</div>
          ${userVector
            .map(
              (userValue, index) => `
                <div class="factor-label-cell">Factor ${index + 1}</div>
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
            <strong>F1 with F1, F2 with F2</strong>
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
        <p>The coordinates are not ratings. They are hidden taste-pattern scores learned by SVD.</p>
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
      const originallyRated = ratings[targetUserIndex][columnIndex] !== null;
      const classNames = ["cell", originallyRated ? "known" : "recommendation"];
      const style = originallyRated
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
          <span>gold outline = originally unrated</span>
        </div>
        <div class="target-row">${rowCells}</div>
      </div>
      <div class="rank-list">${items}</div>
    </div>
  `;
}

const steps = [
  {
    title: "Start with the full rating matrix",
    text: "The backend calculates with all 10 users and all 16 movies. Blank cells mean the user has not rated that movie.",
    inspectorTitle: "Data meaning",
    inspectorText: "Missing ratings stay unknown. The demo never stores them as fake low ratings such as -1.",
    render: () =>
      matrixHTML({
        title: "Original user-movie ratings",
        note: "blank = not rated",
        values: ratings,
      }),
  },
  {
    title: "Crop the view for teaching",
    text: "The calculation still uses the full matrix, but the visualization now focuses on a smaller slice so each step is readable.",
    inspectorTitle: "Display-only crop",
    inspectorText: "This crop includes sci-fi fans, romance fans, and the target user. It does not change the backend result.",
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
    title: "Sparse storage keeps only known ratings",
    text: "The matrix has many blanks, so the sparse representation stores coordinates and values only for ratings that actually exist.",
    inspectorTitle: "Sparse matrix",
    inspectorText: "This is why sparse matrices are useful: the system avoids pretending every user watched every movie.",
    render: () => sparseMapHTML({ focused: true }),
  },
  {
    title: "Compute one movie-average baseline",
    text: "Before SVD, raw ratings are converted into deviations from each movie's average, so popular movies do not dominate just because their ratings are usually high.",
    inspectorTitle: "Residual idea",
    inspectorText: "Blanks are still unknown at this stage. A real zero residual can happen only when a known rating exactly equals its movie average.",
    render: baselineCalculationHTML,
  },
  {
    title: "Build the SVD input matrix",
    text: "Known ratings become residual numbers. Missing ratings become implicit zero residuals, shown as 0*, meaning no known deviation from the movie average.",
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
    title: "SVD creates hidden coordinates",
    text: "SVD takes the residual matrix and gives every user and movie a short coordinate list. Similar coordinates usually mean compatible taste.",
    inspectorTitle: "Hidden factors",
    inspectorText: "The two kept factors are learned from the data. We do not label them manually as genres; SVD discovers the strongest patterns.",
    render: svdHTML,
  },
  {
    title: "Compare coordinates with a dot product",
    text: "For one blank cell, SVD compares the user's hidden coordinates with the movie's hidden coordinates. The comparison becomes an adjustment to the movie average.",
    inspectorTitle: "Dot product",
    inspectorText: "Read it as matching along the same hidden factors. Matching signs increase the prediction; opposite signs decrease it.",
    render: svdCalculationHTML,
  },
  {
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
    title: "Recommend the highest unrated movies",
    text: `For ${users[targetUserIndex]}, the system filters out movies already rated and ranks the remaining predictions.`,
    inspectorTitle: "Final rule",
    inspectorText: "Recommendations are not taken from watched movies. They come from the highest predicted scores among originally blank cells.",
    render: recommendationsHTML,
  },
];

function getInitialStep() {
  const requested = Number(new URLSearchParams(window.location.search).get("step"));
  return Number.isInteger(requested) && requested >= 0 && requested < steps.length ? requested : 0;
}

let currentStep = getInitialStep();
let playTimer = null;

function renderStep(index) {
  currentStep = (index + steps.length) % steps.length;
  const step = steps[currentStep];

  els.stepCount.textContent = `Step ${currentStep + 1} of ${steps.length}`;
  els.stepTitle.textContent = step.title;
  els.stepText.textContent = step.text;
  els.inspectorTitle.textContent = step.inspectorTitle;
  els.inspectorText.textContent = step.inspectorText;
  els.visualPlane.innerHTML = step.render();

  els.tabs.forEach((tab) => {
    tab.classList.toggle("is-active", Number(tab.dataset.step) === currentStep);
  });
}

async function loadBackendModel() {
  try {
    const response = await fetch("/api/model");
    if (!response.ok) return;
    const payload = await response.json();

    users = payload.users;
    movies = payload.movies;
    ratings = payload.ratings;
    targetUserIndex = payload.targetUserIndex;
    model = {
      globalAverage: payload.globalAverage,
      movieAverages: payload.movieAverages,
      residualMatrix: payload.residualMatrix,
      sparseEntries: payload.sparseEntries,
      singularValues: payload.singularValues,
      userFactors: payload.userFactors,
      movieFactors: payload.movieFactors,
      predictedRatings: payload.predictedRatings,
      recommendations: payload.recommendations,
    };

    refreshMetrics();
    renderStep(currentStep);
  } catch {
    refreshMetrics();
  }
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

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setPlaying(false);
    renderStep(Number(tab.dataset.step));
  });
});

refreshMetrics();
renderStep(currentStep);
loadBackendModel();
