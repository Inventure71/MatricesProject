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
TARGET_USER_INDEX = 8
FACTOR_COUNT = 2


def build_ratings_table():
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


def table_to_json_values(table):
    return [
        [None if pd.isna(value) else float(value) for value in row]
        for row in table.to_numpy()
    ]


def calculate_demo_model():
    ratings = build_ratings_table()

    global_average = float(ratings.stack().mean())
    movie_averages = ratings.mean(axis=0)
    movie_averages = movie_averages.fillna(global_average)

    known_mask = ratings.notna().to_numpy()
    row_indices, col_indices = np.where(known_mask)
    known_ratings = ratings.to_numpy()[known_mask]
    known_movie_averages = movie_averages.to_numpy()[col_indices]
    residual_values = known_ratings - known_movie_averages

    sparse_entries = [
        {
            "row": int(row),
            "column": int(column),
            "rating": float(rating),
            "residual": float(residual),
        }
        for row, column, rating, residual in zip(
            row_indices, col_indices, known_ratings, residual_values
        )
    ]

    sparse_residual_matrix = csr_matrix(
        (residual_values, (row_indices, col_indices)),
        shape=ratings.shape,
    )

    svd = TruncatedSVD(n_components=FACTOR_COUNT, algorithm="arpack", random_state=42)
    user_factors = svd.fit_transform(sparse_residual_matrix)
    movie_factors = svd.components_

    predicted_residuals = user_factors @ movie_factors
    predicted_rating_values = predicted_residuals + movie_averages.to_numpy()

    predicted_ratings = pd.DataFrame(
        predicted_rating_values,
        index=ratings.index,
        columns=ratings.columns,
    ).clip(lower=1, upper=5)

    target_user = USERS[TARGET_USER_INDEX]
    unrated_movies = ratings.loc[target_user][ratings.loc[target_user].isna()].index
    recommendations = (
        predicted_ratings.loc[target_user, unrated_movies]
        .sort_values(ascending=False)
        .reset_index()
    )
    recommendations.columns = ["movie", "score"]

    residual_table = pd.DataFrame(
        sparse_residual_matrix.toarray(),
        index=ratings.index,
        columns=ratings.columns,
    )

    residual_display = residual_table.mask(ratings.isna())

    return {
        "users": USERS,
        "movies": MOVIES,
        "targetUserIndex": TARGET_USER_INDEX,
        "factorCount": FACTOR_COUNT,
        "ratings": table_to_json_values(ratings),
        "globalAverage": global_average,
        "movieAverages": [float(value) for value in movie_averages.to_numpy()],
        "residualMatrix": table_to_json_values(residual_display),
        "sparseEntries": sparse_entries,
        "singularValues": [float(value) for value in svd.singular_values_],
        "userFactors": user_factors.tolist(),
        "movieFactors": movie_factors.tolist(),
        "predictedRatings": predicted_ratings.to_numpy().tolist(),
        "recommendations": recommendations.to_dict(orient="records"),
    }


if __name__ == "__main__":
    import json

    print(json.dumps(calculate_demo_model(), indent=2))
