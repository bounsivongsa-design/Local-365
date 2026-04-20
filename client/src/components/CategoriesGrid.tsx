import { useEffect, useState } from 'react';

interface Category {
  id: number;
  name: string;
  subs: string[];
}

const dummyCategories: Category[] = [
  "Animal & Pet", "Auto Detailing", "Auto Repair", "Baby Sitting & Nanny",
  "Baking & Cooking", "Beauty & Salon", "Catering / Food Trucks", "Cleaning",
  "Concrete", "Dock & Marine", "Electrical", "Entertainment Locations",
  "Entertainment Services", "Event Planning & Rentals", "Fencing", "Fitness & Gym",
  "Flooring", "Garage Door", "Health & Wellness", "Home Repair", "HVAC",
  "Insurance", "Landscaping", "Lawn Care", "Legal", "Metal Work",
  "Moving & Hauling", "New Construction", "Painting", "Pest Control",
  "Photo & Video", "Plumbing", "Pool & Spa", "Pressure Washing", "Printing",
  "Real Estate / Realtors", "Remodeling & Addition", "Restaurants & Dining",
  "Roofing", "Security Services", "Septic & Well", "Shopping / Retail",
  "Small Engine Repair", "Tax CPA", "Trash & Junk Removal", "Tree Care",
  "Tutor & Mentor Counseling", "Web Design & Logo Design", "Window Tinting",
  "Windows & Doors", "Woodworking"
].sort().map((name, i) => ({ id: i + 1, name, subs: [] }));

function CategoriesGrid() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch('/api/categories');
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        if (data && data.length > 0) {
          setCategories(data);
        } else {
          setCategories(dummyCategories);
        }
      } catch (err) {
        setError('Failed to load categories — try refreshing.');
        setCategories(dummyCategories);
      } finally {
        setLoading(false);
      }
    }
    fetchCategories();
  }, []);

  const toggleExpand = (id: number) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-blue-100/50 p-4 rounded-lg text-center animate-pulse h-24" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500">{error}</p>;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {categories.map((cat) => (
        <div 
          key={cat.id} 
          className="bg-blue-100 p-4 rounded-lg text-center shadow-3d cursor-pointer transition-all hover:shadow-3d-lg"
          onClick={() => toggleExpand(cat.id)}
          data-testid={`card-category-${cat.id}`}
        >
          <h3 className="font-bold hover:text-primary transition-colors">
            {cat.name}
          </h3>
          {expanded[cat.id] && (
            <div className="mt-2 text-left">
              {cat.subs && cat.subs.map((sub, j) => (
                <p key={j} className="text-sm text-muted-foreground">{sub}</p>
              ))}
              <p className="text-sm mt-2 font-medium">Example: Smith {cat.name} Pros</p>
              <p className="text-sm text-amber-700 font-medium">Rating: 4.8 ★</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default CategoriesGrid;
