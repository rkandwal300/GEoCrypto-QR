"use client";

import { useState, useEffect, useRef } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { Camera, ScanLine, MapPin, AlertTriangle, Loader2, FileUp } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { decryptData } from "@/lib/crypto";

export function QrScanner() {
  const [scannedData, setScannedData] = useState<object | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readerId = "qr-code-full-region";

  const { toast } = useToast();

  useEffect(() => {
    // Initialize the scanner
    if (!scannerRef.current) {
      const scanner = new Html5Qrcode(readerId, {
        verbose: false,
        formatsToSupport: [0, 1, 2, 7, 9, 8],
      });
      scannerRef.current = scanner;
    }

    const startScanner = async () => {
      setError(null);
      setScannedData(null);
      // Check for camera permissions and start the scanner
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length) {
          await scannerRef.current?.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: (viewfinderWidth, viewfinderHeight) => {
                const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                const qrboxSize = Math.floor(minEdge * 0.7);
                return { width: qrboxSize, height: qrboxSize };
              },
              aspectRatio: 1.0,
            },
            onScanSuccess,
            onScanFailure
          );
        } else {
           setError("No camera found. Please use the upload option.");
        }
      } catch (err: any) {
        setError(`Failed to start scanner: ${err.message}. Please grant camera permissions or use the upload option.`);
      }
    };
    
    startScanner();

    // Cleanup function to stop the scanner when the component unmounts
    return () => {
      if (scannerRef.current?.getState() === Html5QrcodeScannerState.SCANNING) {
        scannerRef.current?.stop().catch(err => console.error("Failed to stop scanner", err));
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const processDecodedText = async (decodedText: string) => {
    setIsLoading(true);
    if (scannerRef.current?.getState() === Html5QrcodeScannerState.SCANNING) {
      await scannerRef.current.pause(true);
    }

    try {
      const decrypted = decryptData(decodedText);
      
      const location = await new Promise<GeolocationCoordinates>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Geolocation is not supported by your browser."));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (position) => resolve(position.coords),
          (err) => reject(new Error(err.message)),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });
      
      const mergedData = {
        ...decrypted,
        scanDetails: {
          scannedAt: new Date().toISOString(),
          location: {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
          },
        },
      };

      setScannedData(mergedData);
      setError(null);
      toast({
        title: "Success!",
        description: "QR code decrypted and location appended.",
        className: "bg-green-100 dark:bg-green-900",
      });
    } catch (e: any) {
      const errorMessage = e instanceof Error ? e.message : "Invalid or corrupted QR code.";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Scan Error",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onScanSuccess = (decodedText: string) => {
    processDecodedText(decodedText);
  };

  const onScanFailure = (errorMessage: string) => {
    // This is called frequently when no QR code is in view, so we don't show an error.
    // console.log(`QR Code no longer in view. ${errorMessage}`);
  };

  const handleRescan = async () => {
    setError(null);
    setScannedData(null);
    setIsLoading(false);
    if(scannerRef.current?.isScanning === false) {
      try {
        await scannerRef.current?.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
          onScanSuccess,
          onScanFailure
        );
      } catch (err: any) {
        setError(`Failed to restart scanner: ${err.message}.`);
      }
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && scannerRef.current) {
      setScannedData(null);
      setError(null);
      setIsLoading(true);
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.pause(true);
      }
      try {
        const decodedText = await scannerRef.current.scanFile(file, false);
        onScanSuccess(decodedText);
      } catch (err: any) {
        const errorMessage = err.message || "Could not scan the QR code from the image. Please try a different file.";
        setError(errorMessage);
        toast({
          variant: "destructive",
          title: "Upload Error",
          description: errorMessage,
        });
      } finally {
        setIsLoading(false);
      }
      // Reset file input to allow scanning the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <Card className="w-full max-w-2xl shadow-2xl shadow-primary/10">
      <CardHeader>
        <CardTitle className="font-headline text-3xl flex items-center gap-2">
          <ScanLine className="text-primary" />
          Scan & Decrypt QR
        </CardTitle>
        <CardDescription>
          Point your camera at a GeoCrypt QR code to securely view its content, or upload an image.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="relative aspect-square w-full max-w-md mx-auto rounded-lg overflow-hidden border-4 border-dashed">
          <div id={readerId} className="w-full h-full" />
          {isLoading && (
            <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="mt-4 text-lg font-medium">Processing Data...</p>
            </div>
          )}
        </div>

        {error && !scannedData && (
          <div className="flex items-center p-4 text-sm text-destructive-foreground bg-destructive rounded-lg" role="alert">
            <AlertTriangle className="flex-shrink-0 inline w-4 h-4 mr-3" />
            <div>
              <span className="font-medium">Error:</span> {error}
            </div>
          </div>
        )}

        {scannedData ? (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2"><MapPin className="text-green-500" /> Decrypted & Merged Data</h3>
            <Card className="bg-muted/50 dark:bg-muted/20">
              <CardContent className="p-4">
                <pre className="text-sm font-code w-full whitespace-pre-wrap break-words">
                  {JSON.stringify(scannedData, null, 2)}
                </pre>
              </CardContent>
            </Card>
            <Button onClick={handleRescan} className="w-full">
              <Camera className="mr-2 h-4 w-4" />
              Scan Another Code
            </Button>
          </div>
        ) : (
           <div className="text-center space-y-4 pt-4">
             <p className="text-muted-foreground">Align a QR code to scan, or upload an image file.</p>
             <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/png, image/jpeg, image/gif"
              className="hidden"
            />
            <Button onClick={() => fileInputRef.current?.click()} variant="outline" disabled={isLoading}>
              <FileUp className="mr-2 h-4 w-4" />
              Upload QR Image
            </Button>
           </div>
        )}
      </CardContent>
    </Card>
  );
}
