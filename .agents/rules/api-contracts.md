# API Contract & Explicit Field Rules

- **No Guessed Fallbacks**: Never add guessed fallback values or fallback chains (e.g. `obj.userId || obj._id || obj.id`, `obj.userName || obj.name`, `obj.userRole || obj.role`, `obj.userStatus || obj.status`).
- **Inspect Server Endpoints**: Check the exact server endpoint, controller, service, Mongoose schema, and `toJSON` transform to verify the true returned payload shape.
- **Strict Field Access**: Access exact fields from typed contracts directly (e.g. `m.userId`, `m.userName`, `m.userEmail`, `m.userRole`, `m.userStatus` for `Member`).
