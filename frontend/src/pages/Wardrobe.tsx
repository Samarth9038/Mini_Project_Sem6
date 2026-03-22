import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, Image as ImageIcon, Loader2, Plus, Shirt, Footprints, Package, Trash2 } from 'lucide-react';
import { getImageUrl } from '@/lib/utils';

export function Wardrobe() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  const showUpload = searchParams.get('upload') === 'true';

  const fetchWardrobe = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await api.getWardrobe();
      setItems(data.wardrobe || data.items || data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load wardrobe');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWardrobe();
  }, [token]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    try {
      setUploading(true);
      setError('');
      await api.uploadImage(file);
      await fetchWardrobe();
      
      // Remove upload param if present
      if (showUpload) {
        setSearchParams({});
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload image');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (itemId: string | number) => {
    if (!token || !itemId) return;
    
    // Optimistic UI update or just show loading state
    try {
      setDeletingId(itemId);
      await api.deleteItem(itemId);
      // Refresh wardrobe
      await fetchWardrobe();
    } catch (err: any) {
      setError(err.message || 'Failed to delete item');
    } finally {
      setDeletingId(null);
    }
  };

  // Categorize items
  const getCategoryString = (cat: any) => {
    if (typeof cat === 'string') return cat.toLowerCase();
    if (Array.isArray(cat)) return cat.join(' ').toLowerCase();
    return '';
  };

  const upperWear = items.filter(item => {
    const cat = getCategoryString(item.category);
    return cat.includes('shirt') || cat.includes('top') || cat.includes('t-shirt') || cat.includes('jacket') || cat.includes('sweater') || cat.includes('hoodie') || cat.includes('coat');
  });

  const bottomWear = items.filter(item => {
    const cat = getCategoryString(item.category);
    return cat.includes('pant') || cat.includes('jeans') || cat.includes('short') || cat.includes('skirt') || cat.includes('trouser') || cat.includes('legging');
  });

  const otherWear = items.filter(item => !upperWear.includes(item) && !bottomWear.includes(item));

  const renderItemGrid = (gridItems: any[]) => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {gridItems.map((item, idx) => (
        <div key={idx} className="group relative aspect-square rounded-2xl overflow-hidden bg-zinc-100 border border-zinc-200">
          <img 
            src={getImageUrl(item)} 
            alt={`Wardrobe item ${idx + 1}`} 
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://placehold.co/400x400?text=Image+Not+Found';
            }}
          />
          <button
            onClick={() => handleDelete(item.id || item.local_path)}
            disabled={deletingId === (item.id || item.local_path)}
            className="absolute top-2 right-2 p-2 bg-white/80 hover:bg-red-50 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 shadow-sm"
            title="Remove item"
          >
            {deletingId === (item.id || item.local_path) ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
          {item.category && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-8">
              <p className="text-white text-xs font-medium capitalize truncate">
                {typeof item.category === 'string' ? item.category : (Array.isArray(item.category) ? item.category.join(', ') : 'Item')}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Wardrobe</h1>
          <p className="text-zinc-500">Manage your digital clothing collection.</p>
        </div>
        <Button 
          onClick={() => fileInputRef.current?.click()} 
          className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 rounded-xl h-11 px-6"
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Plus className="w-5 h-5 mr-2" />
          )}
          Add Item
        </Button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="image/*" 
          className="hidden" 
        />
      </div>

      {error && (
        <div className="p-4 text-sm text-red-600 bg-red-50 rounded-xl border border-red-100">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-600" />
          <p>Loading your wardrobe...</p>
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed border-2 bg-zinc-50/50">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
              <ImageIcon className="w-8 h-8 text-zinc-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Your wardrobe is empty</h3>
            <p className="text-zinc-500 mb-6 max-w-sm">
              Upload photos of your clothes to start getting AI-powered outfit suggestions.
            </p>
            <Button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload First Item
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-10">
          {upperWear.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                  <Shirt className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-semibold text-zinc-800">Upper Wear</h2>
                <span className="ml-2 text-sm text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">{upperWear.length}</span>
              </div>
              {renderItemGrid(upperWear)}
            </section>
          )}

          {bottomWear.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                  <Footprints className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-semibold text-zinc-800">Bottom Wear</h2>
                <span className="ml-2 text-sm text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">{bottomWear.length}</span>
              </div>
              {renderItemGrid(bottomWear)}
            </section>
          )}

          {otherWear.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-zinc-100 text-zinc-600 rounded-lg">
                  <Package className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-semibold text-zinc-800">Other Items</h2>
                <span className="ml-2 text-sm text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">{otherWear.length}</span>
              </div>
              {renderItemGrid(otherWear)}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
