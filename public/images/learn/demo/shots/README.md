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

Never resize them. On a high-density screen the rig's picture comes out at
twice the frame's size (1680 wide for the 840 frame), and that is what keeps
it sharp when the demo stretches it across a wide pop-out. Pictures taken
between 13:51 and 17:10 on 12 Oct came out at 840 -- the rig shrank the frame
to fit the window -- and are soft; retake those.

A replacement picture gets a NEW name, never the old one. Cloudflare keeps
images for four hours, so a file swapped under the same name goes on being
served old to everyone -- the sharp Studio homepage did exactly that on 12 Oct
while the deploy check, which added a query string and so went round the
cache, said it was live. The full-resolution set is named `@2x`.

Name them `<walk-id>-<step number>.jpg` so it is obvious which step a picture
belongs to when one needs replacing.

## The trade

The live frame updates itself: change the Studio and the demo changes with
it. A picture does not, and nothing will tell you it has gone stale. That is
the cost of it being reliable, and it was Dani's call on 12 Oct after a
morning of the live version misbehaving.
