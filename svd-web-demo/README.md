# Sparse SVD Movie Recommender Web Demo

This folder contains a self-contained static website for the Matrices Project demo.

## Run

From this folder:

```bash
python3 server.py
```

Then open:

```text
http://localhost:5173
```

If that Python environment does not have the matrix libraries installed:

```bash
python3 -m pip install -r requirements.txt
```

## Structure

- `index.html`: page structure
- `styles.css`: minimal visual design and animations
- `app.js`: step-by-step renderer, with a browser-side fallback calculation
- `calculator.py`: Python calculation backend
- `server.py`: local web server with `/api/model`

The calculation follows the Python demo idea over a 10 user x 16 movie matrix:

1. Keep the original user-movie ratings sparse.
2. Show the full matrix, then crop the UI to a smaller teaching subset.
3. Compute movie-average baselines.
4. Store known rating residuals in a sparse-style matrix.
5. Run a small truncated SVD calculation.
6. Show one dot-product prediction step.
7. Reconstruct predicted ratings.
8. Recommend the highest predicted unrated movies.
