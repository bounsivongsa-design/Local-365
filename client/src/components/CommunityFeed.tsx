import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Star, MapPin, Calendar, Trophy, Heart, TrendingUp } from "lucide-react";
import BestOfGrid from "./BestOfGrid";
import BestOfEditor from "./BestOfEditor";
import { useAuth } from "@/hooks/use-auth";

function CommunityFeed() {
  const [activeTab, setActiveTab] = useState<'feed' | 'bestof' | 'events'>('feed');
  const { isAuthenticated } = useAuth();

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
        <div className="py-8 animate-in fade-in duration-300">
          <h2 className="text-3xl font-bold mb-6">Best of OBX 2026</h2>
          <p className="mb-8 text-muted-foreground">Celebrating the top local businesses based on verified reviews & performance.</p>
          <BestOfGrid />
          
          {isAuthenticated && (
            <div className="mt-12 pt-8 border-t">
              <BestOfEditor />
            </div>
          )}
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
