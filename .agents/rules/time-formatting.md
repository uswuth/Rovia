# Time and Date Formatting Rules

- **Use Global Time Formatter**: Never use ad-hoc `toLocaleTimeString()`, `toLocaleDateString()`, or raw `Date` string manipulations for user-facing timestamps or dates.
- **Respect Profile Settings (12h vs 24h)**: All time displays, timestamps (including in-meeting chat, participant activity, schedules, timers, and logs), must use `useTimeFormat()` from `@/context/TimeFormatContext`.
- **Formatting APIs**:
  - Use `formatTimeStr(date)` for time-only displays (e.g. chat messages: `12:23 AM` or `00:23` based on user profile preference).
  - Use `formatDateTimeStr(date)` for date + time displays (e.g. `Oct 12, 12:23 AM` or `Oct 12, 00:23`).
