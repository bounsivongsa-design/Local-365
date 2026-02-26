import { useEffect, useState } from 'react';

interface Category {
  id: number;
  name: string;
  subs: string[];
}

const dummyCategories: Category[] = [
  { id: 1, name: "Home Repair", subs: [] },
  { id: 2, name: "Plumbing", subs: [] },
  { id: 3, name: "HVAC", subs: [] },
  { id: 4, name: "Electrical", subs: [] },
  { id: 5, name: "Roofing", subs: [] },
  { id: 6, name: "Landscaping", subs: [] },
  { id: 7, name: "Cleaning", subs: [] },
  { id: 8, name: "Painting", subs: [] },
  { id: 9, name: "Tree Care", subs: [] },
  { id: 10, name: "Remodeling & Addition", subs: [] },
  { id: 11, name: "New Construction", subs: [] },
  { id: 12, name: "Baby Sitting & Nanny", subs: [] },
  { id: 13, name: "Printing", subs: [] },
  { id: 14, name: "Web Design & Logo Design", subs: [] },
  { id: 15, name: "Photo & Video", subs: [] },
  { id: 16, name: "Auto Repair", subs: [] },
  { id: 17, name: "Small Engine Repair", subs: [] },
  { id: 18, name: "Trash & Junk Removal", subs: [] },
  { id: 19, name: "Tutor & Mentor Counseling", subs: [] },
  { id: 20, name: "Health & Wellness", subs: [] },
  { id: 27, name: "Concrete", subs: [] },
  { id: 28, name: "Lawn Care", subs: [] },
  { id: 29, name: "Dog Sitting", subs: [] },
  { id: 30, name: "Real Estate / Realtors", subs: [] },
  { id: 31, name: "Shopping / Retail", subs: [] },
  { id: 32, name: "Food & Drink", subs: [] },
  { id: 21, name: "Tax CPA", subs: [] },
  { id: 22, name: "Legal", subs: [] },
  { id: 23, name: "Woodworking", subs: [] },
  { id: 24, name: "Baking & Cooking", subs: [] },
  { id: 25, name: "Catering Food Trucks", subs: [] },
  { id: 26, name: "Event Planning & Rentals", subs: ["Event Planning", "Event Rentals", "Event Locations"] },
];

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
              <p className="text-sm text-yellow-600">Rating: 4.8 ★</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default CategoriesGrid;
