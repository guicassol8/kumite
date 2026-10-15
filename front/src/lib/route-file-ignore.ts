// The router plugin reads every file in src/routes/ as a candidate route, and
// the *.test.tsx files that live next to their route export no `Route`: each
// one printed an 8-line "does not export a Route" warning on every dev boot,
// burying a real route that forgot its `Route` (#328). Renaming them with the
// "-" ignore prefix would split each test from its route alphabetically.
//
// @tanstack/router-generator compiles this as `new RegExp(pattern, 'g')` and
// matches it against the bare file name, not the path. The "-" prefix stays
// the plugin's default.
export const ROUTE_FILE_IGNORE_PATTERN = '\\.test\\.tsx?$'
