import { LocationVerifier } from "@/components/qrcode/location-verifier";

export default function ScanPage() {
  // This is the "input payload" location.
  const targetLocation = {
    name: "Central Park",
    latitude: 40.785091,
    longitude: -73.968285,
    address: "New York, NY 10024, USA",
  };

  return <LocationVerifier targetLocation={targetLocation} />;
}
