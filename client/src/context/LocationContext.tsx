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

const defaultLocation: SelectedLocation = {
  name: "Moyock, NC",
  city: "Moyock",
  state: "NC",
  zipCode: "27958",
  region: "Currituck County",
  tagline: "Heart of Currituck County"
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
