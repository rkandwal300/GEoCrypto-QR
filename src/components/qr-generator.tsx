
"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import QRCode from "qrcode.react";
import { Download, Share2, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { encryptData } from "@/lib/crypto";

const formSchema = z.object({
  jsonData: z.string().min(1, "Data cannot be empty."),
});

export function QrGenerator() {
  const [qrValue, setQrValue] = useState<string | null>(null);
  const { toast } = useToast();
  const qrCodeRef = useRef<HTMLDivElement>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jsonData: "",
    },
  });

  const handleDataChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    form.setValue("jsonData", e.target.value, { shouldValidate: true });
    if (qrValue) {
      setQrValue(null);
    }
  };

  function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const dataToEncrypt = {
        data: values.jsonData,
      };

      const encrypted = encryptData(dataToEncrypt);
      setQrValue(encrypted);
      toast({
        title: "Success!",
        description: "Your secure QR code has been generated.",
        className: "bg-green-100 dark:bg-green-900",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred.";
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: errorMessage,
      });
    }
  }

  const handleDownload = () => {
    const originalCanvas =
      qrCodeRef.current?.querySelector<HTMLCanvasElement>("canvas");
    if (!originalCanvas) {
      toast({
        variant: "destructive",
        title: "Download failed",
        description: "Could not find the QR code canvas.",
      });
      return;
    }

    const downloadCanvas = document.createElement("canvas");
    const scale = 4;
    const size = 256;
    downloadCanvas.width = size * scale;
    downloadCanvas.height = size * scale;
    const ctx = downloadCanvas.getContext("2d");

    if (!ctx) {
      toast({
        variant: "destructive",
        title: "Download failed",
        description: "Could not create a canvas for downloading.",
      });
      return;
    }

    // Create a new high-res QR code on the temporary canvas
    const tempQrContainer = document.createElement("div");
    document.body.appendChild(tempQrContainer);
    const highResQrCode = new (QRCode as any)({
        value: qrValue,
        size: size * scale,
        level: "H",
        bgColor: "#FFFFFF",
        fgColor: "#000000",
        renderAs: "canvas",
    });
    const highResCanvas = highResQrCode._canvas;


    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, downloadCanvas.width, downloadCanvas.height);
    
    // Draw the QR code centered
    const padding = downloadCanvas.width * 0.1;
    const qrSize = downloadCanvas.width - padding * 2;
    ctx.drawImage(highResCanvas, padding, padding, qrSize, qrSize);
    
    document.body.removeChild(tempQrContainer);


    const link = document.createElement("a");
    link.href = downloadCanvas.toDataURL("image/png");
    link.download = "geocrypt-qrcode.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Download started",
      description: "Your QR code is being downloaded.",
    });
  };

  const shareQrCode = async (qrFile: File) => {
    try {
      await navigator.share({
        files: [qrFile],
      });
    } catch (error: any) {
      if (
        error.name !== "AbortError" &&
        error.name !== "PermissionDeniedError"
      ) {
        toast({
          variant: "destructive",
          title: "Share failed",
          description: error.message || "Could not share the QR code.",
        });
      } else if (error.name === "PermissionDeniedError") {
        toast({
          variant: "destructive",
          title: "Share Permission Denied",
          description: "Permission to share was denied by the user.",
        });
      }
    }
  };

  const handleShareClick = async () => {
    const canvas = qrCodeRef.current?.querySelector<HTMLCanvasElement>("canvas");
    if (!canvas || !navigator.share) {
      toast({
        variant: "destructive",
        title: "Share not available",
        description: !canvas
          ? "QR code not found."
          : "Web Share API is not supported on this browser.",
      });
      return;
    }

    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) {
        toast({
          variant: "destructive",
          title: "Share failed",
          description: "Failed to create image from QR code.",
        });
        return;
      }
      const file = new File([blob], "geocrypt-qrcode.png", {
        type: "image/png",
      });
      await shareQrCode(file);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Share failed",
        description: "An unexpected error occurred while preparing the share.",
      });
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-6">
      <Card className="shadow-lg border-2 border-primary/10">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
            <Wand2 className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="font-headline text-3xl mt-4">
            Generate Secure QR Code
          </CardTitle>
          <CardDescription className="text-lg">
            Enter your data, and we'll encrypt it into a secure QR code.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="jsonData"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-lg sr-only">
                      Data Payload
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={'{ id:"123", name:"rahul Kandwal" }'}
                        className="min-h-[200px] font-code text-base bg-muted/50 focus-visible:ring-primary focus-visible:ring-2"
                        {...field}
                        onChange={handleDataChange}
                      />
                    </FormControl>
                    <FormDescription className="text-center">
                      Your data is encrypted on your device before the QR code
                      is generated.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" size="lg">
                <Wand2 className="mr-2 h-5 w-5" />
                Generate Code
              </Button>
            </form>
          </Form>
        </CardContent>
        {qrValue && (
          <CardFooter className="flex flex-col items-center gap-6 pt-6 border-t mt-6">
            <div
              ref={qrCodeRef}
              className="p-4 bg-white rounded-xl shadow-md"
              aria-label="Generated QR Code"
            >
              <QRCode
                value={qrValue}
                size={256}
                level="H"
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              <Button onClick={handleDownload} variant="outline" size="lg">
                <Download className="mr-2 h-5 w-5" />
                Download
              </Button>
              {navigator.share && (
                <Button onClick={handleShareClick} size="lg">
                  <Share2 className="mr-2 h-5 w-5" />
                  Share
                </Button>
              )}
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
