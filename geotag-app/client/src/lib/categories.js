/*
The canonical category list, matching the enum in server/models/memories.js.

Lifted out of the old ExplorePage when that was deleted — it was the only place the list
existed on the client, so it would have gone with it.

Category is optional on a memory, and most memories created before it was wired up have none
at all (it was in the schema but never read off the request). Anything filtering by category
must therefore treat "no category" as a real, selectable bucket rather than quietly excluding
it — otherwise the filter appears to lose historical data.
*/
export const CATEGORIES = [
  'Travel',
  'Nature',
  'Food',
  'Events',
  'People',
  'Milestones',
  'Culture',
  'Other',
];

// For <select> inputs on the add/edit forms.
export const CATEGORY_SELECT_OPTIONS = [
  { value: '', label: 'No category' },
  ...CATEGORIES.map((c) => ({ value: c, label: c })),
];

// For filter rows/chips, where the first entry means "don't filter".
export const CATEGORY_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  ...CATEGORIES.map((c) => ({ value: c, label: c })),
];
