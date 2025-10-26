
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
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export function QrScanner() {
  const [scannedData, setScannedData] = useState<object | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readerId = "qr-code-reader";

  const { toast } = useToast();

  useEffect(() => {
    const startScanner = async () => {
      setError(null);
      setScannedData(null);

      // Initialize scanner if it doesn't exist
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(readerId, false);
      }

      if (scannerRef.current?.getState() === Html5QrcodeScannerState.SCANNING) {
        return;
      }
      
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length) {
          setHasCameraPermission(true);
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
            () => {} // onScanFailure - do nothing on purpose
          );
        } else {
          setHasCameraPermission(false);
          setError("No camera found. Please use the upload option.");
        }
      } catch (err: any) {
        setHasCameraPermission(false);
        setError(`Camera permission denied. Please allow camera access in your browser settings or use the upload option.`);
      }
    };
    
    startScanner();

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(err => console.error("Failed to stop scanner cleanly.", err));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const processDecodedText = async (decodedText: string) => {
    setIsLoading(true);
    if (scannerRef.current?.isScanning) {
        try {
            await scannerRef.current.pause(true);
        } catch(e) {
            // Can ignore this, might be paused already
        }
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
      // Allow re-scanning after an error
      handleRescan();
    } finally {
      setIsLoading(false);
    }
  };

  const onScanSuccess = (decodedText: string) => {
    processDecodedText(decodedText);
  };
  
  const handleRescan = async () => {
    setError(null);
    setScannedData(null);
    setIsLoading(false);
    if (scannerRef.current && hasCameraPermission) {
      if(scannerRef.current.isScanning) {
          scannerRef.current.resume();
      } else {
        try {
            await scannerRef.current.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: (viewfinderWidth, viewfinderHeight) => {
                    const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                    const qrboxSize = Math.floor(minEdge * 0.7);
                    return { width: qrboxSize, height: qrboxSize };
                  }, aspectRatio: 1.0 },
                onScanSuccess,
                () => {}
            );
        } catch (err: any) {
            setError(`Failed to restart scanner: ${err.message}.`);
        }
      }
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setScannedData(null);
      setError(null);
      setIsLoading(true);

      // Ensure scanner exists
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(readerId, false);
      }
      
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }

      try {
        const decodedText = await scannerRef.current.scanFile(file, false);
        onScanSuccess(decodedText);
      } catch (err: any) {
        const errorMessage = "Could not scan the QR code from the image. Please try a different file.";
        setError(errorMessage);
        toast({
          variant: "destructive",
          title: "Upload Error",
          description: errorMessage,
        });
      } finally {
        setIsLoading(false);
      }
      // Reset file input to allow re-uploading the same file
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
        {!scannedData && (
          <div className="relative aspect-square w-full max-w-md mx-auto rounded-lg overflow-hidden border-4 border-dashed">
            <div id={readerId} className="w-full h-full" />
            {isLoading && (
              <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="mt-4 text-lg font-medium">Processing Data...</p>
              </div>
            )}
             {hasCameraPermission === false && !isLoading && (
              <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center p-4 text-center">
                 <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Camera Access Required</AlertTitle>
                    <AlertDescription>
                     Camera permission is not available. Please grant access in your browser settings or use the file upload option.
                    </AlertDescription>
                  </Alert>
              </div>
            )}
          </div>
        )}

        {error && !isLoading && (
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
