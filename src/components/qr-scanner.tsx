
"use client";

import { useState, useEffect, useRef } from "react";
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
  Html5QrcodeScannerState,
} from "html5-qrcode";
import {
  FileUp,
  KeyRound,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Camera,
  Video,
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
import { cn } from "@/lib/utils";

type ScannedDataType = {
  data: any;
};

export function QrScanner() {
  const [scannedData, setScannedData] = useState<ScannedDataType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<
    boolean | null
  >(null);

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
    setShowScanner(false);
    setIsLoading(true);

    try {
      const decrypted = decryptData(decodedText);
      const dataToSet =
        typeof decrypted.data === "object" ? decrypted.data : decrypted;
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

  const startScanner = async () => {
    setError(null);
    if (scannedData) setScannedData(null);
    setShowScanner(true);
    setIsLoading(true);

    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode(readerId, {
        verbose: false,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      });
    }
    const html5Qrcode = scannerRef.current;

    // Cleanup function to stop the scanner
    const cleanup = () => {
      if (
        html5Qrcode &&
        html5Qrcode.getState() === Html5QrcodeScannerState.SCANNING
      ) {
        html5Qrcode
          .stop()
          .catch((err) => console.error("Ignoring scanner stop error", err));
      }
    };

    try {
      // Check for camera permissions first
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasCamera = devices.some(device => device.kind === 'videoinput');
      if (!hasCamera) {
        throw new Error("No camera found on this device.");
      }

      await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      setHasCameraPermission(true);

      const config = {
        fps: 10,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const size = Math.floor(minEdge * 0.7);
          return {
            width: size,
            height: size,
          };
        },
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true,
        rememberLastUsedCamera: true,
      };

      const qrCodeSuccessCallback = (decodedText: string) => {
        if (html5Qrcode.getState() === Html5QrcodeScannerState.SCANNING) {
          processDecodedText(decodedText);
        }
      };

      const qrCodeErrorCallback = (errorMessage: string) => {
        if (!errorMessage.toLowerCase().includes("not found")) {
          console.log(`QR Scanner Error: ${errorMessage}`);
        }
      };

      cleanup(); // Stop any existing scanner before starting a new one
      await html5Qrcode.start(
        { facingMode: "environment" },
        config,
        qrCodeSuccessCallback,
        qrCodeErrorCallback
      );
    } catch (err: any) {
      setHasCameraPermission(false);
      let userMessage = 'Camera permission denied. Please allow camera access in your browser settings or use the upload option.';
      if(err.message.includes("not found")) {
        userMessage = "No camera found on this device. You can upload a QR code image instead.";
      }
      setError(userMessage);
      toast({
        variant: "destructive",
        title: "Camera Access Issue",
        description: userMessage,
      });
      setShowScanner(false);
    } finally {
      setIsLoading(false);
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    // Check for camera permission status on load without prompting
    const checkPermission = async () => {
      try {
        if (navigator.permissions) {
          const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
          setHasCameraPermission(permissionStatus.state !== 'denied');
          if (permissionStatus.state === 'denied') {
            setError('Camera permission denied. Please allow camera access in your browser settings or use the upload option.');
          }
        }
      } catch (e) {
        console.warn("Could not query camera permission status.", e);
      } finally {
        setIsInitializing(false);
      }
    };
    checkPermission();

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current
          .stop()
          .catch((err) => console.error("Ignoring scanner stop error on unmount", err));
      }
    };
  }, []);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }
      setShowScanner(false);
      setScannedData(null);
      setError(null);
      setIsLoading(true);

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
        setShowScanner(false);
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
                    {typeof scannedData.data === "string"
                      ? scannedData.data
                      : JSON.stringify(scannedData.data, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </div>
            <Button onClick={startScanner} className="w-full" size="lg">
              <RefreshCw className="mr-2 h-5 w-5" />
              Scan Another Code
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full h-[calc(100vh-8rem)] max-h-screen flex flex-col items-center justify-center bg-black">
      <div
        className={cn(
          "relative w-full h-full flex flex-col items-center justify-center",
          showScanner ? "visible" : "invisible"
        )}
      >
        <div id={readerId} className="w-full h-full object-cover"></div>

        {isLoading && showScanner && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white bg-black/50 p-4 z-10">
            <Loader2 className="h-10 w-10 animate-spin text-white" />
            <p className="mt-2 text-lg font-medium">Starting Camera...</p>
          </div>
        )}
      </div>

      {!showScanner && !isInitializing && (
        <div className="flex flex-col items-center justify-center text-white p-4 text-center">
          <Video className="w-24 h-24 mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">QR Code Scanner</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            Press the button to start the camera or upload an image to scan.
          </p>
        </div>
      )}

      <div className="absolute bottom-4 sm:bottom-8 z-20 flex flex-col items-center gap-4 w-full px-4">
        {error && (
          <Alert variant="destructive" className="max-w-md">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Scan Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex w-full justify-center max-w-sm gap-4">
          {!showScanner ? (
            <Button
              onClick={startScanner}
              size="lg"
              className="font-bold flex-1"
              disabled={isLoading || isInitializing}
            >
              {isLoading || isInitializing ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Camera className="mr-2 h-5 w-5" />
              )}
              {isLoading ? "Starting..." : "Start Scanner"}
            </Button>
          ) : (
             <Button
                onClick={() => setShowScanner(false)}
                variant="destructive"
                size="lg"
                className="font-bold flex-1"
                disabled={isLoading}
              >
                <Video className="mr-2 h-5 w-5" />
                Stop Scanner
              </Button>
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
            disabled={isLoading || showScanner}
          >
            <FileUp className="mr-2 h-5 w-5" />
            Upload
          </Button>
        </div>
      </div>
    </div>
  );
}

    