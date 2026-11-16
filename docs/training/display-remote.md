# The display remote: the display from a phone

*CIHOF Display Remote* is a phone app for staff, for Android and for
iPhone; both do the same. On the museum's network it reaches a display's staff connection, the same one the staff
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

It is never in an app store.

**Android.** The developer builds it (`npm run package:display-remote`) and
gives you `CIHOF-Display-Remote-….apk`. Copy it to the phone and open it;
Android asks once whether to allow installing apps from wherever you opened
it (Files, or a browser). Allow it, install, then turn that permission off
again.

**iPhone.** It comes by TestFlight, Apple's app for trying apps before they
are released, from the museum's own Apple developer account (the
administrator sets it up once: `apps/display-remote-iphone/README.md`). The
administrator invites you by email; install **TestFlight** from the App
Store, open the invitation on the phone, and install *CIHOF Display Remote*
from TestFlight. On the home screen it is called *CIHOF Remote*. The first
time you connect, the iPhone asks whether it may find devices on your local
network: choose **Allow**, or it cannot reach the display. A TestFlight
build stops working after 90 days; TestFlight offers the next one before
then.

## Using it

1. **On the display**, in the admin panel: **Staff connection**, choose for
   how long, **Open a staff connection**. It shows an address and a code.
2. **On the phone**, on the museum's Wi-Fi (not mobile data): open *CIHOF
   Display Remote*, type the address and the code, **Connect**. Working the
   key out from the code takes a second or two. The phone remembers the
   address; it never keeps the code, which changes every time the
   connection is opened.

   Where the display cannot reach the museum network, open the connection
   on the display with **Open on the display's own Wi-Fi** instead. It
   shows a Wi-Fi name and password as well as the code. Join that Wi-Fi on
   the phone (if the phone says the Wi-Fi has no internet, stay on it
   anyway),
   then in the app choose **On the display's own Wi-Fi**, which fills in
   the address, and type the code.
3. It shows what the display shows. **Ask it again** to refresh.
4. To put an update on it: **Choose a display update…** and pick the file
   (copied to the phone, or on a drive it can reach, such as the museum's
   shared drive; on an iPhone, saved in Files or sent to it by AirDrop). Keep the app open while it sends: an update with a film
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
undo their change. The apply buttons stay off until you tick (on an
iPhone, switch on) **Apply it anyway**. Do that only if you are sure;
otherwise make the update again in the staff portal, from what the display
shows now.

## When something is refused

| It says | What to do |
| --- | --- |
| No display answered at … | Check the address against the admin panel, that the phone is on the museum's Wi-Fi (or the display's own, if it was opened that way), and that the connection is still open. On an iPhone, check too that the app may use the local network: Settings › Privacy & Security › Local Network › *CIHOF Remote* on. |
| The display did not accept the pairing code | Type the code the admin panel shows now; it changes each time the connection is opened. Check the phone shows the right time: the two clocks must agree to within two minutes. After a dozen wrong tries the display closes the connection itself; open it again. |
| The display stopped answering | Its connection closed (its time ran out, or somebody closed it). Open it again and reconnect. |
| The display will not take it | The file is not a display update, or is damaged. Make it again in the staff portal. |

Nothing the phone sends is secret, but every request and every answer is
signed with the code, so nobody else on the network can send the display
an update or pretend to be it.
