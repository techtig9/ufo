# UFO Round 2 fixes

- Paid plan signup intent now redirects authenticated users to Billing instead of pretending signup activates a paid plan.
- Figma pricing copy is honest: the real API export is marked coming soon.
- Added browser voice input to the AI generator prompt when SpeechRecognition is supported.
- Public prototype comments now follow the currently selected screen instead of being permanently attached to the first screen.
- Removed stale documentation references to invalid Tailwind opacity utilities.

## Production notes
- Real Paddle price IDs and client token are still required for checkout.
- Real Figma API integration is intentionally not claimed as complete.
- Voice input uses the browser Web Speech API; availability depends on the browser.
