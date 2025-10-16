import { useState, useRef, useImperativeHandle, forwardRef, useEffect } from "react";
import type { ReactNode } from "react";
import Uppy from "@uppy/core";
import AwsS3 from "@uppy/aws-s3";
import { Dashboard } from "@uppy/react";
import type { UploadResult } from "@uppy/core";
import { Button } from "@/components/ui/button";

// Import Uppy styles
import "@uppy/core/css/style.css";
import "@uppy/dashboard/css/style.css";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: () => Promise<{
    method: "PUT";
    url: string;
  }>;
  onComplete?: (
    result: UploadResult<Record<string, unknown>, Record<string, unknown>>
  ) => void;
  buttonClassName?: string;
  children: ReactNode;
  note?: string;
}

export interface ObjectUploaderRef {
  triggerUpload: () => void;
}

export const ObjectUploader = forwardRef<ObjectUploaderRef, ObjectUploaderProps>(({
  maxNumberOfFiles = 1,
  maxFileSize = 10485760,
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
  note,
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const [uppy] = useState(() =>
    new Uppy({
      restrictions: {
        maxNumberOfFiles,
        maxFileSize,
        allowedFileTypes: ['image/*'],
      },
      autoProceed: false,
    })
      .use(AwsS3, {
        shouldUseMultipart: false,
        getUploadParameters: onGetUploadParameters,
      })
      .on("complete", (result) => {
        onComplete?.(result);
        setIsOpen(false);
        // Clear all files after upload completes
        setTimeout(() => {
          uppy.cancelAll();
        }, 100);
      })
  );

  useEffect(() => {
    return () => {
      // Cancel all uploads and clear files on unmount
      uppy.cancelAll();
      uppy.getFiles().forEach(file => uppy.removeFile(file.id));
      // Close Uppy instance to release event listeners
      (uppy as any).close?.();
    };
  }, [uppy]);

  useImperativeHandle(ref, () => ({
    triggerUpload: () => {
      setIsOpen(true);
    }
  }));

  return (
    <div>
      <Button 
        type="button"
        onClick={() => setIsOpen(true)} 
        className={buttonClassName}
        data-testid="button-upload-file"
      >
        {children}
      </Button>
      
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setIsOpen(false)}>
          <div className="relative w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="outline"
              size="icon"
              className="absolute -top-12 right-0 z-10 bg-white hover:bg-gray-100 sm:-top-12 -top-14"
              onClick={() => setIsOpen(false)}
              data-testid="button-close-uploader"
            >
              ✕
            </Button>
            <div className="hidden sm:block">
              <Dashboard
                uppy={uppy}
                proudlyDisplayPoweredByUppy={false}
                width="100%"
                height={450}
                note={note || "Images only, up to 10 MB"}
                theme="light"
              />
            </div>
            <div className="block sm:hidden">
              <Dashboard
                uppy={uppy}
                proudlyDisplayPoweredByUppy={false}
                width="100%"
                height={350}
                note={note || "Images only, up to 10 MB"}
                theme="light"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

ObjectUploader.displayName = "ObjectUploader";
