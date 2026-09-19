# AUTO AI v1 — Data Safety Working Notes

These notes are for completing the Google Play Data safety form. Confirm against the final production build before submission.

## Permissions in v1

The Android manifest requests only:
- INTERNET

It does not request location, contacts, camera, microphone, SMS, phone, storage/media, Bluetooth or advertising-ID permissions.

## Data sent to the AUTO AI service

Only information the user deliberately enters to request vehicle analysis is transmitted:
- vehicle year, make and model when provided;
- symptom description;
- warning-light/dashboard text;
- diagnostic trouble code;
- repair-quote text pasted by the user;
- used-car concern selections.

The current AUTO AI service processes this input to return the requested result. The v1 API does not require an account.

## Do not claim
Do not claim that no data leaves the device. Vehicle/repair text is transmitted to the AUTO AI backend to provide the service.

## Before Play submission
Reconfirm:
1. whether the production server stores request bodies or logs containing user-entered text;
2. retention period, if any;
3. whether an AI provider receives any request content;
4. whether analytics are enabled in the Android build;
5. whether crash reporting is added;
6. whether billing adds purchase/account identifiers.

Update the Play form if any of these change.
