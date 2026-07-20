import { getGeoStore } from "./geoStore";
import { captureConstructionPreferences, saveStoredConstructionPreferences } from "./appPreferences";

// Persists the store's current construction preferences (palette, canvas theme,
// default styles, tool defaults) so new tabs and fresh app starts pick them up.
// Call this only from user-initiated preference changes — never from document
// restore or file-open paths, which would clobber the user's chosen defaults.
export function persistCurrentConstructionPreferences(): boolean {
  return saveStoredConstructionPreferences(captureConstructionPreferences(getGeoStore()));
}
