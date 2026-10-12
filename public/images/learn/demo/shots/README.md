# Pictures for the walkthrough demos

A walkthrough step can show a PICTURE of the Studio instead of driving the
live Studio in the pop-out. Put the image here and name it on the step:

    { shot: "/images/learn/demo/shots/studio-template-1.jpg",
      eyebrow: "Studio", title: "Welcome to the Studio", body: "..." }

A step with a `shot` ignores `target`, `open`, `select` and `href`: there is
nothing to load, open, select or scroll, so it arrives at once and looks the
same every time. A step without one stays live, so a walk can be converted a
step at a time.

## Taking them

Shoot from the training account (/demo?go=1&brand=demo), which wears Rimberio
Homes and carries no "You're in the demo" badge. Capture the Studio at a
window about 1400px wide and crop to what the step is about.

Name them `<walk-id>-<step number>.jpg` so it is obvious which step a picture
belongs to when one needs replacing.

## The trade

The live frame updates itself: change the Studio and the demo changes with
it. A picture does not, and nothing will tell you it has gone stale. That is
the cost of it being reliable, and it was Dani's call on 12 Oct after a
morning of the live version misbehaving.
