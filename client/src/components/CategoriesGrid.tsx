import { useEffect, useState } from 'react';

interface Category {
  id: number;
  name: string;
  subs: string[];
}

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
        setCategories(data || []);
      } catch (err) {
        setError('Failed to load categories — try refreshing.');
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
          data-testid={`card-category-${cat.id}`}
        >
          <h3 
            className="font-bold hover:text-primary transition-colors"
            onClick={() => toggleExpand(cat.id)}
          >
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
