import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Sparkles, Loader2, ArrowRight, User, Palette } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { getImageUrl } from '@/lib/utils';

export function Suggest() {
  const { token } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [skinTone, setSkinTone] = useState('#e0ac69');
  const [bodyShape, setBodyShape] = useState('rectangular');
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const savedSkinTone = localStorage.getItem('style_engine_skin_tone');
    const savedBodyShape = localStorage.getItem('style_engine_body_shape');
    if (savedSkinTone) setSkinTone(savedSkinTone);
    if (savedBodyShape) setBodyShape(savedBodyShape);
  }, []);

  const handleSuggest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !prompt) return;

    try {
      setLoading(true);
      setError('');
      setSuggestion(null);
      const data = await api.suggest(prompt, skinTone, bodyShape);
      setSuggestion(data);
    } catch (err: any) {
      setError(err.message || 'Failed to generate suggestion');
    } finally {
      setLoading(false);
    }
  };

  // Robust parsing of the suggestion
  let parsedSuggestion = suggestion;
  let suggestionText = '';
  let suggestedItems: any[] = [];

  if (suggestion) {
    // Try to parse stringified JSON if present
    if (typeof suggestion === 'string') {
      try {
        parsedSuggestion = JSON.parse(suggestion);
      } catch (e) {
        suggestionText = suggestion;
      }
    } else if (typeof suggestion.suggestion === 'string') {
      try {
        const parsed = JSON.parse(suggestion.suggestion);
        parsedSuggestion = { ...suggestion, ...parsed };
      } catch (e) {
        suggestionText = suggestion.suggestion;
      }
    } else if (typeof suggestion.text === 'string') {
      suggestionText = suggestion.text;
    } else if (typeof suggestion.message === 'string') {
      suggestionText = suggestion.message;
    } else if (typeof suggestion.explanation === 'string') {
      suggestionText = suggestion.explanation;
    }

    // Extract items
    if (parsedSuggestion.shirt && parsedSuggestion.pants) {
      suggestedItems = [parsedSuggestion.shirt, parsedSuggestion.pants];
    } else if (parsedSuggestion.upper_wear && parsedSuggestion.bottom_wear) {
      suggestedItems = [parsedSuggestion.upper_wear, parsedSuggestion.bottom_wear];
    } else if (parsedSuggestion.outfit && typeof parsedSuggestion.outfit === 'object') {
      if (Array.isArray(parsedSuggestion.outfit)) {
        suggestedItems = parsedSuggestion.outfit;
      } else {
        suggestedItems = Object.values(parsedSuggestion.outfit).filter(v => v && typeof v === 'object' && (v as any).local_path);
      }
    } else if (parsedSuggestion.items && Array.isArray(parsedSuggestion.items)) {
      suggestedItems = parsedSuggestion.items;
    } else {
      // Fallback: look for any object with a local_path
      for (const key in parsedSuggestion) {
        const val = parsedSuggestion[key];
        if (val && typeof val === 'object' && val.local_path) {
          suggestedItems.push(val);
        }
      }
    }
    
    if (!suggestionText && parsedSuggestion.explanation) {
      suggestionText = parsedSuggestion.explanation;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Outfit Suggestions</h1>
        <p className="text-zinc-500">Let AI build the perfect outfit from your wardrobe.</p>
      </div>

      <div className="grid md:grid-cols-12 gap-6">
        <div className="md:col-span-5 lg:col-span-4 space-y-6">
          <Card className="border-zinc-200/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Preferences</CardTitle>
              <CardDescription>Tell us what you're looking for</CardDescription>
            </CardHeader>
            <form onSubmit={handleSuggest}>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700">Occasion / Prompt</label>
                  <Input
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g. A casual summer date"
                    required
                    className="bg-zinc-50/50"
                  />
                </div>
                
                <div className="space-y-3 pt-4 border-t border-zinc-100">
                  <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Your Profile</h4>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3 bg-zinc-50/50 p-3 rounded-xl border border-zinc-100">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 font-medium">Body Shape</p>
                        <p className="text-sm font-semibold text-zinc-800 capitalize">{bodyShape}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 bg-zinc-50/50 p-3 rounded-xl border border-zinc-100">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                        <Palette className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-zinc-500 font-medium">Skin Tone</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div 
                            className="w-4 h-4 rounded-full border border-zinc-300 shadow-sm shrink-0" 
                            style={{ backgroundColor: typeof skinTone === 'string' ? skinTone : '#e0ac69' }}
                          />
                          <p className="text-sm font-semibold text-zinc-800 uppercase">{typeof skinTone === 'string' ? skinTone : 'Detected'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  type="submit" 
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11" 
                  disabled={loading || !prompt}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  Generate Outfit
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>

        <div className="md:col-span-7 lg:col-span-8">
          {error && (
            <div className="p-4 mb-6 text-sm text-red-600 bg-red-50 rounded-xl border border-red-100">
              {error}
            </div>
          )}

          {loading ? (
            <Card className="h-full min-h-[400px] flex flex-col items-center justify-center border-dashed border-2 bg-zinc-50/50">
              <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-600" />
              <h3 className="text-xl font-semibold mb-2">Analyzing your wardrobe</h3>
              <p className="text-zinc-500 text-center max-w-sm">
                Our AI is matching your items to create the perfect look for "{prompt}".
              </p>
            </Card>
          ) : suggestion ? (
            <Card className="overflow-hidden border-zinc-200/60 shadow-sm">
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
                <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                  <Sparkles className="w-6 h-6" />
                  Your Perfect Outfit
                </h3>
                <p className="text-indigo-100">Tailored for your {bodyShape} body shape and skin tone.</p>
              </div>
              <CardContent className="p-0">
                {suggestionText && (
                  <div className="p-6 border-b border-zinc-100 bg-zinc-50/30">
                    <div className="prose prose-zinc max-w-none text-zinc-700">
                      <ReactMarkdown>{suggestionText}</ReactMarkdown>
                    </div>
                  </div>
                )}
                
                {suggestedItems.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6">
                    {suggestedItems.map((item: any, idx: number) => (
                      <div key={idx} className="flex flex-col items-center bg-white border border-zinc-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                        <h3 className="text-lg font-bold text-zinc-800 capitalize mb-4 text-center">
                          {item.formality ? `${typeof item.formality === 'string' ? item.formality : (Array.isArray(item.formality) ? item.formality.join(' ') : '')} ` : ''}
                          {typeof item.category === 'string' ? item.category : (Array.isArray(item.category) ? item.category.join(' ') : 'Clothing Item')}
                        </h3>
                        <div className="w-full h-56 flex justify-center items-center bg-zinc-50 rounded-lg overflow-hidden mb-4">
                          <img
                            src={getImageUrl(item)}
                            alt={item.category || 'Clothing Item'}
                            className="max-h-full max-w-full object-contain mix-blend-multiply"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://placehold.co/400x400?text=Image+Not+Found';
                            }}
                          />
                        </div>
                        <div className="flex items-center gap-2 mt-auto w-full justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-zinc-600">Color:</span>
                            <div
                              className="w-6 h-6 rounded-full border border-zinc-300 shadow-inner shrink-0"
                              style={{ backgroundColor: Array.isArray(item.rgb_color) ? `rgb(${item.rgb_color.join(",")})` : (typeof item.color === 'string' ? item.color : '#ccc') }}
                            />
                          </div>
                          {item.fit && (
                            <span className="text-xs font-medium bg-zinc-100 text-zinc-600 px-2 py-1 rounded-md capitalize text-center">
                              {typeof item.fit === 'string' ? item.fit : (Array.isArray(item.fit) ? item.fit.join(' ') : 'Regular')} Fit
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  !suggestionText && (
                    <div className="p-6">
                      <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-700 bg-zinc-50 p-4 rounded-xl border border-zinc-200 overflow-auto">
                        {JSON.stringify(parsedSuggestion, null, 2)}
                      </pre>
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full min-h-[400px] flex flex-col items-center justify-center border-dashed border-2 bg-zinc-50/50">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                <Sparkles className="w-8 h-8 text-zinc-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Ready for styling</h3>
              <p className="text-zinc-500 text-center max-w-sm mb-6">
                Fill out the preferences on the left and click generate to see your AI outfit suggestion.
              </p>
              <div className="flex items-center text-sm text-indigo-600 font-medium">
                <ArrowRight className="w-4 h-4 mr-2 hidden md:block" />
                Start by entering an occasion
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

