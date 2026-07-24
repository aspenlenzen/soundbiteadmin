// Accounts with the admin RLS override in Supabase (see the
// add_admin_manage_all_ratings_policies migration): these users can edit and
// delete ANY rating, not just their own. Keep in step with the policies.
export const ADMIN_USER_IDS = new Set(['ae69138c-9cfa-4736-b369-25219e31bcbc']);
