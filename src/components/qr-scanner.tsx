
"use client";

import { useState, useEffect, useRef } from "react";
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";
import {
  FileUp,
  KeyRound,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { decryptData } from "@/lib/crypto";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

type ScannedDataType = {
  data: any;
};

export function QrScanner() {
  const [scannedData, setScannedData] = useState<ScannedDataType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCameraPermission, setHasCameraPermission] = useState<
    boolean | null
  >(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readerId = "qr-code-reader-video";

  const { toast } = useToast();

  const stopScanner = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current
        .stop()
        .catch((err) => console.error("Ignoring scanner stop error", err));
    }
  };

  useEffect(() => {
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode(readerId, {
        verbose: false,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      });
    }
    const html5Qrcode = scannerRef.current;

    const startScanner = async () => {
      setError(null);
      setScannedData(null);
      setIsLoading(true);

      try {
        await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        setHasCameraPermission(true);

        const config = {
          fps: 10,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.7);
            return {
              width: size,
              height: size,
            };
          },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true,
        };

        html5Qrcode
          .start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
              if (isLoading) return;
              processDecodedText(decodedText);
            },
            (errorMessage) => {
              if (!errorMessage.toLowerCase().includes("not found")) {
                console.log(`QR Scanner Error: ${errorMessage}`);
              }
            }
          )
          .finally(() => {
            setIsLoading(false);
          });
      } catch (err: any) {
        setHasCameraPermission(false);
        setError(
          `Camera permission denied. Please allow camera access in your browser settings or use the upload option.`
        );
        toast({
          variant: "destructive",
          title: "Camera Access Denied",
          description:
            "Please enable camera permissions to use the live scanner.",
        });
        setIsLoading(false);
      }
    };

    startScanner();

    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const processDecodedText = async (decodedText: string) => {
    setIsLoading(true);
    stopScanner();

    try {
      const decrypted = decryptData(decodedText);
      const dataToSet = typeof decrypted.data === 'object' ? decrypted.data : decrypted;
      setScannedData({ data: dataToSet });
      setError(null);
      toast({
        title: "Success!",
        description: "QR code decrypted.",
        className: "bg-accent text-accent-foreground",
      });
    } catch (e: any) {
      const errorMessage =
        e instanceof Error ? e.message : "Invalid or corrupted QR code.";
      setError(errorMessage);
      setScannedData(null); // Clear previous data on error
      toast({
        variant: "destructive",
        title: "Scan Error",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRescan = () => {
    window.location.reload();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      setScannedData(null);
      setError(null);
      setIsLoading(true);
      stopScanner();

      try {
        if (!scannerRef.current) {
          scannerRef.current = new Html5Qrcode(readerId, false);
        }
        const decodedText = await scannerRef.current.scanFile(file, false);
        await processDecodedText(decodedText);
      } catch (err: any) {
        const errorMessage =
          "Could not scan the QR code from the image. Please try a different file.";
        setError(errorMessage);
        toast({
          variant: "destructive",
          title: "Upload Error",
          description: errorMessage,
        });
        setIsLoading(false);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (scannedData) {
    return (
      <div className="w-full max-w-4xl mx-auto p-4 md:p-6 animate-in fade-in-50">
        <Card className="shadow-lg border-2 border-primary/10">
          <CardHeader className="text-center">
            <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
              <KeyRound className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="font-headline text-3xl mt-4">
              Scan Result
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold text-xl flex items-center gap-2">
                Decrypted Data
              </h3>
              <Card className="bg-muted/50 dark:bg-muted/20 my-2">
                <CardContent className="p-4">
                  <pre className="text-sm font-code w-full whitespace-pre-wrap break-words">
                    {typeof scannedData.data === 'string' ? scannedData.data : JSON.stringify(scannedData.data, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </div>
            <Button onClick={handleRescan} className="w-full" size="lg">
              <RefreshCw className="mr-2 h-5 w-5" />
              Scan Another Code
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full h-[calc(100vh-8rem)] max-h-screen flex flex-col items-center justify-center bg-background">
      <div className="relative w-full h-full">
        <div id={readerId} className="w-full h-full object-cover"></div>

        {isLoading && hasCameraPermission !== false && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white bg-black/50 p-4 rounded-lg z-10">
            <Loader2 className="h-10 w-10 animate-spin text-white" />
            <p className="mt-2 text-lg font-medium">Starting Camera...</p>
          </div>
        )}
      </div>

      <div className="absolute bottom-4 sm:bottom-8 z-20 flex flex-col items-center gap-4 w-full px-4">
        {hasCameraPermission === false && (
          <Alert variant="destructive" className="max-w-md">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Camera Access Denied</AlertTitle>
            <AlertDescription>
              Please grant camera access in your browser settings to use the
              scanner.
            </AlertDescription>
          </Alert>
        )}

        {error && !scannedData && (
          <Alert variant="destructive" className="max-w-md">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Scan Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            <Button onClick={handleRescan} variant="secondary" className="mt-4">
              <RefreshCw className="mr-2 h-4 w-4" /> Try Again
            </Button>
          </Alert>
        )}

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/png, image/jpeg, image/gif"
          className="hidden"
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          variant="secondary"
          size="lg"
          className="bg-white/90 hover:bg-white text-primary font-bold w-full max-w-sm"
          disabled={isLoading || (!!error && !scannedData)}
        >
          <FileUp className="mr-2 h-5 w-5" />
          Upload QR Image
        </Button>
      </div>
    </div>
  );
}
