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
    return <p className="text-destructive">{error}</p>;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {categories.map((cat) => (
        <div key={cat.id} className="card-3d bg-blue-100 p-4 text-center" data-testid={`card-category-${cat.id}`}>
          <h3 className="font-bold">{cat.name}</h3>
          {cat.subs && cat.subs.map((sub, j) => <p key={j} className="text-sm">{sub}</p>)}
        </div>
      ))}
    </div>
  );
}

export default CategoriesGrid;
