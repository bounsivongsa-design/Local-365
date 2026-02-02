import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Star, MapPin, Calendar, Trophy, Heart, TrendingUp } from "lucide-react";

function CommunityFeed() {
  const [activeTab, setActiveTab] = useState<'feed' | 'bestof' | 'events'>('feed');

  const bestOfCategories = [
    { title: "Best Seafood Restaurant", winner: "Awful Arthur's Oyster Bar", location: "Kill Devil Hills", rating: 4.9, image: "https://images.unsplash.com/photo-1579631542720-3a87824fff86?w=400&h=300&fit=crop" },
    { title: "Best Beach Access", winner: "Coquina Beach", location: "Nags Head", rating: 4.8, image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=300&fit=crop" },
    { title: "Best Sunset Spot", winner: "Jockey's Ridge State Park", location: "Nags Head", rating: 5.0, image: "https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=400&h=300&fit=crop" },
    { title: "Best Coffee Shop", winner: "Front Porch Cafe", location: "Duck", rating: 4.7, image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop" },
    { title: "Best Wild Horse Tour", winner: "Corolla Wild Horse Tours", location: "Corolla", rating: 4.9, image: "https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=400&h=300&fit=crop" },
    { title: "Best Ice Cream", winner: "Surfin' Spoon", location: "Kitty Hawk", rating: 4.8, image: "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=400&h=300&fit=crop" },
  ];

  const upcomingEvents = [
    { title: "Community Farmers Market", date: "Feb 7, 2026", location: "Town Square, Manteo", description: "Fresh veggies, local crafts, and live music.", image: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=400&h=300&fit=crop" },
    { title: "OBX Home & Garden Show", date: "Feb 15, 2026", location: "Currituck Community Center", description: "Meet local contractors and home service providers.", image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=300&fit=crop" },
    { title: "Wright Brothers Day", date: "Dec 17, 2026", location: "Wright Brothers Memorial", description: "Celebrate the anniversary of powered flight.", image: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=400&h=300&fit=crop" },
  ];

  const communityPosts = [
    { author: "Sarah M.", content: "Just saw a pod of dolphins off Duck Pier! Amazing morning.", time: "2 hours ago", likes: 24 },
    { author: "Mike T.", content: "Wild horse sighting in Corolla this morning - saw about 8 of them on the beach!", time: "5 hours ago", likes: 89 },
    { author: "Local Tip", content: "The sunset at Jockey's Ridge tonight is going to be incredible - clear skies!", time: "6 hours ago", likes: 156 },
  ];

  return (
    <div className="py-8">
      <div className="flex items-center gap-6 border-b mb-6 pb-2">
        <button 
          onClick={() => setActiveTab('feed')} 
          data-testid="tab-feed"
          className={`flex items-center gap-2 pb-2 border-b-2 transition ${activeTab === 'feed' ? 'border-primary text-primary font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <TrendingUp className="h-4 w-4" />
          Community Feed
        </button>
        <button 
          onClick={() => setActiveTab('bestof')} 
          data-testid="tab-bestof"
          className={`flex items-center gap-2 pb-2 border-b-2 transition ${activeTab === 'bestof' ? 'border-primary text-primary font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <Trophy className="h-4 w-4" />
          Best of OBX
        </button>
        <button 
          onClick={() => setActiveTab('events')} 
          data-testid="tab-events"
          className={`flex items-center gap-2 pb-2 border-b-2 transition ${activeTab === 'events' ? 'border-primary text-primary font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <Calendar className="h-4 w-4" />
          Events
        </button>
      </div>

      {activeTab === 'feed' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <h2 className="text-2xl font-bold">What's Happening in OBX</h2>
          {communityPosts.map((post, index) => (
            <Card key={index} className="p-4 shadow-lg shadow-black/5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-sm">{post.author}</p>
                  <p className="text-foreground mt-1">{post.content}</p>
                  <p className="text-xs text-muted-foreground mt-2">{post.time}</p>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Heart className="h-4 w-4" />
                  <span className="text-sm">{post.likes}</span>
                </div>
              </div>
            </Card>
          ))}
          
          <h3 className="text-xl font-bold mt-8 mb-4">Local Gems</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="overflow-hidden shadow-lg shadow-black/5">
              <img src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=400" alt="Green Leaf Market" className="w-full h-32 object-cover" />
              <div className="p-4">
                <h4 className="font-bold">Outer Banks Pier</h4>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Nags Head
                  <Star className="h-3 w-3 ml-2 text-yellow-500" /> 4.8
                </p>
              </div>
            </Card>
            <Card className="overflow-hidden shadow-lg shadow-black/5">
              <img src="https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=400" alt="The Daily Grind" className="w-full h-32 object-cover" />
              <div className="p-4">
                <h4 className="font-bold">Duck Donuts</h4>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Duck
                  <Star className="h-3 w-3 ml-2 text-yellow-500" /> 4.9
                </p>
              </div>
            </Card>
            <Card className="overflow-hidden shadow-lg shadow-black/5">
              <img src="https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400" alt="Yoga Studio" className="w-full h-32 object-cover" />
              <div className="p-4">
                <h4 className="font-bold">Serenity Wellness</h4>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Duck
                  <Star className="h-3 w-3 ml-2 text-yellow-500" /> 4.7
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'bestof' && (
        <div className="animate-in fade-in duration-300">
          <div className="flex items-center gap-3 mb-6">
            <Trophy className="h-8 w-8 text-yellow-500" />
            <div>
              <h2 className="text-2xl font-bold">Best of OBX 2026</h2>
              <p className="text-muted-foreground">Community-voted favorites in the Outer Banks</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bestOfCategories.map((item, index) => (
              <Card key={index} className="overflow-hidden shadow-lg shadow-black/5 hover:shadow-xl transition-shadow">
                <div className="relative">
                  <img src={item.image} alt={item.winner} className="w-full h-40 object-cover" />
                  <div className="absolute top-2 left-2 bg-yellow-500 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                    <Trophy className="h-3 w-3" />
                    WINNER
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-xs text-primary font-semibold uppercase tracking-wide">{item.title}</p>
                  <h4 className="font-bold text-lg mt-1">{item.winner}</h4>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {item.location}
                    </p>
                    <p className="text-sm flex items-center gap-1">
                      <Star className="h-3 w-3 text-yellow-500" /> {item.rating}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'events' && (
        <div className="animate-in fade-in duration-300">
          <h2 className="text-2xl font-bold mb-6">Upcoming Events</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingEvents.map((event, index) => (
              <Card key={index} className="overflow-hidden shadow-lg shadow-black/5">
                <img src={event.image} alt={event.title} className="w-full h-40 object-cover" />
                <div className="p-4">
                  <div className="flex items-center gap-2 text-primary text-sm font-medium mb-2">
                    <Calendar className="h-4 w-4" />
                    {event.date}
                  </div>
                  <h4 className="font-bold text-lg">{event.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {event.location}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">{event.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CommunityFeed;
