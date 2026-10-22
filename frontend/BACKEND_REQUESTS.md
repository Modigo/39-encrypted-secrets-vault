# Backend requests from the frontend

The current API is in `backend/main.py`. These changes would let the UI match the approved mockups. Each one is listed with how the frontend works around it today.

## Must have

1. **Owner username in `GET /api/secrets`.** Rows only include `owner_id`, and there's no way to turn that into a name, so the Owner column and the owner filter can't show names. Please add `owner` (username) to each row.
   *Today:* names come from the seeded demo accounts. Any other owner shows as "User #id".
2. **`GET /api/secrets/{id}/grants`.** Without it, the Access control table can't show who currently has access.
   Suggested response: `[{ "username": "...", "permission": "read" | "write" }]`. Same rule as granting: owner only, otherwise 403.
   *Today:* the table shows the owner plus grants made in the current browser session.

## Nice to have

3. **`GET /api/users`** returning `[{ id, username }]`. This would power the "Grant access" member picker.
   *Today:* the picker suggests the demo accounts and accepts a typed username.
4. **`description` and `created_at` on secrets.** Add an optional `description` to `POST /api/secrets`, and include both fields in the list rows.
   *Today:* the Description field and the Created detail are hidden in real mode.
5. **Secret name in audit events.** Add a `secret_name` to `GET /api/audit`. Denied events are about secrets the user can't list, so the frontend can't look up their names.
   *Today:* the frontend shows names it already knows, otherwise "#id".
6. **Say what was denied.** Every denial is currently logged as `action: "access"`. Logging the attempted action instead (`read`, `rotate`, `grant`, `delete`) would make the audit log show `secret.read` vs `secret.rotate` like the mockup does.
