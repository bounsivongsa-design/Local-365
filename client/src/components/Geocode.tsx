import { useState } from 'react';

interface LocationData {
  lat: string;
  lon: string;
  area: string;
}

interface GeocodeProps {
  onLocationChange: (location: LocationData) => void;
}

function Geocode({ onLocationChange }: GeocodeProps) {
  const [zip, setZip] = useState('');

  const handleGeocode = () => {
    fetch(`https://geocode.maps.co/search?postalcode=${zip}&country=US`)
      .then(response => response.json())
      .then(data => {
        if (data[0]) {
          onLocationChange({ lat: data[0].lat, lon: data[0].lon, area: data[0].display_name });
        }
      });
  };

  return (
    <div className="mb-4">
      <label className="block mb-2">Enter Zip Code for Location</label>
      <input 
        type="text" 
        value={zip} 
        onChange={(e) => setZip(e.target.value)} 
        className="w-full p-2 border rounded" 
        placeholder="e.g., 27948"
        data-testid="input-zip-code"
      />
      <button 
        onClick={handleGeocode} 
        className="mt-2 bg-accent text-primary-dark px-6 py-2 rounded hover:bg-accent/80"
        data-testid="button-find-location"
      >
        Find Location
      </button>
    </div>
  );
}

export default Geocode;
