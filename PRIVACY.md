# FaceVFX privacy notes

FaceVFX is a client-side experimental demo. It has no application server, user account system, telemetry, advertising SDK, or built-in image-upload feature.

## Camera data

- Camera access requires an explicit browser permission grant.
- Video frames are processed in the current browser tab by MediaPipe and the local JavaScript pipeline.
- FaceVFX does not intentionally persist raw camera frames, photographs, or biometric templates.

## Local records and exports

- Recording is opt-in. When enabled, sampled numeric analysis results are stored in the browser's IndexedDB database.
- Profiles and session history remain on the device unless the user exports them or another program accesses the browser profile.
- JSON and CSV exports are created only after an explicit user action. Exported files may contain sensitive inferred attributes and should be protected accordingly.
- Clearing this site's browser storage removes its IndexedDB history and preferences.

## Third-party requests

The default page loads MediaPipe scripts from jsDelivr and fonts from Google Fonts. Those providers receive ordinary web-request metadata such as IP address and user agent. A service worker may cache these resources locally for later use.

## Intended use

The displayed expression, authenticity, deception, sincerity, cognitive-load, stress, and related values are unvalidated heuristic signals. They must not be treated as facts about a person or used for medical diagnosis, lie detection, identification, surveillance, employment, policing, insurance, education discipline, or other high-impact decisions.
