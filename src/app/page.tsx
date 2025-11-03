import { QrGenerator } from "@/components/qrcode/qr-generator";

export default function GeneratePage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-start p-4 sm:p-6 lg:p-8">
        <QrGenerator />
    </div>
  );
}
