"use client";

import { useState, useEffect, useRef } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import {
  ScanLine,
  MapPin,
  AlertTriangle,
  Loader2,
  FileUp,
  KeyRound,
  RefreshCw,
  Video,
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
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

type ScannedDataType = {
  data: string;
  scanDetails: {
    location: {
      latitude: number;
      longitude: number;
      accuracy: number;
    };
    scannedAt: string;
  };
};

export function QrScanner() {
  const [scannedData, setScannedData] = useState<ScannedDataType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<
    boolean | null
  >(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readerId = "qr-code-reader-video";

  const { toast } = useToast();
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const stopScanner = () => {
    if (
      scannerRef.current &&
      scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING
    ) {
      scannerRef.current
        .stop()
        .catch((err) => console.error("Ignoring scanner stop error", err));
    }
  };

  useEffect(() => {
    scannerRef.current = new Html5Qrcode(readerId, false);

    const startScanner = async () => {
      setError(null);
      setScannedData(null);
      setIsLoading(true);

      try {
        await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        setHasCameraPermission(true);

        if (!scannerRef.current) return;

        scannerRef.current.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
              const qrboxSize = Math.floor(minEdge * 0.7);
              return {
                width: qrboxSize,
                height: qrboxSize,
              };
            },
            disableFlip: false,
          },
          (decodedText) => {
            if (isLoading) return;
            processDecodedText(decodedText);
          },
          (errorMessage) => {
            // This callback is called frequently, ignore common non-errors.
            if (!errorMessage.toLowerCase().includes("not found")) {
                console.log(`QR Scanner Error: ${errorMessage}`);
            }
          }
        ).finally(() => {
            setIsLoading(false);
        });

      } catch (err: any) {
        setHasCameraPermission(false);
        setError(
          `Camera permission denied. Please allow camera access in your browser settings or use the upload option.`
        );
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
      if (
        !decrypted ||
        typeof decrypted !== "object" ||
        !decrypted.hasOwnProperty("data")
      ) {
        throw new Error("Invalid QR code format after decryption.");
      }

      const location = await new Promise<GeolocationCoordinates>(
        (resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error("Geolocation is not supported by your browser."));
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (position) => resolve(position.coords),
            (err) => reject(new Error(err.message)),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        }
      );

      const mergedData = {
        ...(decrypted as object),
        scanDetails: {
          scannedAt: new Date().toISOString(),
          location: {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
          },
        },
      };

      setScannedData(mergedData as ScannedDataType);
      setError(null);
      toast({
        title: "Success!",
        description: "QR code decrypted and location appended.",
        className: "bg-green-100 dark:bg-green-900",
      });
    } catch (e: any) {
      const errorMessage =
        e instanceof Error ? e.message : "Invalid or corrupted QR code.";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Scan Error",
        description: errorMessage,
      });
      // Don't auto-rescan on error, let the user decide.
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

  const mapUrl =
    scannedData && mapsApiKey
      ? `https://www.google.com/maps/embed/v1/place?key=${mapsApiKey}&q=${scannedData.scanDetails.location.latitude},${scannedData.scanDetails.location.longitude}`
      : "";

  if (scannedData) {
    return (
      <div className="w-full max-w-4xl mx-auto p-4 md:p-6 animate-in fade-in-50">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
             <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
                <ScanLine className="w-8 h-8 text-primary" />
             </div>
             <CardTitle className="font-headline text-3xl mt-4">
               Scan Result
             </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
             <div>
              <h3 className="font-semibold text-xl flex items-center gap-2">
                <KeyRound className="text-green-500" /> Decrypted Data
              </h3>
              <Card className="bg-muted/50 dark:bg-muted/20 my-2">
                <CardContent className="p-4">
                  <pre className="text-sm font-code w-full whitespace-pre-wrap break-words">
                    {JSON.stringify(scannedData, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </div>

            <div>
              <h3 className="font-semibold text-xl flex items-center gap-2">
                <MapPin className="text-blue-500" /> Scan Location
              </h3>
              {mapsApiKey ? (
                <div className="aspect-video w-full rounded-lg overflow-hidden border mt-2">
                  <iframe
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    src={mapUrl}
                  ></iframe>
                </div>
              ) : (
                <Alert>
                  <KeyRound className="h-4 w-4" />
                  <AlertTitle>Google Maps API Key is Missing</AlertTitle>
                  <AlertDescription>
                    To display the map, you need a Google Maps API key.
                    <ol className="list-decimal list-inside mt-2 space-y-1">
                      <li>
                        Go to the{" "}
                        <a
                          href="https://console.cloud.google.com/google/maps-apis/overview"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline font-semibold"
                        >
                          Google Cloud Console
                        </a>
                        .
                      </li>
                      <li>Create or select a project.</li>
                      <li>Enable the "Maps Embed API".</li>
                      <li>Create an API Key under "Credentials".</li>
                      <li>
                        Create a file named{" "}
                        <code className="font-mono text-sm bg-muted p-1 rounded-sm">
                          .env.local
                        </code>{" "}
                        in your project's root folder.
                      </li>
                      <li>
                        Add the following line to it:{" "}
                        <code className="font-mono text-sm bg-muted p-1 rounded-sm">
                          NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_API_KEY_HERE
                        </code>
                      </li>
                      <li>
                        Replace{" "}
                        <code className="font-mono text-sm">
                          YOUR_API_KEY_HERE
                        </code>{" "}
                        with your actual key and restart the server.
                      </li>
                    </ol>
                  </AlertDescription>
                </Alert>
              )}
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
    <div className="relative w-full h-[calc(100vh-8rem)] max-h-screen overflow-hidden flex flex-col items-center justify-center bg-black">
      <div id={readerId} className="absolute inset-0 w-full h-full"></div>
      
      {/* Overlay with cutout */}
      <div className="absolute inset-0 z-10" style={{
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
      }}>
          <div className="relative mx-auto mt-[20vh] w-[70vw] h-[70vw] max-w-[400px] max-h-[400px] border-4 border-white/80 rounded-3xl">
            {/* Animated scanning line */}
            {!isLoading && hasCameraPermission && (
                 <div className="absolute top-0 left-0 w-full h-1.5 bg-primary/80 shadow-[0_0_10px] shadow-primary animate-[scan-y_2s_ease-in-out_infinite]"
                    style={{
                        animationName: 'scan-y',
                        animationDuration: '3s',
                        animationTimingFunction: 'ease-in-out',
                        animationIterationCount: 'infinite',
                    }}
                 />
            )}
             <style jsx>{`
                @keyframes scan-y {
                    0%, 100% { top: 0; }
                    50% { top: calc(100% - 6px); }
                }
             `}</style>
          </div>
      </div>
      
      <div className="absolute bottom-10 z-20 flex flex-col items-center gap-4">
        {(isLoading && hasCameraPermission !== false) && (
            <div className="flex flex-col items-center justify-center text-center text-white">
                <Loader2 className="h-10 w-10 animate-spin text-white" />
                <p className="mt-2 text-lg font-medium">Starting Camera...</p>
            </div>
        )}
        
        {hasCameraPermission === false && (
             <Alert variant="destructive" className="max-w-md">
               <AlertTriangle className="h-4 w-4" />
               <AlertTitle>Camera Access Denied</AlertTitle>
               <AlertDescription>
                 Please grant camera access in your browser settings to use the scanner.
               </AlertDescription>
             </Alert>
        )}

         {error && (
          <Alert variant="destructive" className="max-w-md">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Scan Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            <Button onClick={handleRescan} variant="secondary" className="mt-4">
                <RefreshCw className="mr-2" /> Try Again
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
            className="bg-white/90 hover:bg-white text-primary font-bold"
            disabled={isLoading}
        >
          <FileUp className="mr-2 h-5 w-5" />
          Upload QR Image
        </Button>
      </div>

    </div>
  );
}

    