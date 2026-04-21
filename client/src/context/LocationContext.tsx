import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface SelectedLocation {
  id?: number;
  name: string;
  city: string;
  state: string;
  zipCode?: string;
  region?: string;
  tagline?: string;
}

interface LocationContextType {
  location: SelectedLocation;
  setLocation: (location: SelectedLocation) => void;
  isLocationSet: boolean;
}

// Neutral fallback — only used if a component reads `location` BEFORE the
// user has chosen one. UI should branch on `isLocationSet` and show the
// location picker first, but if it does fall through, this stays generic
// and avoids hardcoding any single town as "the" location.
const defaultLocation: SelectedLocation = {
  name: "your area",
  city: "your area",
  state: "",
  zipCode: "",
  region: "",
  tagline: "Choose your town to see local results",
};

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocationState] = useState<SelectedLocation>(() => {
    const stored = localStorage.getItem("selectedLocation");
    return stored ? JSON.parse(stored) : defaultLocation;
  });

  const [isLocationSet, setIsLocationSet] = useState(() => {
    return localStorage.getItem("locationSet") === "true";
  });

  const setLocation = (newLocation: SelectedLocation) => {
    setLocationState(newLocation);
    setIsLocationSet(true);
    localStorage.setItem("selectedLocation", JSON.stringify(newLocation));
    localStorage.setItem("locationSet", "true");
  };

  useEffect(() => {
    localStorage.setItem("selectedLocation", JSON.stringify(location));
  }, [location]);

  return (
    <LocationContext.Provider value={{ location, setLocation, isLocationSet }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error("useLocation must be used within a LocationProvider");
  }
  return context;
}
