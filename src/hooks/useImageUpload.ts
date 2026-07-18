import { useState } from 'react';
import { uploadImage } from '../services/firebase';

// The shared image-upload flag + handler used by every modal (Event / PlantTree / EmitPulse /
// CreateVision) and by handleQuickSnap. Extracted verbatim from App — behaviour-preserving:
// toggles `uploading` around uploadImage and returns the stored URL.
export function useImageUpload() {
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (file: File, path: string): Promise<string> => {
    setUploading(true);
    // finally, so a failed upload (network/oversize/rules) clears the flag instead of leaving the
    // modal's spinner/disabled-save state stuck on until it remounts.
    try {
      return await uploadImage(file, path);
    } finally {
      setUploading(false);
    }
  };

  return { uploading, handleImageUpload };
}
