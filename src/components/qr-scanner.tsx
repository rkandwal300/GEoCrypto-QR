
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

type ScannedDataType = {
  data: any;
};

export function QrScanner() {
  const [scannedData, setScannedData] = useState<ScannedDataType | null>(null);
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
    if (scannerRef.current?.isScanning) {
      return;
    }
    
    setError(null);
    if (scannedData) setScannedData(null);
    setIsLoading(true);

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
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasCamera = devices.some(device => device.kind === 'videoinput');
      if (!hasCamera) {
        throw new Error("No camera found on this device.");
      }

      scannerRef.current = new Html5Qrcode(readerId, {
        verbose: false,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      });
      
      await scannerRef.current.start(
        { facingMode: "environment" },
        config,
        qrCodeSuccessCallback,
        qrCodeErrorCallback
      );
    } catch (err: any) {
      let userMessage = 'Camera permission denied. Please allow camera access in your browser settings or use the upload option.';
      if (err.message.includes("No camera found")) {
        userMessage = "No camera found on this device. You can upload a QR code image instead.";
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
    const timeoutId = setTimeout(() => {
        startScanner();
    }, 0);


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
    <div className="w-full h-full flex flex-col items-center justify-center bg-black p-4 relative">
       {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-30">
          <Loader2 className="h-12 w-12 animate-spin text-white" />
        </div>
      )}
      
      <div className="w-full max-w-full md:max-w-[600px] aspect-square relative flex items-center justify-center">
        <div id={readerId} className="w-full h-full"/>
      </div>
      
      {error && (
        <div className="absolute top-4 left-4 right-4 p-4 bg-destructive text-destructive-foreground rounded-md z-20 text-center">
            <p>{error}</p>
        </div>
      )}

      <div className="absolute bottom-4 sm:bottom-8 z-20 flex flex-col items-center gap-4 w-full px-4">
        <div className="flex w-full justify-center max-w-sm gap-4">
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
           <Button
                onClick={() => {
                  if (scannerRef.current?.isScanning) {
                    scannerRef.current?.stop();
                  }
                  startScanner();
                }}
                variant="outline"
                size="lg"
                className="font-bold flex-1"
                disabled={isLoading}
              >
                <Video className="mr-2 h-5 w-5" />
                Restart
            </Button>
        </div>
      </div>
    </div>
  );
}
