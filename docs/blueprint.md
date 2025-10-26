# **App Name**: GeoCrypt QR

## Core Features:

- JSON to QR Generation: Accepts JSON input, encrypts it using a client-side encryption tool, and generates a QR code for download or sharing. Data will be encrypted via AES
- QR Scan and Location Append: Scans a QR code, decrypts the JSON payload, fetches the user's current geolocation using the browser's Geolocation API tool, and merges the location data with the original JSON.
- Downloadable QR Code: Enables users to download the generated QR code as a PNG image for offline use and sharing.
- Web Share API Integration: Integrates with the Web Share API to allow users to directly share the QR code with contacts via messaging apps or other platforms.
- PWA Support: Implements Progressive Web App (PWA) features, allowing users to install the app on their devices for offline access and a native app-like experience.
- AES Encryption: Utilizes AES encryption to secure the JSON payload, ensuring data confidentiality during QR code generation and sharing.

## Style Guidelines:

- Primary color: Saturated cerulean (#3AB0FF) to represent security and data.
- Background color: Light cyan (#E5F6FF) to provide a clean, modern backdrop.
- Accent color: A muted lilac (#B484E6) to indicate selectable elements and successful encryption events
- Font: 'Inter' (sans-serif) for clear and modern readability across all text elements; using 'Source Code Pro' (monospace) for code snippets within JSON display.
- Consistent use of simple, geometric icons from a set like Phosphor or Lucide, to enhance usability and add visual appeal to primary features (QR generation, QR scanning).
- A clean, single-column layout for mobile responsiveness, with clear separation between input, QR code display, and action buttons; all UI managed via Shadcn components.
- Subtle transitions for UI elements like modal appearances, button presses, or status updates on the scanner, enhancing UX with minimal distraction.