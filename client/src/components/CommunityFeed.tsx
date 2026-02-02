function CommunityFeed() {
  return (
    <div className="py-8">
      <h2 className="text-3xl font-bold mb-6">Community Feed</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-3d">
          <h3 className="text-xl font-bold mb-2">No posts yet</h3>
          <p className="text-gray-600">Be the first to share something with the community!</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-3d">
          <h3 className="text-xl font-bold mb-2">Latest Updates</h3>
          <p className="text-gray-600">Dummy update: Wild horse sighting in Corolla!</p>
        </div>
      </div>
      <h2 className="text-2xl font-bold mt-8 mb-4">Local Gems</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-3d">
          <img src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=400" alt="Green Leaf Market" className="w-full h-32 object-cover mb-2 rounded" />
          <h4 className="font-bold">Green Leaf Market</h4>
          <p className="text-sm text-gray-600">Retail ★ 4.8</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-3d">
          <img src="https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=400" alt="The Daily Grind" className="w-full h-32 object-cover mb-2 rounded" />
          <h4 className="font-bold">The Daily Grind</h4>
          <p className="text-sm text-gray-600">Food ★ 4.9</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-3d">
          <img src="https://images.unsplash.com/photo-1599447421405-0c1741427447?w=400" alt="City Yoga Studio" className="w-full h-32 object-cover mb-2 rounded" />
          <h4 className="font-bold">City Yoga Studio</h4>
          <p className="text-sm text-gray-600">Service ★ 4.7</p>
        </div>
      </div>
      <h2 className="text-2xl font-bold mt-8 mb-4">Upcoming Events</h2>
      <div className="bg-white p-4 rounded-lg shadow-3d">
        <img src="https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=400" alt="Community Farmers Market" className="w-full h-32 object-cover mb-2 rounded" />
        <h4 className="font-bold">Community Farmers Market</h4>
        <p className="text-sm text-gray-600">Town Square — Fresh veggies, local crafts, live music.</p>
        <p className="text-sm text-gray-500">Feb 7</p>
      </div>
    </div>
  );
}

export default CommunityFeed;
