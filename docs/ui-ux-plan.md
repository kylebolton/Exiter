# Exiter UI and interaction plan

Exiter should feel consistent from the first paint to the last click. Keep the rail compact, use motion to show a change in state, and give each app-owned action a clear response. X owns its signed-in controls and their data.

## Delivery

1. Improve the shared shell. Use the same focus treatment and motion timings across navigation, posts, tabs, dialogs, refresh and the palette. Keep operating-system reduced motion active during route changes, scrolling and refresh.
2. Make Settings easier to scan and operate. Add section shortcuts, preserve focused controls during writes, show save errors and ask before resetting preferences.
3. Add optional desktop notifications. Watch X’s existing unread indicator while Exiter runs, establish a baseline on launch or account change, and open Notifications when an alert is clicked. Include a test button in Settings.
4. Verify the signed-in flows and package builds. Use a test account for any action that creates or modifies content. Run in light and dark mode, at the minimum window size and under increased zoom, with a mouse and keyboard.

## Click and section audit

The Electron fixture passed when launched in the macOS desktop session. It covers 90 layout cases plus media, palette, unread badges and Settings interactions. Isolated checks of notification gating, click-through and reset effects also passed. The table records fixture coverage and the remaining live checks.

| Surface | Checks | Verification |
| --- | --- | --- |
| Sidebar and account | Home, Explore, Notifications, Chat, Profile, More, Post, account switcher and optional destinations. Check active state, hover and focus, cancelled press and single navigation. | Fixture covers the rail at different widths, badges, Post icon and cancelled press. Live destinations and account switching need a signed-in pass. |
| Timeline and post detail | Feed tabs, Manage timelines, Show posts, Refresh, article links, like, reply, repost, bookmark, share, overflow and analytics. Check in-flight state, menus and focus return. | Fixture covers layout and media close. Live timeline refresh and engagement actions need a signed-in pass. |
| Search and Explore | Focus search, submit, clear, choose a suggestion, switch result tabs and view empty results. | Needs a signed-in pass. |
| Composer and replies | Open, type, attach media, pick a GIF or emoji, create a poll, schedule, cancel, confirm and post using a test account. | Fixture covers the ordinary dialog body. Live composer actions need a signed-in pass. |
| Media and profile | Click avatar, banner and post media, use paging controls, open reply panel, close by click or Escape, and check profile header and tabs at narrow and wide widths. | Fixture covers sizing, profile layout and mouse and keyboard close. Media paging and profile actions need a signed-in pass. |
| Notifications and Chat | Open from rail, navigate tabs and threads, verify badge updates, and test unread activity in background with alerts off and on. | Fixture covers unread increases, decreases, disabled alerts and account changes. Live badge markup, delivery and alert clicks need a signed-in packaged pass. |
| Palette | Open and close with the shortcut, Escape, close button and backdrop. Exercise arrow navigation, Enter, clicks, search, theme, count and ad toggles, updates, settings, back and forward, and focus return. | Fixture covers opening, arrows, click to close and focus return. Remaining paths need a live pass. |
| Settings | Appearance, Text, Layout, Content, Sidebar, App, Notifications and Updates. Exercise every option, switch and slider, section links, test alert, update check, reset cancel and confirm. | Fixture covers the controls and IPC wiring. Persisted settings, launch at login, packaged updates and out-of-process effects need a desktop pass. |
| Window, menus and offline | Tray and application menus, global shortcuts, close-to-tray, restore, reload, retry and network recovery to the interrupted route. | Needs an interactive desktop pass. |
| Accessibility and packaging | Check visible focus, system reduced motion, zoom and clipping. Send a test alert, background the app, receive activity and click through on signed macOS and installed Windows and Linux builds. | Packaged and visual checks pending. |
