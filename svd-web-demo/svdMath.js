function mean(values) {
  const known = values.filter((value) => value !== null && Number.isFinite(value));
  if (!known.length) return null;
  return known.reduce((sum, value) => sum + value, 0) / known.length;
}

function transpose(matrix) {
  return matrix[0].map((_, columnIndex) => matrix.map((row) => row[columnIndex]));
}

function multiplyMatrices(a, b) {
  const bT = transpose(b);
  return a.map((row) =>
    bT.map((column) => row.reduce((sum, value, index) => sum + value * column[index], 0))
  );
}

function identityMatrix(size) {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => (row === column ? 1 : 0))
  );
}

function jacobiEigenDecomposition(symmetricMatrix, maxIterations = 120, tolerance = 1e-10) {
  const size = symmetricMatrix.length;
  const a = symmetricMatrix.map((row) => [...row]);
  const eigenvectors = identityMatrix(size);

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

  return a
    .map((row, index) => ({
      value: Math.max(0, row[index]),
      vector: eigenvectors.map((vectorRow) => vectorRow[index]),
    }))
    .sort((left, right) => right.value - left.value);
}

function computeSvdRecommendationModel({
  ratings,
  movies,
  factorCount,
  targetUserIndex,
  energyTargetCount,
  enoughFactorCount,
}) {
  const flattenedKnownRatings = ratings.flat().filter((value) => value !== null);
  const globalAverage = mean(flattenedKnownRatings);
  const movieAverages = movies.map((_, columnIndex) => {
    const columnValues = ratings.map((row) => row[columnIndex]);
    return mean(columnValues) ?? globalAverage;
  });

  const residualMatrix = ratings.map((row) =>
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
  const covariance = multiplyMatrices(residualT, residualMatrix);
  const allEigenPairs = jacobiEigenDecomposition(covariance);
  const totalEnergy = allEigenPairs.reduce((sum, pair) => sum + pair.value, 0);
  const componentEnergy = allEigenPairs.map((pair, index) => {
    const component = index + 1;
    const cumulativeEnergy = allEigenPairs
      .slice(0, component)
      .reduce((sum, item) => sum + item.value, 0);

    return {
      component,
      singularValue: Math.sqrt(pair.value),
      energy: pair.value,
      cumulativeEnergy,
      cumulativeShare: totalEnergy ? cumulativeEnergy / totalEnergy : 0,
      kept: index < factorCount,
      target: component === energyTargetCount,
      comparison: component === enoughFactorCount,
    };
  });
  const eigenPairs = allEigenPairs.slice(0, factorCount);
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

  const predictedRatings = predictedResiduals.map((row) =>
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
    allSingularValues: allEigenPairs.map((pair) => Math.sqrt(pair.value)),
    totalEnergy,
    componentEnergy,
    components,
    userFactors,
    movieFactors: components,
    predictedRatings,
    recommendations,
  };
}
