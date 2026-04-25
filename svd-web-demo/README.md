# Sparse SVD Movie Recommender Web Demo

This folder contains the static explanation website for the Matrices Project demo.
It runs entirely in the browser and can be published directly with GitHub Pages.

The Python CLI/reference version lives in `../demo.py`.

## Run

From this folder:

```bash
python3 -m http.server 8765
```

Then open:

```text
http://localhost:8765
```

You can also open `index.html` directly in a browser. The local server is useful
because it matches how GitHub Pages serves the files.

## Deploy

The repository includes `.github/workflows/pages.yml`, which publishes this
folder to GitHub Pages when changes are pushed to `main`. In the GitHub
repository settings, set Pages to use GitHub Actions as the publishing source.

To run the Python CLI version from the repository root:

```bash
python3 -m pip install -r requirements.txt
python3 demo.py
```

## Structure

- `index.html`: page structure
- `styles.css`: minimal visual design and animations
- `app.js`: step-by-step renderer, browser-side calculation, and editable
  "You" rating controls

The calculation follows the Python demo idea over a 10 user x 16 movie matrix:

1. Keep the original user-movie ratings sparse.
2. Show the full matrix, then crop the UI to a smaller teaching subset.
3. Compute movie-average baselines.
4. Store known rating residuals in a sparse-style matrix.
5. Run a small truncated SVD calculation, let the user choose `k` from 1 to 5,
   and show `k = 5` as the 80%-90% cumulative-energy choice for the larger demo
   matrix.
6. Show one dot-product prediction step.
7. Reconstruct predicted ratings.
8. Recommend the highest predicted unrated movies.
