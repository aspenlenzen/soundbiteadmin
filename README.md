# SoundBite Admin Dashboard

A local admin dashboard for managing SoundBite data, connected to the same
Supabase project as the SoundBite app (`zfxtdcagrejqujxcofrm`). Friendlier than
the Supabase table editor: search, filters, level badges in the app's own
vocabulary, and safe editing.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173. Supabase credentials live in `.env`
(the same publishable key the app uses — safe for client-side use).

## Pages

- **Sound Bites** — every rating with restaurant, level, room, tags, comment,
  and author. Stat tiles, a click-to-filter level distribution chart, search,
  room/user/restaurant/date-range filters, sortable columns (date, restaurant,
  level, user), CSV export. The edit modal uses the app's gradient sound-level
  slider and can re-link a bite to another restaurant or (admin only) another
  author.
- **Restaurants** — all cached restaurants with address, type, Sound Bite
  count, quarter-rounded average level, and Google ratings. Search plus
  city/type/level/bite-count filters, sortable columns, CSV export. Admin can
  edit name/type/address/contact fields and delete restaurants that have no
  bites (the FK protects the rest).
- **Users** — member profiles with per-user average level, last activity, and
  the app's "important tags". Users edit their own profile; admin edits any.
- Favorites — placeholder for later.

## Editing & permissions

Reads are public (matches the app's RLS). To edit or delete, sign in (top
right) with your SoundBite app account. Row-level security lets each user
change their own Sound Bites; the app owner's account (see
`src/lib/config.ts`) has an admin override policy and can edit or delete any
bite. Everything else shows read-only banners.

Times display in the timezone the rating was posted from (`rated_timezone`),
so "7:15 PM at the restaurant" stays 7:15 PM wherever you view it.

## Database notes

- Restaurant `rating_count` / `overall_average` and user `rating_count` are
  maintained by DB triggers, so edits and deletes here keep aggregates in sync.
- Migrations added from the dashboard (2026-07-24):
  `add_delete_own_ratings_policy` (users may delete their own ratings — there
  was previously no DELETE policy), `add_admin_manage_all_ratings_policies`
  and `add_admin_restaurant_and_profile_policies` (the admin account may
  update/delete any rating, edit/delete restaurants, and edit any profile).
- 2026-07-24: stale `Restaurants db.rating_count` / `overall_average` values
  (17 restaurants predating the triggers) were recomputed from `Ratings db`.
- The app's 7-level vocabulary, rooms, and tags are mirrored in
  `src/lib/levels.ts`, and the web slider in
  `src/components/SoundLevelSlider.tsx` mirrors the app's — keep both in step
  with the app's `SoundLevelSlider.tsx` / `biteOptions.ts`.
