// Read GPS coordinates from an image's EXIF metadata — used to auto-place a tree from a geotagged
// photo. Returns null when the image carries no location. exif-js is loaded lazily so it stays out
// of the main bundle until a photo is actually inspected. Extracted from App verbatim.
export const extractGpsFromImage = async (file: File): Promise<{ latitude: number, longitude: number } | null> => {
  const EXIF = (await import('exif-js')).default;
  return new Promise((resolve) => {
    try {
      EXIF.getData(file as any, function(this: any) {
        const lat = EXIF.getTag(this, "GPSLatitude");
        const latRef = EXIF.getTag(this, "GPSLatitudeRef");
        const lng = EXIF.getTag(this, "GPSLongitude");
        const lngRef = EXIF.getTag(this, "GPSLongitudeRef");

        if (lat && latRef && lng && lngRef) {
          const convertToDecimal = (gpsArr: any, ref: string) => {
            const d = gpsArr[0].numerator / gpsArr[0].denominator;
            const m = gpsArr[1].numerator / gpsArr[1].denominator;
            const s = gpsArr[2].numerator / gpsArr[2].denominator;
            let decimal = d + (m / 60) + (s / 3600);
            if (ref === "S" || ref === "W") decimal = -decimal;
            return decimal;
          };

          resolve({
            latitude: convertToDecimal(lat, latRef),
            longitude: convertToDecimal(lng, lngRef)
          });
        } else {
          resolve(null);
        }
      });
    } catch (e) {
      console.error("EXIF Error:", e);
      resolve(null);
    }
  });
};
