
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
  MapPin,
  RefreshCw,
} from "lucide-react";

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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type ScannedDataType = {
  data: any;
  location?: {
    latitude: number;
    longitude: number;
  };
};

export function QrScanner() {
  const [scannedData, setScannedData] = useState<ScannedDataType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showStartButton, setShowStartButton] = useState(true);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readerId = "qr-code-reader-video";

  const { toast } = useToast();

  const processDecodedText = async (decodedText: string) => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      await scannerRef.current
        .stop()
        .catch((err) => console.log("Error stopping scanner", err));
    }
    setIsLoading(true);
    setShowStartButton(true); // Show start button for next scan

    try {
      const decrypted = decryptData(decodedText);
      const dataToSet =
        typeof decrypted.data === "object" ? decrypted.data : decrypted;

      toast({
        title: "Success!",
        description: "QR code decrypted. Fetching location...",
        className: "bg-accent text-accent-foreground",
      });

      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setScannedData({
              data: dataToSet,
              location: { latitude, longitude },
            });
            setIsLoading(false);
            toast({
              title: "Location Acquired!",
              description: "Your location has been added to the data.",
            });
          },
          (locationError) => {
            console.error("Geolocation error:", locationError);
            setScannedData({ data: dataToSet }); // Set data without location
            setIsLoading(false);
            toast({
              variant: "destructive",
              title: "Location Error",
              description:
                "Could not get your location. Displaying QR data only.",
            });
          }
        );
      } else {
        setScannedData({ data: dataToSet }); // Set data without location
        setIsLoading(false);
        toast({
          variant: "destructive",
          title: "Geolocation Not Supported",
          description:
            "Your browser does not support geolocation. Displaying QR data only.",
        });
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
    if (scannerRef.current?.isScanning) {
      return;
    }
    
    setError(null);
    if (scannedData) setScannedData(null);
    setIsLoading(true);
    setShowStartButton(false);

    // Ensure the container is visible before starting
    await new Promise(resolve => setTimeout(resolve, 100));


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

    const qrCodeSuccessCallback = (decodedText: string, result: any) => {
      if (scannerRef.current?.getState() === Html5QrcodeScannerState.SCANNING) {
        processDecodedText(decodedText);
      }
    };
    
    const qrCodeErrorCallback = (errorMessage: string) => {
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
    } catch (err: any) {
      let userMessage = 'Camera permission denied. Please grant camera access in your browser settings to use the scanner.';
      if (err.message.includes("not found")) {
        userMessage = err.message;
      }
      setError(userMessage);
      setShowStartButton(true);
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
    // This effect now only handles cleanup
    return () => {
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
        // Use a temporary scanner instance for file scanning
        const tempScanner = new Html5Qrcode(readerId, false);
        const decodedText = await tempScanner.scanFile(file, false);
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

  if (isLoading && !showStartButton) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Starting camera...</p>
      </div>
    );
  }

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
                    {typeof scannedData.data === "string"
                      ? scannedData.data
                      : JSON.stringify(scannedData.data, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </div>

            {scannedData.location && (
              <div>
                <h3 className="font-semibold text-xl flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  Scanned Location
                </h3>
                <Card className="bg-muted/50 dark:bg-muted/20 my-2">
                  <CardContent className="p-4 space-y-2">
                    <p className="font-mono text-sm">
                      Lat: {scannedData.location.latitude}
                    </p>
                    <p className="font-mono text-sm">
                      Lon: {scannedData.location.longitude}
                    </p>
                    <div className="aspect-video rounded-md overflow-hidden mt-2 border">
                      <iframe
                        width="100%"
                        height="100%"
                        loading="lazy"
                        allowFullScreen
                        src={`https://www.google.com/maps/embed/v1/place?key=REPLACE_WITH_YOUR_API_KEY&q=${scannedData.location.latitude},${scannedData.location.longitude}`}
                      ></iframe>
                    </div>
                     <CardDescription className="text-xs pt-2">
                      Note: You need a Google Maps API key for the map to display correctly.
                    </CardDescription>
                  </CardContent>
                </Card>
              </div>
            )}

            <Button onClick={() => { setScannedData(null); setError(null); setShowStartButton(true); }} className="w-full" size="lg">
              <RefreshCw className="mr-2 h-5 w-5" />
              Scan Another Code
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4 relative">
       {showStartButton ? (
         <Card className="text-center p-8 max-w-md">
            <CardHeader>
                <CardTitle className="text-2xl">Ready to Scan?</CardTitle>
                <CardDescription>
                Click the button below to start the camera and scan a QR code.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button onClick={startScanner} size="lg">Start Scanner</Button>
                {error && (
                    <Alert variant="destructive" className="mt-4 text-left">
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
            </CardContent>
         </Card>
       ) : (
        <>
            <div className="w-full max-w-md aspect-square relative flex items-center justify-center rounded-lg overflow-hidden shadow-2xl bg-black">
                <div id={readerId} className="w-full h-full" />
            </div>
            
            <div className="mt-6 flex w-full justify-center max-w-sm gap-4">
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
                    className="bg-white/90 hover:bg-white text-primary font-bold flex-1"
                >
                    <FileUp className="mr-2 h-5 w-5" />
                    Upload
                </Button>
            </div>
        </>
       )}
    </div>
  );
}

    