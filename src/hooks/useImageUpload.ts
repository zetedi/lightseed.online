import { useState } from 'react';
import { uploadImage } from '../services/firebase';

// The shared image-upload flag + handler used by every modal (Event / PlantTree / EmitPulse /
// CreateVision) and by handleQuickSnap. Extracted verbatim from App — behaviour-preserving:
// toggles `uploading` around uploadImage and returns the stored URL.
export function useImageUpload() {
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (file: File, path: string): Promise<string> => {
    setUploading(true);
    const url = await uploadImage(file, path);
    setUploading(false);
    return url;
  };

  return { uploading, handleImageUpload };
}
