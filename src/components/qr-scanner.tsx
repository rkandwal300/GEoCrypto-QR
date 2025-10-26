
"use client";

import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, ScanLine, MapPin, AlertTriangle, Loader2, FileUp, KeyRound } from "lucide-react";

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
  scanDetails: {
    location: {
      latitude: number;
      longitude: number;
      accuracy: number;
    };
    scannedAt: string;
  };
  [key: string]: any;
};

export function QrScanner() {
  const [scannedData, setScannedData] = useState<ScannedDataType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readerId = "qr-code-reader-video";
  
  const { toast } = useToast();
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(err => console.error("Ignoring scanner stop error", err));
    }
    setIsScanning(false);
  };

  const startScanner = async () => {
    setError(null);
    setScannedData(null);
    setIsScanning(true);
  
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      setHasCameraPermission(false);
      setError(`Camera permission denied. Please allow camera access in your browser settings or use the upload option.`);
      setIsScanning(false);
    }
  };

  useEffect(() => {
    // Initialize scanner instance once.
    if (!scannerRef.current) {
      // The `verbose: false` option is passed to prevent logging to the console.
      scannerRef.current = new Html5Qrcode(readerId, false);
    }
    startScanner();

    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const processDecodedText = async (decodedText: string) => {
    setIsLoading(true);
    stopCamera();

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

      setScannedData(mergedData as ScannedDataType);
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
  
  const handleRescan = () => {
    setError(null);
    setScannedData(null);
    if(hasCameraPermission !== false){
        startScanner();
    }
  };

  const handleCapture = async () => {
    if (videoRef.current && canvasRef.current) {
        setIsLoading(true);
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if(context) {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            stopCamera();
            try {
                const imageDataUrl = canvas.toDataURL('image/png');
                const imageFile = await (await fetch(imageDataUrl)).blob();
                const file = new File([imageFile], "capture.png", { type: "image/png"});
                if (!scannerRef.current) {
                    scannerRef.current = new Html5Qrcode(readerId);
                }
                const decodedText = await scannerRef.current.scanFile(file, false);
                await processDecodedText(decodedText);
            } catch (err) {
                 const errorMessage = "Could not decode QR code from the captured image. Please try again.";
                 setError(errorMessage);
                 toast({
                    variant: "destructive",
                    title: "Capture Error",
                    description: errorMessage,
                 });
                 setIsLoading(false);
                 handleRescan();
            }
        }
    }
  }


  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setScannedData(null);
      setError(null);
      setIsLoading(true);
      stopCamera();

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(readerId, false);
      }
      
      try {
        const decodedText = await scannerRef.current.scanFile(file, false);
        await processDecodedText(decodedText);
      } catch (err: any) {
        const errorMessage = "Could not scan the QR code from the image. Please try a different file.";
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

  const mapUrl = (scannedData && mapsApiKey)
    ? `https://www.google.com/maps/embed/v1/place?key=${mapsApiKey}&q=${scannedData.scanDetails.location.latitude},${scannedData.scanDetails.location.longitude}`
    : "";

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
        <div style={{ display: scannedData || isLoading ? 'none' : 'block' }}>
          <div className="relative aspect-square w-full max-w-md mx-auto rounded-lg overflow-hidden border-4 border-dashed">
             <video ref={videoRef} id={readerId} className="w-full h-full object-cover" autoPlay playsInline muted />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                 <div className="w-2/3 h-2/3 border-4 border-white/50 rounded-2xl shadow-lg" />
              </div>
              
              {isScanning && hasCameraPermission && (
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                    <Button onClick={handleCapture} size="icon" className="rounded-full w-20 h-20 bg-white/80 hover:bg-white border-4 border-primary shadow-lg">
                        <Camera className="w-10 h-10 text-primary" />
                    </Button>
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
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {isLoading && (
            <div className="flex flex-col items-center justify-center text-center p-8 h-96">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="mt-4 text-lg font-medium">Processing Data...</p>
                <p className="text-muted-foreground">Capturing, decrypting, and fetching location.</p>
            </div>
        )}

        {error && !isLoading && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Scan Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {scannedData ? (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2"><KeyRound className="text-green-500" /> Decrypted Data</h3>
              <Card className="bg-muted/50 dark:bg-muted/20 my-2">
                <CardContent className="p-4">
                  <pre className="text-sm font-code w-full whitespace-pre-wrap break-words">
                    {JSON.stringify(scannedData, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </div>
            
            <div>
               <h3 className="font-semibold text-lg flex items-center gap-2"><MapPin className="text-blue-500" /> Scan Location</h3>
               {mapsApiKey ? (
                 <div className="aspect-video w-full rounded-lg overflow-hidden border mt-2">
                   <iframe
                     width="100%"
                     height="100%"
                     style={{ border: 0 }}
                     loading="lazy"
                     allowFullScreen
                     src={mapUrl}>
                   </iframe>
                 </div>
               ) : (
                 <Alert>
                   <KeyRound className="h-4 w-4" />
                   <AlertTitle>Google Maps API Key is Missing</AlertTitle>
                   <AlertDescription>
                     To display the map, you need a Google Maps API key.
                     <ol className="list-decimal list-inside mt-2 space-y-1">
                        <li>Go to the <a href="https://console.cloud.google.com/google/maps-apis/overview" target="_blank" rel="noopener noreferrer" className="underline font-semibold">Google Cloud Console</a>.</li>
                        <li>Create or select a project.</li>
                        <li>Enable the "Maps Embed API".</li>
                        <li>Create an API Key under "Credentials".</li>
                        <li>Create a file named <code className="font-mono text-sm">.env.local</code> in the root of your project.</li>
                        <li>Add the following line to it: <code className="font-mono text-sm">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_API_KEY_HERE</code></li>
                        <li>Replace <code className="font-mono text-sm">YOUR_API_KEY_HERE</code> with your actual key and restart the development server.</li>
                     </ol>
                   </AlertDescription>
                 </Alert>
               )}
            </div>

            <Button onClick={handleRescan} className="w-full" size="lg">
              <Camera className="mr-2 h-4 w-4" />
              Scan Another Code
            </Button>
          </div>
        ) : (
           <div className="text-center space-y-4 pt-4 border-t">
             <p className="text-muted-foreground">If camera is unavailable, you can upload an image.</p>
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
