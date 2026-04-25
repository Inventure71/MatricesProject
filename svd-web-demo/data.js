const users = [
  "Ava",
  "Noah",
  "Mia",
  "Leo",
  "Sofia",
  "Ethan",
  "Lina",
  "Marco",
  "Iris",
  "You",
];

const userSegments = [
  "Sci-Fi loyalist",
  "Sci-Fi loyalist",
  "Action loyalist",
  "Action loyalist",
  "Comedy loyalist",
  "Comedy loyalist",
  "Romance loyalist",
  "Romance loyalist",
  "Bridge viewer",
  "You",
];

const userDescriptions = [
  "Mostly rates sci-fi high; gives low scores outside that lane.",
  "Another sci-fi-heavy viewer, with a few comedy and romance dislikes.",
  "Action-first viewer who still overlaps with sci-fi.",
  "Pure action taste, useful for separating action from sci-fi.",
  "Comedy-first viewer with a few middle romance scores.",
  "Another comedy fan, with low action and sci-fi ratings.",
  "Romance-first viewer, with mild comedy overlap.",
  "Another romance fan, useful for stabilizing the romance cluster.",
  "Bridge viewer who likes several categories and connects the groups.",
  "Sci-fi/action leaning profile; unrated action movies should become good recommendations.",
];

const categoryDescriptions = {
  "Sci-Fi": "Future, space, and mind-bending stories.",
  Action: "Fast, physical, high-intensity movies.",
  Comedy: "Light, funny, feel-good choices.",
  Romance: "Relationship-driven dramas and musicals.",
};

const movies = [
  "The Matrix",
  "Interstellar",
  "Inception",
  "Dune",
  "Mad Max",
  "John Wick",
  "Top Gun",
  "Dark Knight",
  "Grand Budapest",
  "Superbad",
  "Mean Girls",
  "Paddington 2",
  "Titanic",
  "The Notebook",
  "La La Land",
  "Pride & Prejudice",
];

const movieCategories = [
  "Sci-Fi",
  "Sci-Fi",
  "Sci-Fi",
  "Sci-Fi",
  "Action",
  "Action",
  "Action",
  "Action",
  "Comedy",
  "Comedy",
  "Comedy",
  "Comedy",
  "Romance",
  "Romance",
  "Romance",
  "Romance",
];

let ratings = [
  [5, 5, 4, 5, 3, null, 4, null, 2, null, null, null, null, null, 1, null],
  [5, 4, 5, 5, null, 3, 4, null, null, 2, null, null, null, null, 2, null],
  [4, null, null, 3, 5, 5, 4, 5, 2, null, null, null, 1, null, null, null],
  [null, null, null, 4, 5, 4, 5, 5, null, 1, null, null, null, 2, null, 1],
  [2, null, null, null, 2, null, null, null, 5, 5, 4, 5, 3, null, null, 3],
  [null, 1, null, null, null, 2, null, 1, 5, 4, 5, 5, null, 3, null, null],
  [1, null, null, null, 2, null, null, null, 3, null, null, null, 5, 5, 4, 5],
  [null, 2, null, null, null, 1, null, null, null, 3, 3, null, 5, 4, 5, 5],
  [4, null, 4, null, 4, null, null, 4, 4, null, null, 4, 4, null, 4, null],
  [5, 4, 5, null, 4, null, null, null, null, null, 2, 2, 2, 2, null, null],
];
