# The staff portal: looking after the exhibit's content

For whoever keeps the Hall of Fame display up to date: correcting a
biography, adding this year's class, a new portrait or film, a tour, a
place. About thirty minutes to read, best with the display and the staff
computer side by side. Nothing here needs a developer.

The staff guide (`STAFF-GUIDE.md` beside each release) has the reference
detail; section names below point into it. The handover checklist
(`handover-checklist.md`) is what to work through on the first day.

**The one idea to hold on to:** the display keeps every version of its
content, and the content it was delivered with. Whatever you do in the
portal, the display checks it before showing it, and you can always go back.

---

## 1. Two apps, one routine

- **The display** runs *CIHOF Exhibit*. Its admin panel (hold the top-left
  corner for five seconds, or press **Ctrl + Shift + A**, then the passcode)
  is where content arrives, and where you go back.
- **The staff computer** runs *CIHOF Staff Portal*. It is where content is
  changed. It works on its own copy of what the display shows, so you can
  use it anywhere, in the building or not.

The routine, every time:

1. **Start from what the display shows.**
2. **Make your changes on the exhibit**, in the portal's studio, and
   approve them.
3. **Publish**: make a display update.
4. **Put it on the display**: send it over the network, or carry it on a
   USB stick.
5. **Look at the display.** Go back if anything is wrong.

## 2. Start from what the display shows

Always start from what the display shows now, so nobody's changes are lost.
Two ways:

- **Over the network** (in the building). On the display, in the admin
  panel: **Staff connection**, choose for how long, **Open a staff
  connection**. It shows an address and a code. In the portal: the first
  time, **Connect to a display** on the start page (or **File › Connect to a
  display…**); after that, **The display › Connect to the display**, then
  **Start from what it shows now**. Type the address and the code exactly as
  the display shows them; the code changes every time the connection is
  opened.
- **On a USB stick** (anywhere). On the display: **Content › Export current
  content…** to the stick. In the portal: **File › Open a display's
  content…** and choose the file.

The portal's window title says **CIHOF staff portal** once it is working on
a display's content.

If you have saved changes that are not yet in a display update, the portal
asks before starting again, because starting again replaces them. Make a
display update first if you want to keep them.

## 3. Make your changes, on the exhibit itself

The portal opens on the **studio**: the exhibit itself, exactly as the
display will show it, beside a panel for editing. Use it as a visitor would
in **Preview**; switch to **Edit** to change things.

In **Edit**, everything that can be changed is outlined. Touch it, and it
opens in the panel beside the exhibit:

| Touch… | To change |
| --- | --- |
| A person's name block (on their profile or the panel from the wall) | their name, how it is alphabetised, communities, honours, countries, the portrait's description, the biography |
| Their portrait | a new picture: choose it, describe it, confirm the museum may show it |
| **Watch the film** | their films: take one off the display, or **Add a film…** |
| The attract screen's words | the headline and the line beneath |
| A tour card (in **Tour**) | the tour's words, rules and people |
| A place's panel (in **Connections**, places) | its name, neighbourhood, words and the people tied to it |

To add something, use the bar above the exhibit: **+ Inductee**, **+ Tour**,
**+ Place**.

**Save** writes the change into the portal's copy and shows it on the
exhibit at once, under your name. **Undo** takes back the last change.
Nothing has changed on the display yet.

**Every change waits for approval.** The bar says how many are waiting;
touch it, look at each change on the exhibit, and **Approve** it. The same
person may approve, as a second, deliberate look. Nothing is published while
any change is waiting.

**To review** lists what the research holds that somebody must decide before
visitors see it (profiles not yet approved, connections, places, tours, film
titles, sign-offs); each opens its screen in **All items**. **All items**
also has every screen card by card, for working through many at once
(approving profiles in a row, say). Changes made there are saved with
**Check and save**, as before.

## 4. Publish to the display

**The display**, at the right of the bar, opens the display panel: where
the portal's copy came from, what is saved since the last update, and the
connection. When nothing is waiting for approval, **Make a display update**.
Add a line saying what changed, for whoever loads it. The portal
builds the display's content from its copy, exactly as the exhibit is
built, and writes one file (`cihof-update-….cihof`) to **Documents › CIHOF
display updates**. It carries only what the display does not already have.

Then either:

- **Send it to the display** (connected over the network). The display
  checks it and says what it changes. Choose **Apply at the next reset**:
  the display takes it over the next time it returns to its attract screen,
  so nobody is interrupted. **Apply and show now** only if nobody is using
  the display.
- **Or carry it**: copy the file to a USB stick; on the display, **Content ›
  Load a content update…**, read what it says, then **Apply at the next
  reset** or **Apply and show now**.

If the display says the update was **made from an earlier version**,
somebody else changed the display since you started. Applying it would undo
their change. Start again from what the display shows (section 2) and make
your change again; apply it anyway only if you are sure.

## 5. Each year: the new class

1. **Start from what the display shows** (section 2).
2. **+ Inductee** in the studio (or **All items › New inductees**) for each person, from the Hall of
   Fame's own record of the induction: the full name, how it is alphabetised
   (the app suggests it; check it), the class year, the region, who inducted
   them, the biography in the Hall of Fame's own words, their page on its
   website, their communities, honours and countries, and a portrait with a
   description of it. Tick that the museum may show the portrait; a new
   inductee is added only with one it may show.
3. Each opens on the exhibit once saved. Look at them there, approve them,
   add their films (touch **Watch the film**, or their portrait for a better
   picture), and publish (section 4).

## 6. A new film

In the studio, open the person and touch **Watch the film** (or, with no
films yet, choose them in **All items › Portraits and films**), then **Add a
film…**. You need the
film as an MP4, and its captions as a `.vtt` or `.srt` file (the captions
the video service made are a start; correct them). The app plays the film
(one that will not play here will not play on the display either), puts the
captions on it so you can check them, makes a transcript from them for you
to correct, and takes the poster from the moment you choose. Tick that the
museum may show it, that you checked the captions against it, and that you
checked the transcript. The display update carries the film.

A film is large: sending the update over the network, or copying it, takes
a while. Films are only ever for the display, never for the public website.

## 7. Going back

On the display, **Content › Versions kept** lists every update loaded (the
last ten) and **the content delivered with the app**, which is never
changed. **Show this version** shows any of them again; **Go back to it**
returns to the delivered content. Going back deletes nothing, so a newer
version can be shown again afterwards.

## 8. Working away from the museum

Export the display's content to a USB stick before you leave, and open it in
the portal wherever you are (section 2). Everything else works without a
network. Bring the display update back on the stick, or send it once you are
back in the building. If somebody changed the display while you were away,
the display says so when the update arrives (section 4).

## 9. Backups

- **After each update**, on the display: **Content › Export current
  content…**, and keep the file with the backups. It holds everything the
  display shows apart from the films folder, including any film an update
  brought.
- **The films folder** on the display: a copy on two external drives, one
  kept elsewhere. Refresh it when a film is added from outside the portal.
- **The installers** of the display and the portal, the current and the
  previous one, with the films backup.

All of these carry films and captions cleared for the display only: never on
a website, a public share or a link anybody can open. Staff guide, section 8.

## 10. When something is refused

| It says… | What to do |
| --- | --- |
| **Save** (or **Check and save**) finds a problem | Read what it says; it names the item. Fix it and save again. |
| **Make a display update** says changes are waiting | Approve them (the bar says how many), or undo them. |
| *it changed after you began editing it* | Somebody else changed it since. Discard your edit and make it again from how it is now. |
| *Nothing has changed since the last display update* | There is nothing new to send. |
| The display will not take an update | It names why: damaged, made for another exhibit, or a version this app cannot show. Make the update again from the portal; if it says the app needs updating, that needs a developer. |
| *made from an earlier version* | Section 4: start again from what the display shows. |
| The portal cannot connect | Check the address and the code against the display's admin panel (the code changes each time it is opened, and the connection closes when its time is up). The staff computer must be on the museum network; on the display, Windows may need to allow *CIHOF Exhibit* through its firewall. Or use a USB stick. |
| The connection closed by itself | Its time was up, or too many requests came without the right code. Open it again; it shows a new code. |

## 11. What still needs a developer

- **A new version of either app**, for example to change how the exhibit
  looks or behaves, or its own words (headings, buttons, instructions).
- **Publishing to the public website.** The website shows only what is
  approved for it, and is rebuilt from the project.
- **A person's id**, which never changes once given.

Everything about the content (people, words, portraits, films, places,
tours, connections, the new class) is in the portal.

---

## Check your understanding

1. Somebody spotted a misspelt name. What are the steps? *(Start from what
   the display shows; in the studio, open them and touch their name; correct
   it and save; approve it; make a display update; send or carry it; apply at
   the next reset.)*
2. The display says your update was made from an earlier version. Why, and
   what now? *(Somebody changed the display since you started. Start again
   from what it shows, and make your change again.)*
3. An update went on and something looks wrong. *(Content › Versions kept:
   show the previous version, or go back to the delivered content.)*
4. Can you work on the content at home? *(Yes: export to a stick, open it in
   the portal, bring the update back.)*
5. Where can a film go? *(The display only. Never the website or a public
   link.)*
