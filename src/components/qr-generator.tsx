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
  jsonData: z
    .string()
    .min(1, "Data cannot be empty.")
    .refine(
      (value) => {
        try {
          JSON.parse(value);
          return true;
        } catch (e) {
          try {
            // If that fails, try the object literal conversion trick
            const evaluated = new Function(`return ${value}`)();
            // Final check to ensure the output is valid JSON
            JSON.parse(JSON.stringify(evaluated));
            return true;
          } catch (err) {
            return false;
          }
        }
      },
      { message: "Invalid JSON or JavaScript object format." }
    ),
});

export function QrGenerator() {
  const [qrValue, setQrValue] = useState<string | null>(null);
  const { toast } = useToast();
  const qrCodeRef = useRef<HTMLDivElement>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jsonData: `{\n  id:"123",\n  name:"rahul Kandwal",\n  domain:"https://xyz.com",\n  route:"sign_payload",\n  method:"POST"\n}`,
    },
  });

  const handleDataChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    form.setValue('jsonData', e.target.value, { shouldValidate: true });
  };


  function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      let json;
      try {
        json = JSON.parse(values.jsonData);
      } catch (e) {
        const evaluated = new Function(`return ${values.jsonData}`)();
        json = JSON.parse(JSON.stringify(evaluated));
      }

      const encrypted = encryptData(json);
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
    const canvas = qrCodeRef.current?.querySelector<HTMLCanvasElement>("canvas");
    if (canvas) {
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = "geocrypt-qrcode.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      toast({
        variant: "destructive",
        title: "Download failed",
        description: "Could not find the QR code canvas.",
      });
    }
  };

  const shareQrCode = async (qrFile: File) => {
    try {
      await navigator.share({
        text: "Scan this secure QR code.",
        files: [qrFile],
      });
    } catch (error: any) {
      if (error.name !== 'AbortError' && error.name !== 'PermissionDeniedError') {
        toast({
          variant: "destructive",
          title: "Share failed",
          description: error.message || "Could not share the QR code.",
        });
      } else if (error.name === 'PermissionDeniedError') {
          toast({
              variant: "destructive",
              title: "Share Permission Denied",
              description: "Permission to share was denied. Please try again from a user-activated event.",
          });
      }
    }
  };

  const handleShareClick = () => {
    const canvas = qrCodeRef.current?.querySelector<HTMLCanvasElement>('canvas');
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

    canvas.toBlob((blob) => {
      if (!blob) {
        toast({
          variant: "destructive",
          title: "Share failed",
          description: "Failed to create image from QR code.",
        });
        return;
      }
      const file = new File([blob], 'geocrypt-qrcode.png', { type: 'image/png' });
      shareQrCode(file);
    }, 'image/png');
  };


  return (
    <Card className="w-full max-w-2xl shadow-2xl shadow-primary/10">
      <CardHeader>
        <CardTitle className="font-headline text-3xl flex items-center gap-2">
          <Wand2 className="text-primary" />
          Generate Secure QR
        </CardTitle>
        <CardDescription>
          Enter your JSON data or JS Object, and we'll encrypt it into a secure QR code.
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
                  <FormLabel>JSON / JS Object Payload</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={'{\n  id: "12345",\n  "sensitive_data": "user@example.com"\n}'}
                      className="min-h-[150px] font-code text-sm"
                      {...field}
                      onChange={handleDataChange}
                    />
                  </FormControl>
                  <FormDescription>
                    Your data is encrypted on your device before the QR code is generated.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" size="lg">
              Generate Code
            </Button>
          </form>
        </Form>
      </CardContent>
      {qrValue && (
        <CardFooter className="flex flex-col items-center gap-6 pt-6">
          <div
            ref={qrCodeRef}
            className="p-4 bg-white rounded-lg shadow-md"
            aria-label="Generated QR Code"
          >
            <QRCode value={qrValue} size={256} level="H" />
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <Button onClick={handleDownload} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Download PNG
            </Button>
            {navigator.share && (
              <Button onClick={handleShareClick}>
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
            )}
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
