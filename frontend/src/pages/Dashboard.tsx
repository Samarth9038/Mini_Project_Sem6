import { Link } from 'react-router-dom';
import { Shirt, Sparkles, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-zinc-500">Welcome to GRWM. What would you like to do today?</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:border-indigo-200 transition-colors group">
          <CardHeader className="pb-4">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-2 group-hover:bg-indigo-100 transition-colors">
              <Shirt className="w-5 h-5 text-indigo-600" />
            </div>
            <CardTitle>My Wardrobe</CardTitle>
            <CardDescription>View and manage your uploaded clothing items.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/wardrobe">
              <Button variant="secondary" className="w-full">View Wardrobe</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:border-indigo-200 transition-colors group">
          <CardHeader className="pb-4">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-2 group-hover:bg-indigo-100 transition-colors">
              <Sparkles className="w-5 h-5 text-indigo-600" />
            </div>
            <CardTitle>Get Suggestions</CardTitle>
            <CardDescription>Let AI build the perfect outfit for any occasion.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/suggest">
              <Button variant="secondary" className="w-full">Predict Outfit</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:border-indigo-200 transition-colors group md:col-span-2 lg:col-span-1">
          <CardHeader className="pb-4">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-2 group-hover:bg-indigo-100 transition-colors">
              <Upload className="w-5 h-5 text-indigo-600" />
            </div>
            <CardTitle>Add New Item</CardTitle>
            <CardDescription>Upload a new piece of clothing to your digital wardrobe.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/wardrobe?upload=true">
              <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">Upload Item</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
