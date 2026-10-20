# Hot Seat: Team Edition (demo)

A static, no-build demo of a 4-round team game: **Trivia, Word Heist, Pattern Lab, Sticky Board**. Each round is worth 25 points (5 items x 5 points), 100 in total.

- `index.html` is the game. It personalises itself from the link (nothing is stored):
  `?org=Acme&host=Zuri&mascot=🦓&color=ff6600&contact=you@yourdomain.com&name=Sam`
  - `org`: the prospect's name, `host`: the mascot's name (default Trollstradamus),
    `mascot`: an emoji or an https image URL, `color`: brand colour (hex without #), `contact`: email for the "Book a game" button.
- `make.html` builds these links and drafts a cold email.
- Deploy anywhere that serves static files (Netlify, Firebase Hosting, GitHub Pages).

The leaderboard in the demo is sample data. The trivia/word/logic/board content is generic; a real game would use questions written for each organisation.
