import { useParams } from "react-router-dom";

function LocationPage() {
  const { area } = useParams();
  return (
    <div className="py-8 container">
      <h2 className="text-3xl font-bold mb-6">Explore {area}</h2>
      <p>Custom content for {area} — listings, events, weather, etc.</p>
    </div>
  );
}

export default LocationPage;
