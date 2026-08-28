# API E2E for the organizer problems module. Prereqs, in order:
#   docker compose up -d
#   pnpm db:migrate
#   pnpm start           # in another terminal
#   pnpm hurl
#
# No auth guard yet on these routes (see #10's Contexto) — the epic Auth
# protects them in a later, dedicated task.

# 1. Create -> draft, points defaults to 100.
POST {{host}}/organizer/problems
Content-Type: application/json
{ "difficulty": "easy" }
HTTP 201
[Captures]
problem_id: jsonpath "$.id"
[Asserts]
jsonpath "$.status" == "draft"
jsonpath "$.points" == 100
jsonpath "$.testCases" count == 0
jsonpath "$.translations" count == 0

# 2. Malformed difficulty -> kata's automatic validation envelope.
POST {{host}}/organizer/problems
Content-Type: application/json
{ "difficulty": "impossible" }
HTTP 422
[Asserts]
jsonpath "$.error" == "validation_failed"

# 3. Patch in only the pt translation.
PATCH {{host}}/organizer/problems/{{problem_id}}
Content-Type: application/json
{ "translations": [ { "locale": "pt", "title": "Soma", "statementMd": "Some dois números." } ] }
HTTP 200
[Asserts]
jsonpath "$.translations" count == 1

# 4. Publish -> rejected, lists the missing locales.
POST {{host}}/organizer/problems/{{problem_id}}/publish
HTTP 400
[Asserts]
jsonpath "$.error" == "incomplete_translations"
jsonpath "$.message" == "Missing translations for locale(s): es, en"

# 5. Patch in the remaining translations and a single visible test case.
PATCH {{host}}/organizer/problems/{{problem_id}}
Content-Type: application/json
{
  "translations": [
    { "locale": "es", "title": "Suma", "statementMd": "Suma dos números." },
    { "locale": "en", "title": "Sum", "statementMd": "Sum two numbers." }
  ],
  "testCases": [ { "input": [1, 2], "expected": 3, "hidden": false } ]
}
HTTP 200
[Asserts]
jsonpath "$.translations" count == 3
jsonpath "$.testCases" count == 1

# 6. Publish -> rejected, still missing a hidden test case.
POST {{host}}/organizer/problems/{{problem_id}}/publish
HTTP 400
[Asserts]
jsonpath "$.error" == "missing_test_cases"

# 7. Patch in a hidden test case alongside the visible one.
PATCH {{host}}/organizer/problems/{{problem_id}}
Content-Type: application/json
{
  "testCases": [
    { "input": [1, 2], "expected": 3, "hidden": false },
    { "input": [2, 2], "expected": 4, "hidden": true }
  ]
}
HTTP 200
[Asserts]
jsonpath "$.testCases" count == 2

# 8. Publish -> succeeds now that translations and test case coverage are complete.
POST {{host}}/organizer/problems/{{problem_id}}/publish
HTTP 200
[Asserts]
jsonpath "$.status" == "published"

# 9. GET the detail -> reflects the published state.
GET {{host}}/organizer/problems/{{problem_id}}
HTTP 200
[Asserts]
jsonpath "$.status" == "published"
jsonpath "$.testCases" count == 2

# 10. GET the list -> includes it with the right testCaseCount.
GET {{host}}/organizer/problems
HTTP 200
[Asserts]
jsonpath "$[?(@.id=='{{problem_id}}')].testCaseCount" == 2
jsonpath "$[?(@.id=='{{problem_id}}')].status" == "published"

# 11. Archive -> terminal state.
POST {{host}}/organizer/problems/{{problem_id}}/archive
HTTP 200
[Asserts]
jsonpath "$.status" == "archived"

# 12. Publish on an archived problem -> conflict.
POST {{host}}/organizer/problems/{{problem_id}}/publish
HTTP 409
[Asserts]
jsonpath "$.error" == "archived_problem"

# 13-16. Every route on an unknown id -> 404.
GET {{host}}/organizer/problems/00000000-0000-0000-0000-000000000000
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

PATCH {{host}}/organizer/problems/00000000-0000-0000-0000-000000000000
Content-Type: application/json
{ "difficulty": "hard" }
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

POST {{host}}/organizer/problems/00000000-0000-0000-0000-000000000000/publish
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"

POST {{host}}/organizer/problems/00000000-0000-0000-0000-000000000000/archive
HTTP 404
[Asserts]
jsonpath "$.error" == "not_found"
