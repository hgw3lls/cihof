import { execFile } from 'node:child_process';
import { randomInt } from 'node:crypto';

/**
 * The display's own Wi-Fi: Windows' Mobile hotspot, turned on for a staff
 * connection where there is no museum network to reach the display on, and
 * off again when the connection closes.
 *
 * Staff join the hotspot from the staff computer (or a phone) with the name
 * and password the admin panel shows, and connect the staff portal to the
 * display at the hotspot's own address, which Windows always gives the
 * display: 192.168.137.1. The staff connection itself is unchanged: every
 * request is still signed with the pairing code (connection-auth.mjs). The
 * Wi-Fi password only keeps strangers off the hotspot; it is new each time.
 *
 * It is driven through Windows' own tethering API (Windows 10 and 11), from
 * Windows PowerShell, so nothing is installed. Windows only shares a hotspot
 * "from" a network connection the display has, even one with no internet,
 * such as an Ethernet cable to nothing in particular; with none at all it
 * refuses, and the panel says what to do (docs/windows-checklist.md).
 */

/** The hotspot's address on Windows; the staff connection's port is added to it. */
export const hotspotHost = '192.168.137.1';
export const hotspotName = 'CIHOF-Display';
const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** A Wi-Fi password easy to read off a screen and type: three groups of four. */
export function newWifiPassword() {
  const characters = Array.from({ length: 12 }, () => alphabet[randomInt(alphabet.length)]);
  return [0, 4, 8].map((at) => characters.slice(at, at + 4).join('')).join('-');
}

/** Whether this computer can have one at all. */
export function hotspotSupported(platform = process.platform) {
  return platform === 'win32';
}

const quote = (text) => `'${String(text).replaceAll("'", "''")}'`;

// Finds a connection Windows will share and the tethering manager for it.
// Prints one line of JSON either way, as the steps after it do.
const prelude = String.raw`
$ErrorActionPreference = 'Stop'
function Say($value) { $value | ConvertTo-Json -Compress; exit 0 }
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $methods = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 }
  $asOperation = $methods | Where-Object { $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation${'`'}1' } | Select-Object -First 1
  $asAction = $methods | Where-Object { $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' } | Select-Object -First 1
  function Await($operation, [Type]$type) { $task = $asOperation.MakeGenericMethod($type).Invoke($null, @($operation)); $null = $task.Wait(60000); $task.Result }
  function AwaitAction($operation) { $task = $asAction.Invoke($null, @($operation)); $null = $task.Wait(60000) }
  $null = [Windows.Networking.Connectivity.NetworkInformation, Windows.Networking.Connectivity, ContentType = WindowsRuntime]
  $null = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager, Windows.Networking.NetworkOperators, ContentType = WindowsRuntime]
  $null = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringAccessPointConfiguration, Windows.Networking.NetworkOperators, ContentType = WindowsRuntime]
  $null = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringOperationResult, Windows.Networking.NetworkOperators, ContentType = WindowsRuntime]
  $candidates = @([Windows.Networking.Connectivity.NetworkInformation]::GetInternetConnectionProfile()) + @([Windows.Networking.Connectivity.NetworkInformation]::GetConnectionProfiles()) | Where-Object { $_ -ne $null }
  $manager = $null
  $why = 'none'
  foreach ($candidate in $candidates) {
    $capability = "$([Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::GetTetheringCapabilityFromConnectionProfile($candidate))"
    if ($capability -ne 'Enabled') { $why = $capability; continue }
    try { $manager = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::CreateFromConnectionProfile($candidate); break } catch { $why = $_.Exception.Message }
  }
  if (-not $manager) { Say @{ ok = $false; reason = $why } }
`;
const ending = String.raw`
} catch {
  Say @{ ok = $false; reason = 'error'; message = $_.Exception.Message }
}
`;

/** The PowerShell that turns the hotspot on with this name and password, or finds it already on. */
export function startScript({ name, password }) {
  return `${prelude}
  if ("$($manager.TetheringOperationalState)" -eq 'On') {
    $current = $manager.GetCurrentAccessPointConfiguration()
    Say @{ ok = $true; alreadyOn = $true; name = $current.Ssid; password = $current.Passphrase }
  }
  $configuration = New-Object Windows.Networking.NetworkOperators.NetworkOperatorTetheringAccessPointConfiguration
  $configuration.Ssid = ${quote(name)}
  $configuration.Passphrase = ${quote(password)}
  AwaitAction ($manager.ConfigureAccessPointAsync($configuration))
  $result = Await ($manager.StartTetheringAsync()) ([Windows.Networking.NetworkOperators.NetworkOperatorTetheringOperationResult])
  Say @{ ok = ("$($result.Status)" -eq 'Success'); reason = "$($result.Status)"; message = $result.AdditionalErrorMessage; alreadyOn = $false; name = ${quote(name)}; password = ${quote(password)} }
${ending}`;
}

export function stopScript() {
  return `${prelude}
  if ("$($manager.TetheringOperationalState)" -ne 'On') { Say @{ ok = $true } }
  $result = Await ($manager.StopTetheringAsync()) ([Windows.Networking.NetworkOperators.NetworkOperatorTetheringOperationResult])
  Say @{ ok = ("$($result.Status)" -eq 'Success'); reason = "$($result.Status)"; message = $result.AdditionalErrorMessage }
${ending}`;
}

/** Why Windows would not, in the words staff need. */
export function hotspotProblem({ reason, message } = {}) {
  const said = message ? ` (Windows said: ${message})` : '';
  switch (reason) {
    case 'none':
      return 'Windows will only make a hotspot from a network connection this display has, and it has none. Plug an Ethernet cable into it (it need not reach the internet), or see "The display\'s own Wi-Fi" in the Windows checklist.';
    case 'DisabledByGroupPolicy':
      return 'This computer\'s settings forbid a Mobile hotspot (group policy). Whoever looks after the museum\'s computers can allow it.';
    case 'DisabledByHardwareLimitation':
    case 'WiFiDeviceOff':
      return `This display's Wi-Fi is off or cannot make a hotspot. In Windows, turn Wi-Fi on (it need not join a network) and try again.${said}`;
    case 'DisabledBySku':
    case 'DisabledBySystemCapability':
    case 'DisabledByOperator':
    case 'DisabledByRequiredAppNotInstalled':
    case 'DisabledDueToUnknownCause':
      return `Windows will not make a hotspot on this display (${reason}).${said}`;
    case 'EntitlementCheckFailure':
    case 'EntitlementCheckTimeout':
    case 'OperationInProgress':
    case 'NetworkLimitedConnectivity':
      return `Windows was busy and did not start the hotspot. Try again in a moment.${said}`;
    case 'MaxClientsConnected':
      return 'Too many devices are on the display\'s Wi-Fi already.';
    case 'error':
      return `The hotspot could not be started.${said}`;
    default:
      return `The hotspot did not start (${reason ?? 'no reason given'}).${said}`;
  }
}

function powershell(script, timeout = 90_000) {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], { windowsHide: true, timeout }, (error, stdout) => {
      const line = String(stdout ?? '').trim().split(/\r?\n/).filter(Boolean).pop();
      try { resolve(JSON.parse(line ?? '')); } catch { reject(new Error(error ? `Windows PowerShell did not run: ${error.message}` : 'Windows PowerShell gave no answer.')); }
    });
  });
}

/**
 * The hotspot, as the staff connection uses it. `run` runs a script and
 * returns what it printed (PowerShell on Windows; a stand-in in tests).
 */
export function createHotspot({ run = powershell, platform = process.platform } = {}) {
  /** What we turned on, so we never turn off a hotspot somebody else started. */
  let ours = null;
  return {
    supported: hotspotSupported(platform),
    /** Turns it on with a new password, and says how to join it. */
    async start() {
      if (!hotspotSupported(platform)) throw new Error('The display\'s own Wi-Fi is only available on Windows.');
      const answer = await run(startScript({ name: hotspotName, password: newWifiPassword() }));
      if (!answer?.ok) throw new Error(hotspotProblem(answer));
      const joined = { name: answer.name, password: answer.password, host: hotspotHost, startedHere: !answer.alreadyOn };
      ours = joined.startedHere ? joined : null;
      return joined;
    },
    /** Turns it off, if it was turned on here. */
    async stop() {
      if (!ours) return { stopped: false };
      ours = null;
      const answer = await run(stopScript());
      if (!answer?.ok) throw new Error(`The display's Wi-Fi hotspot did not turn off: ${hotspotProblem(answer)} Turn it off in Windows' settings (Network › Mobile hotspot).`);
      return { stopped: true };
    },
  };
}
