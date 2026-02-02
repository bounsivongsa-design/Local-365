interface Category {
  name: string;
  subs?: string[];
}

function CategoriesGrid() {
  const categories: Category[] = [
    { name: 'Concrete' },
    { name: 'Home Repair' },
    { name: 'Paint' },
    { name: 'Landscaping' },
    { name: 'Plumbing' },
    { name: 'HVAC' },
    { name: 'Cleaning', subs: ['Auto Detailing', 'House Cleaning', 'Business Cleaning'] },
    { name: 'Roofing' },
    { name: 'Electrical' },
    { name: 'Tree' },
    { name: 'Lawn Care' },
    { name: 'Remodeling Addition' },
    { name: 'New Construction' },
    { name: 'Baby Sitting Home Sitting Dog Sitting Nanny', subs: ['Baby Sitting', 'Dog Sitting', 'Home Sitting', 'Nanny'] },
    { name: 'Printing', subs: ['Apparel', 'Signs', 'Vinyl', 'Paper'] },
    { name: 'Web Design Logo Design', subs: ['Web Design', 'Logo Design', 'IT Network'] },
    { name: 'Photo Video' },
    { name: 'Auto Repair', subs: ['Diesel Engine', 'Gas Engine', 'EV', 'Body'] },
    { name: 'Small Engine Repair' },
    { name: 'Trash Junk Removal' },
    { name: 'Tutor Mentor Counseling' },
    { name: 'Mind Body Soul' },
    { name: 'Tax CPA' },
    { name: 'Legal' },
    { name: 'Woodworking Lazer CNC' },
    { name: 'Baking Cooking' },
    { name: 'Catering Food Trucks' },
    { name: 'Event Planning & Rentals', subs: ['Event Planning', 'Event Rentals', 'Event Locations'] },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {categories.map((cat, i) => (
        <div key={i} className="bg-blue-100 p-4 rounded-lg text-center" data-testid={`card-category-${i}`}>
          <h3 className="font-bold">{cat.name}</h3>
          {cat.subs && cat.subs.map((sub, j) => <p key={j} className="text-sm">{sub}</p>)}
        </div>
      ))}
    </div>
  );
}

export default CategoriesGrid;
