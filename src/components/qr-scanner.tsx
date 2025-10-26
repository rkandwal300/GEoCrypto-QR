
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

export function QrScanner() {
  const [scannedData, setScannedData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

    try {
      const decrypted = decryptData(decodedText);
      setScannedData(decrypted);

      toast({
        title: "Success!",
        description: "QR code decrypted successfully.",
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
    setIsLoading(true);

    // Give the UI time to render the reader element
    await new Promise((resolve) => setTimeout(resolve, 100));

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
      if (err.name === "NotAllowedError") {
         userMessage = "Camera access was denied. You'll need to grant permission in your browser settings to use the scanner."
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
     // Check if we are in a browser environment
    if (typeof window !== "undefined") {
      setTimeout(() => {
        if (!scannerRef.current?.isScanning && !scannedData) {
            startScanner();
        }
      }, 50)
    }

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(err => {
          console.error("Failed to stop the scanner on cleanup.", err);
        });
      }
    };
  }, [scannedData]);

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
                      : JSON.stringify(scannedData, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </div>

            <Button onClick={() => { setScannedData(null); setError(null); }} className="w-full" size="lg">
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
       {error && (
            <Alert variant="destructive" className="max-w-md absolute top-10 text-left z-10">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}
       {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-20">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="mt-4 text-muted-foreground">Starting camera...</p>
            </div>
        )}
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
                disabled={isLoading}
            >
                <FileUp className="mr-2 h-5 w-5" />
                Upload
            </Button>
        </div>
    </div>
  );
}
