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
2. **Make your changes, check them and save them** in the portal.
3. **Make a display update.**
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
  display…**); after that, **Display update › Connect to the display**, then
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

## 3. Make your changes

The home page lists everything that can be changed. Each change is made one
item at a time, in plain words, and kept on this computer as you go: closing
the app loses nothing. Only what the records say, never more.

| To… | Use |
| --- | --- |
| Approve a profile, or correct its name, tags or lines | **Profiles** |
| Correct a biography | **Biographies** |
| Give somebody a new portrait, add a film, take a film off the display | **Portraits and films** |
| Add this year's class | **New inductees** (section 5) |
| Rename a place, change its words, tie somebody to it, add a place | **Places** |
| Approve, edit, add or delete a tour | **Tours** |
| Decide what two people's connection is | **Connections** |
| Name a film, choose where a ceremony film starts, fix its captions | **Film titles**, **Where ceremony films start**, **Film captions and transcripts** |
| The words on the attract screen | **Attract screen words** |

Then **Check and save**: the app checks every change with the same tools
that built the exhibit, and says plainly if anything needs fixing. **Save**
writes them into the portal's copy, each kind of change under your name.
Nothing has changed on the display yet.

## 4. Make a display update, and put it on the display

**Make a display update** (from the save page, or the foot of the home
page). Add a line saying what changed, for whoever loads it. The portal
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
2. **New inductees › Add an inductee…** for each person, from the Hall of
   Fame's own record of the induction: the full name, how it is alphabetised
   (the app suggests it; check it), the class year, the region, who inducted
   them, the biography in the Hall of Fame's own words, their page on its
   website, their communities, honours and countries, and a portrait with a
   description of it. Tick that the museum may show the portrait; a new
   inductee is added only with one it may show.
3. **Check and save**, then **Make a display update** and put it on the
   display (section 4).
4. Then, as for everybody else: approve their profiles (**Profiles**), write
   what they are honoured for (the profile editor), add their films
   (**Portraits and films**), and make another display update.

## 6. A new film

**Portraits and films**, choose the person, **Add a film…**. You need the
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
| **Check and save** finds a problem | Read what it says; it names the item. Fix it, or clear that choice, and check again. |
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
   the display shows; Profiles, edit the name; check and save; make a
   display update; send or carry it; apply at the next reset.)*
2. The display says your update was made from an earlier version. Why, and
   what now? *(Somebody changed the display since you started. Start again
   from what it shows, and make your change again.)*
3. An update went on and something looks wrong. *(Content › Versions kept:
   show the previous version, or go back to the delivered content.)*
4. Can you work on the content at home? *(Yes: export to a stick, open it in
   the portal, bring the update back.)*
5. Where can a film go? *(The display only. Never the website or a public
   link.)*
