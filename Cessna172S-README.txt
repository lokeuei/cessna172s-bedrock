CESSNA 172S SKYHAWK v2.8.5 - Minecraft Bedrock

INSTALL / SHARE
Open Cessna172S-V2.8.5-ALL-IN-ONE.mcaddon. It contains BOTH the behavior
pack and resource pack, with matching dependency UUIDs and versions.
Enable both v2.8.5 packs in the world's settings and deactivate older Cessna
packs. Fully close and reopen Minecraft if it continues to show cached UI.
Requires Minecraft Bedrock 1.26.60+. The server and server-ui modules are
provided by Minecraft; no additional downloaded add-on is required.

FLIGHT TOOLKIT
Players receive the toolkit on their first join. Creative inventory includes
the aircraft spawn egg. Use the toolkit for spawning, airport operations,
aircraft reset, recovery, and toggling the G5 overlay.
W/S elevator; A/D roll; Space+A/D rudder; hotbar slots 1-9 throttle;
Shift exits. Slot 1 is idle/brakes on the ground.

G5 SCREEN OVERLAY
IAS (knots), altitude (feet), artificial horizon, heading, compass direction,
ground track, ground speed (knots), vertical speed (feet/min), and power.
The airspeed and altitude tapes scroll fixed textures. Horizon pitch scrolls
a cached image; roll selects one of 36 cached images in 10-degree steps.
This is not continuous arbitrary rotation of one texture.
20 instrument controls replace the previous 596. Telemetry updates at up to
5 Hz with a 2-second keepalive for unchanged values; physics stays at 20 Hz.
No frame-rate improvement percentage has been measured.

PILOT ATTACHMENT
Mouse orbit uses a separate follow-orbit camera with camera-relative input.
It is applied once on boarding so looking around does not reset each tick.
Corrected native seat height/forward offset, synchronized native aircraft
heading, locked forward body orientation, and compensated the rotated hip.
The bounded seated animation refreshes every four ticks and is released on
exit. Custom skins with different skeletons may need separate verification.

VERIFICATION
Observed the live overlay in Flight Test with two planes present, including
level and banked states. Verified the full cabin with the pilot inside.
Normal flight simulation restored after stationary diagnostic tests.
Automated coverage includes 420 telemetry/crop cases, flight/controls,
permission recovery, toolkit delivery, airport reset, and pack dependencies.

REMOVE OLD AVAILABLE PACKS
First deactivate the old pack in any world or Global Resources that uses it.
Go to Settings > Storage, expand Resource Packs or Behavior Packs, select
the unwanted old Cessna entry, and choose Delete. Keep the matching current
behavior/resource pair. Back up worlds before removing packs they require.
