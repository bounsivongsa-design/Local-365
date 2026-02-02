import { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Plus } from "lucide-react";

function BestOfEditor() {
  const [category, setCategory] = useState('');
  const [winner, setWinner] = useState('');
  const [runnerUp, setRunnerUp] = useState('');
  const [honorable, setHonorable] = useState('');
  const [rating, setRating] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!category || !winner) {
      setError('Category and Winner are required.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/bestof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          winner,
          runnerUp: runnerUp || 'TBD',
          honorable: honorable || 'TBD',
          rating: rating || '4.5'
        })
      });

      if (response.ok) {
        setSuccess(`"Best ${category}" entry saved successfully!`);
        setCategory('');
        setWinner('');
        setRunnerUp('');
        setHonorable('');
        setRating('');
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to save entry.');
      }
    } catch (err) {
      setError('Failed to save — try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const clearForm = () => {
    setCategory('');
    setWinner('');
    setRunnerUp('');
    setHonorable('');
    setRating('');
    setError(null);
    setSuccess(null);
  };

  return (
    <Card className="p-6 shadow-pop">
      <h2 className="text-2xl font-bold mb-6">Edit Best of OBX</h2>
      <p className="text-muted-foreground mb-6">Add or update category winners for the Best of OBX awards.</p>
      
      <div className="space-y-4">
        <div>
          <Label htmlFor="category">Category *</Label>
          <Input 
            id="category"
            type="text" 
            placeholder="e.g., Deck Builders, Hotels, Restaurants" 
            value={category} 
            onChange={(e) => setCategory(e.target.value)} 
            data-testid="input-bestof-category"
          />
        </div>
        
        <div>
          <Label htmlFor="winner">Winner *</Label>
          <Input 
            id="winner"
            type="text" 
            placeholder="Business name" 
            value={winner} 
            onChange={(e) => setWinner(e.target.value)}
            data-testid="input-bestof-winner"
          />
        </div>
        
        <div>
          <Label htmlFor="runnerUp">Runner-Up</Label>
          <Input 
            id="runnerUp"
            type="text" 
            placeholder="Business name" 
            value={runnerUp} 
            onChange={(e) => setRunnerUp(e.target.value)}
            data-testid="input-bestof-runnerup"
          />
        </div>
        
        <div>
          <Label htmlFor="honorable">Honorable Mention</Label>
          <Input 
            id="honorable"
            type="text" 
            placeholder="Business name" 
            value={honorable} 
            onChange={(e) => setHonorable(e.target.value)}
            data-testid="input-bestof-honorable"
          />
        </div>
        
        <div>
          <Label htmlFor="rating">Rating (e.g., 4.9)</Label>
          <Input 
            id="rating"
            type="text" 
            placeholder="4.9" 
            value={rating} 
            onChange={(e) => setRating(e.target.value)}
            data-testid="input-bestof-rating"
          />
        </div>
        
        <div className="flex gap-3 pt-4">
          <Button 
            onClick={handleSave} 
            disabled={isLoading}
            data-testid="button-save-bestof"
          >
            <Plus className="h-4 w-4 mr-2" />
            {isLoading ? 'Saving...' : 'Save Entry'}
          </Button>
          <Button variant="outline" onClick={clearForm}>
            Clear
          </Button>
        </div>
        
        {error && (
          <div className="flex items-center gap-2 text-red-600 mt-4">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}
        
        {success && (
          <div className="flex items-center gap-2 text-green-600 mt-4">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm">{success}</span>
          </div>
        )}
      </div>
    </Card>
  );
}

export default BestOfEditor;
