
"use client";

import { useState, useEffect, useRef } from "react";
import {
  Html5Qrcode,
  Html5QrcodeScannerState,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";
import {
  FileUp,
  KeyRound,
  Loader2,
  RefreshCw,
  MapPin,
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type ScannedDataType = {
  data: any;
  location?: {
    lat: number;
    long: number;
    accuracy: number;
  };
};

export function QrScanner() {
  const [scannedData, setScannedData] = useState<ScannedDataType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCameraPermission, setHasCameraPermission] = useState(true);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readerId = "qr-code-reader-video";

  const { toast } = useToast();

  const processDecodedText = (decodedText: string) => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current
        .stop()
        .catch((err) => console.log("Error stopping scanner", err));
    }
    setIsLoading(true);
    setError(null);

    try {
      const decrypted = decryptData(decodedText);
      
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setScannedData({
              data: decrypted,
              location: {
                lat: position.coords.latitude,
                long: position.coords.longitude,
                accuracy: position.coords.accuracy,
              },
            });
            toast({
              title: "Success!",
              description: "QR code decrypted and location captured.",
              className: "bg-accent text-accent-foreground",
            });
            setIsLoading(false);
          },
          (geoError) => {
            console.error("Geolocation error:", geoError);
            setScannedData({ data: decrypted }); // Still show decrypted data
            toast({
              variant: "destructive",
              title: "Location Error",
              description: "Could not get location. Displaying QR data only.",
            });
            setIsLoading(false);
          },
          { enableHighAccuracy: true }
        );
      } else {
         setScannedData({ data: decrypted });
         toast({
            title: "Success!",
            description: "QR code decrypted. Geolocation not supported.",
         });
         setIsLoading(false);
      }
      
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
      setIsLoading(false);
    }
  };

  const startScanner = async () => {
    setError(null);
    if (scannedData) setScannedData(null);
    setIsLoading(true);

    if (!document.getElementById(readerId)) {
        setTimeout(startScanner, 100);
        return;
    }

    const config = {
      fps: 10,
      qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        const qrboxSize = Math.floor(minEdge * 0.7);
        return {
          width: qrboxSize,
          height: qrboxSize,
        };
      },
      aspectRatio: 1.0,
      showTorchButtonIfSupported: true,
      rememberLastUsedCamera: true,
    };

    const qrCodeSuccessCallback = (decodedText: string) => {
      if (scannerRef.current?.getState() === Html5QrcodeScannerState.SCANNING) {
        processDecodedText(decodedText);
      }
    };
    
    const qrCodeErrorCallback = () => {
      // Don't show 'not found' errors to keep the UI clean
    };

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(readerId, {
          verbose: false,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        });
      }
      
      await scannerRef.current.start(
        { facingMode: "environment" },
        config,
        qrCodeSuccessCallback,
        qrCodeErrorCallback
      );
      setHasCameraPermission(true);
    } catch (err: any) {
      let userMessage = 'Camera permission denied. Please grant camera access in your browser settings to use the scanner.';
      if (err.name === "NotAllowedError") {
         userMessage = "Camera access was denied. You'll need to grant permission in your browser settings to use the scanner."
         setHasCameraPermission(false);
      } else if (err.message && err.message.includes("not found")) {
        userMessage = "No suitable camera found on this device.";
      } else {
        userMessage = "Failed to start the camera. Please check permissions and ensure no other app is using it."
      }
      setError(userMessage);
      toast({
        variant: "destructive",
        title: "Camera Access Issue",
        description: userMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // A small delay ensures the reader element is in the DOM.
    const timeoutId = setTimeout(() => {
      if (typeof window !== "undefined") {
        startScanner();
      }
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(err => {
          console.error("Failed to stop the scanner on cleanup.", err);
        });
      }
    };
  }, []);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }
      setScannedData(null);
      setError(null);
      setIsLoading(true);

      try {
        const tempScanner = new Html5Qrcode(readerId, { verbose: false });
        const decodedText = await tempScanner.scanFile(file, false);
        processDecodedText(decodedText);
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
              <h3 className="font-semibold text-xl">Decrypted Data</h3>
              <Card className="bg-muted/50 dark:bg-muted/20 my-2">
                <CardContent className="p-4">
                  <pre className="text-sm font-code w-full whitespace-pre-wrap break-words">
                    {typeof scannedData.data.data === "string"
                      ? scannedData.data.data
                      : JSON.stringify(scannedData.data.data, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </div>
            
            {scannedData.location && (
              <div className="space-y-4">
                <h3 className="font-semibold text-xl flex items-center gap-2"><MapPin className="w-5 h-5 text-primary"/> Location Captured</h3>
                <Card className="bg-muted/50 dark:bg-muted/20">
                  <CardContent className="p-4 space-y-2">
                    <p><strong className="font-medium">Latitude:</strong> {scannedData.location.lat}</p>
                    <p><strong className="font-medium">Longitude:</strong> {scannedData.location.long}</p>
                    <p><strong className="font-medium">Accuracy:</strong> {scannedData.location.accuracy.toFixed(2)} meters</p>
                  </CardContent>
                </Card>
                <div className="aspect-video w-full rounded-lg overflow-hidden border">
                  <iframe
                    width="100%"
                    height="100%"
                    loading="lazy"
                    allowFullScreen
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${scannedData.location.long - 0.005}%2C${scannedData.location.lat - 0.005}%2C${scannedData.location.long + 0.005}%2C${scannedData.location.lat + 0.005}&layer=mapnik&marker=${scannedData.location.lat}%2C${scannedData.location.long}`}
                  ></iframe>
                </div>
              </div>
            )}

            <Button onClick={() => { setScannedData(null); startScanner(); }} className="w-full" size="lg">
              <RefreshCw className="mr-2 h-5 w-5" />
              Scan Another Code
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <div className="w-full h-full">
        {error && !hasCameraPermission && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/80">
            <Alert variant="destructive" className="max-w-md text-left">
                <AlertTitle>Camera Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
                <Button onClick={startScanner} className="mt-4">Try Again</Button>
            </Alert>
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-20">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">Starting camera...</p>
          </div>
        )}
          
        <div id={readerId} className="w-full h-full" />
        
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
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
                className="bg-white/90 hover:bg-white text-primary font-bold"
                disabled={isLoading}
            >
                <FileUp className="mr-2 h-5 w-5" />
                Upload QR Code
            </Button>
        </div>
      </div>
    </div>
  );
}

    