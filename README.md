
<h1 align="center">HomeFinder API</h1>
<h4 align="center">REST API backend for the HomeFinder property listing platform.</h4>

---

## Overview

HomeFinder API is a Node.js + Express REST API that powers the HomeFinder frontend. It handles authentication, property listings, reviews, saved listings, and image uploads via Cloudinary. All data is stored in MongoDB.

---

## Tech Stack

| Library | Purpose |
|---------|---------|
| Node.js + Express 5 | HTTP server and routing |
| MongoDB + Mongoose 8 | Database and ODM |
| Cloudinary + Multer | Image upload and cloud storage |
| JSON Web Tokens (JWT) | Auth tokens stored in httpOnly cookies |
| bcryptjs | Password hashing |
| cookie-parser | Cookie parsing middleware |
| cors | Cross-origin request support |
| dotenv | Environment variable loading |

---

## Project Structure

```
src/
  index.js          # App entry — connects MongoDB, registers routes, starts server
  models/
    User.js         # User schema (name, email, hashed password, avatar)
    Listing.js      # Property listing schema
    Review.js       # Review schema (linked to listing + user)
    SavedListing.js # Saved/bookmarked listing (linked to user + listing)
  routes/
    auth.js         # Register, login, logout, forgot/reset password, profile update
    listings.js     # CRUD for listings, image upload, search & filter
    reviews.js      # Create, read, delete reviews; updates listing avgRating
    saved.js        # Save/unsave listings, get saved list for current user
  middleware/
    auth.js         # JWT protect middleware — verifies httpOnly cookie
    upload.js       # Multer + Cloudinary storage config
  utils/
    cloudinary.js   # Cloudinary SDK config
```

---

## API Routes

### Auth — `/api/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | No | Create a new account |
| POST | `/login` | No | Login and set JWT cookie |
| POST | `/logout` | No | Clear JWT cookie |
| GET | `/me` | Yes | Get current logged-in user |
| PUT | `/update-profile` | Yes | Update name / avatar |
| PUT | `/update-password` | Yes | Change password |
| POST | `/forgot-password` | No | Send password reset email |
| POST | `/reset-password/:token` | No | Reset password via token |

### Listings — `/api/listings`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | No | Get all listings (cursor-based pagination) |
| GET | `/search` | No | Search and filter listings |
| GET | `/offers` | No | Get listings with offer prices |
| GET | `/category/:type` | No | Get listings by rent or sale |
| GET | `/:id` | No | Get a single listing |
| POST | `/` | Yes | Create a listing (multipart, images) |
| PUT | `/:id` | Yes | Update a listing (owner only) |
| DELETE | `/:id` | Yes | Delete a listing (owner only) |
| GET | `/user/:userId` | No | Get all listings by a user |

### Reviews — `/api/reviews`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/:listingId` | No | Get reviews for a listing |
| POST | `/:listingId` | Yes | Add a review |
| DELETE | `/:reviewId` | Yes | Delete own review |

### Saved Listings — `/api/saved`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | Get current user's saved listings |
| POST | `/:listingId` | Yes | Save a listing |
| DELETE | `/:listingId` | Yes | Unsave a listing |

---

## Pagination

All list endpoints use cursor-based pagination:

- **Request:** `?limit=8&cursor=<lastId>`
- **Response:** `{ listings, hasMore, nextCursor }`

The frontend fetches `limit + 1` items, pops the last one to determine `hasMore`, and stores `nextCursor` for the next page request.

---

## Image Uploads

- Max 6 images per listing, 2 MB each
- Sent as `multipart/form-data`
- Stored on Cloudinary with auto-resize
- Existing images can be deleted individually when editing a listing

---

## Environment Variables

Create a `.env` file in the project root:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

CLIENT_URL=http://localhost:5173

EMAIL_HOST=smtp.your-provider.com
EMAIL_PORT=587
EMAIL_USER=your_email
EMAIL_PASS=your_email_password
```

---

## Run Locally

### Prerequisites

- Node.js 20+
- MongoDB (local or Atlas)
- Cloudinary account

### Steps

```bash
git clone https://github.com/Mudassirkhan2/HomeFinder-backend.git
cd HomeFinder-backend
npm install
```

Create your `.env` file as described above, then:

```bash
npm run dev
```

The API will be available at `http://localhost:5000`.

---

## Related

- **Frontend:** [HomeFinder](https://github.com/Mudassirkhan2/HomeFinder)
- **Live Site:** [home-finder-khan.vercel.app](https://home-finder-khan.vercel.app/)
