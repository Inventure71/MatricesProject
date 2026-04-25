"""
Sparse matrix + SVD movie recommendation demo.

This script is the Python CLI/reference version of the calculation shown by the
web visualization in svd-web-demo/. The web demo explains the process step by
step; this file keeps the same idea in one Python script.

Important meaning of the data:
- np.nan means "not rated"; it is not a real rating.
- Known ratings are converted into residuals:
    residual = rating - movie_average
- The sparse residual matrix stores only known residuals.
- Missing entries are not stored. In TruncatedSVD they behave like implicit
  zero residuals, meaning "no known deviation from the movie average", not
  "the user rated this movie 0".
"""

import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix
from sklearn.decomposition import TruncatedSVD


USERS = [f"User {index}" for index in range(1, 11)]
MOVIES = [
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
]

TARGET_USER = "User 10"
N_COMPONENTS = 5


def build_ratings_table():
    """Create the original sparse user-movie rating matrix."""
    return pd.DataFrame(
        {
            "The Matrix": [5, 4, 5, 4, np.nan, np.nan, np.nan, np.nan, 5, 3],
            "Interstellar": [5, 5, 4, np.nan, 2, np.nan, np.nan, np.nan, 5, 4],
            "Inception": [4, 5, np.nan, 5, np.nan, np.nan, 2, np.nan, np.nan, 4],
            "Dune": [5, 4, 5, 4, np.nan, np.nan, 1, np.nan, np.nan, 3],
            "Blade Runner": [4, 5, 5, 4, np.nan, np.nan, np.nan, 2, np.nan, np.nan],
            "Arrival": [5, np.nan, 4, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, 4],
            "Mad Max": [4, np.nan, 5, 4, np.nan, np.nan, 1, np.nan, 4, np.nan],
            "The Martian": [5, np.nan, 4, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, 4],
            "Titanic": [np.nan, 2, np.nan, np.nan, 5, 4, 5, 4, np.nan, 3],
            "The Notebook": [1, np.nan, 1, np.nan, 5, 5, 4, np.nan, np.nan, np.nan],
            "La La Land": [np.nan, np.nan, np.nan, 2, 4, 5, 5, 5, 1, 4],
            "Barbie": [1, np.nan, np.nan, np.nan, 4, 4, 5, 5, 1, np.nan],
            "Pride & Prejudice": [np.nan, 2, 1, np.nan, 5, 4, 5, np.nan, 1, 5],
            "Before Sunrise": [np.nan, np.nan, np.nan, np.nan, 5, 4, np.nan, 5, 1, 4],
            "Little Women": [np.nan, np.nan, np.nan, np.nan, 4, 5, 5, 4, 1, 5],
            "Amelie": [np.nan, np.nan, np.nan, np.nan, 4, 5, np.nan, 4, 1, 4],
        },
        index=USERS,
    )


def main():
    ratings = build_ratings_table()

    print("Original sparse user-movie rating matrix:")
    print(ratings)

    total_entries = ratings.shape[0] * ratings.shape[1]
    known_entries = int(ratings.notna().sum().sum())
    missing_entries = int(ratings.isna().sum().sum())
    sparsity = missing_entries / total_entries

    print("\nMatrix size:", f"{ratings.shape[0]} users x {ratings.shape[1]} movies")
    print("Total entries:", total_entries)
    print("Known ratings:", known_entries)
    print("Missing ratings:", missing_entries)
    print("Sparsity:", f"{sparsity:.1%}")

    # Movie averages are the baseline. Missing values are ignored by pandas.
    # The global average is only a fallback in case a movie has no ratings.
    global_average = float(ratings.stack().mean())
    movie_averages = ratings.mean(axis=0).fillna(global_average)

    print("\nMovie-average baseline:")
    print(movie_averages.round(2))

    # Build a sparse residual matrix from only known ratings.
    # We do not store fake values such as -1 for missing ratings.
    known_mask = ratings.notna().to_numpy()
    row_indices, col_indices = np.where(known_mask)
    known_ratings = ratings.to_numpy()[known_mask]
    known_movie_averages = movie_averages.to_numpy()[col_indices]
    residual_values = known_ratings - known_movie_averages

    sparse_residual_matrix = csr_matrix(
        (residual_values, (row_indices, col_indices)),
        shape=ratings.shape,
    )

    residual_display = pd.DataFrame(
        sparse_residual_matrix.toarray(),
        index=ratings.index,
        columns=ratings.columns,
    ).mask(ratings.isna())

    print("\nSparse residual matrix display:")
    print(residual_display.round(2))
    print("\nSparse storage summary:")
    print(sparse_residual_matrix)

    # TruncatedSVD finds the strongest hidden patterns in the residual matrix.
    # algorithm='arpack' matches the web backend and avoids small-matrix warnings
    # from the randomized solver in this toy example.
    svd = TruncatedSVD(n_components=N_COMPONENTS, algorithm="arpack", random_state=42)
    user_factors = svd.fit_transform(sparse_residual_matrix)
    movie_factors = svd.components_

    print("\nSingular values:")
    print(np.round(svd.singular_values_, 2))

    print("\nUser factors:")
    print(pd.DataFrame(user_factors, index=ratings.index).round(2))

    print("\nMovie factors:")
    print(pd.DataFrame(movie_factors, columns=ratings.columns).round(2))

    # Reconstruct estimated residuals, then add movie averages back to convert
    # residuals into predicted 1-to-5 ratings.
    predicted_residuals = user_factors @ movie_factors
    predicted_rating_values = predicted_residuals + movie_averages.to_numpy()

    predicted_ratings = pd.DataFrame(
        predicted_rating_values,
        index=ratings.index,
        columns=ratings.columns,
    ).clip(lower=1, upper=5)

    print("\nPredicted rating matrix:")
    print(predicted_ratings.round(2))

    # Recommend only movies the target user has not already rated.
    original_user_ratings = ratings.loc[TARGET_USER]
    predicted_user_ratings = predicted_ratings.loc[TARGET_USER]
    unrated_movies = original_user_ratings[original_user_ratings.isna()].index
    recommendations = predicted_user_ratings[unrated_movies].sort_values(ascending=False)

    print(f"\nRecommendations for {TARGET_USER}:")
    print(recommendations.round(2))


if __name__ == "__main__":
    main()
