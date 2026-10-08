# UI Avatar Rules

- **Common Opaque A–Z Fallback Colors**: All profile avatars and `<AvatarFallback>` elements across the entire application must use 100% solid (non-transparent) dynamic A–Z colors calculated deterministically from the user's name via `getAvatarColorByName(name)`.
- **No Background Bleed-Through**: Overlapping avatars in `<AvatarGroup>` must remain completely opaque with zero transparency bleed.
