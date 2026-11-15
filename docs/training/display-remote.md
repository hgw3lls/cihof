# The display remote: the display from a phone

*CIHOF Display Remote* is an Android app for staff. On the museum's
network it reaches a display's staff connection, the same one the staff
portal uses, and does two things:

- shows **what the display shows**: the version of the exhibit's content it
  serves, who made it and when, and the updates it has had;
- **puts a display update on it**: a `cihof-update-….cihof` file made with
  **Make a display update** in the staff portal. The display checks it
  exactly as one loaded from a USB stick and says what it would change
  before anything is applied.

It changes nothing else. Biographies, portraits, films, tours and places
are changed in the staff portal on the staff computer, and approved there.
The phone carries no content of its own.

## Installing it

The developer builds it (`npm run package:display-remote`) and gives you
`CIHOF-Display-Remote-….apk`. It is never in an app store. Copy it to the
phone and open it; Android asks once whether to allow installing apps from
wherever you opened it (Files, or a browser). Allow it, install, then turn
that permission off again.

## Using it

1. **On the display**, in the admin panel: **Staff connection**, choose for
   how long, **Open a staff connection**. It shows an address and a code.
2. **On the phone**, on the museum's Wi-Fi (not mobile data): open *CIHOF
   Display Remote*, type the address and the code, **Connect**. Working the
   key out from the code takes a second or two. The phone remembers the
   address; it never keeps the code, which changes every time the
   connection is opened.
3. It shows what the display shows. **Ask it again** to refresh.
4. To put an update on it: **Choose a display update…** and pick the file
   (copied to the phone, or on a drive it can reach, such as the museum's
   shared drive). Keep the app open while it sends: an update with a film
   in it can take several minutes.
5. Read what the display says about it. Then **Apply at the next reset**:
   the display takes it over the next time it returns to its attract screen,
   so nobody is interrupted. **Apply and show now** only if nobody is using
   the display.
6. **Look at the display.** Then, in the admin panel, close the staff
   connection if you are finished (it also closes itself when its time is
   up).

If the display says the update was **made from an earlier version**,
somebody changed the display since the update was made: applying it would
undo their change. The apply buttons stay off until you tick **Apply it
anyway**. Do that only if you are sure; otherwise make the update again in
the staff portal, from what the display shows now.

## When something is refused

| It says | What to do |
| --- | --- |
| No display answered at … | Check the address against the admin panel, that the phone is on the museum's Wi-Fi, and that the connection is still open. |
| The display did not accept the pairing code | Type the code the admin panel shows now; it changes each time the connection is opened. Check the phone shows the right time: the two clocks must agree to within two minutes. After a dozen wrong tries the display closes the connection itself; open it again. |
| The display stopped answering | Its connection closed (its time ran out, or somebody closed it). Open it again and reconnect. |
| The display will not take it | The file is not a display update, or is damaged. Make it again in the staff portal. |

Nothing the phone sends is secret, but every request and every answer is
signed with the code, so nobody else on the network can send the display
an update or pretend to be it.
