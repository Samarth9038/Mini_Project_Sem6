import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Palette, Ruler, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Profile() {
  const { logout, username, profilePicture } = useAuth();
  const [profileData, setProfileData] = useState({
    username: '',
    profilePicture: '',
    bodyShape: '',
    skinTone: ''
  });

  useEffect(() => {
    // Load data from localStorage or API
    const storedBodyShape = localStorage.getItem('style_engine_body_shape') || 'Not set';
    const storedSkinTone = localStorage.getItem('style_engine_skin_tone') || 'Not set';
    
    setProfileData({
      username: username || localStorage.getItem('username') || 'User',
      profilePicture: profilePicture || localStorage.getItem('style_engine_profile_picture') || '',
      bodyShape: storedBodyShape,
      skinTone: storedSkinTone
    });
  }, [username, profilePicture]);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-zinc-500">Manage your personal information and preferences.</p>
      </div>

      <Card className="border-zinc-200/60 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 h-32"></div>
        <CardContent className="pt-6 px-6 pb-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 -mt-20 sm:-mt-24 mb-8 relative z-10">
            <div className="w-28 h-28 sm:w-32 sm:h-32 bg-white rounded-full p-1.5 shadow-md shrink-0">
              {profileData.profilePicture ? (
                <img src={profileData.profilePicture} alt="Profile" className="w-full h-full rounded-full object-cover" />
              ) : (
                <div className="w-full h-full bg-zinc-100 rounded-full flex items-center justify-center">
                  <User className="w-12 h-12 text-zinc-400" />
                </div>
              )}
            </div>
            
            <div className="flex flex-col items-center sm:items-start pb-2 sm:pb-4">
              <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900">{profileData.username}</h2>
              <p className="text-zinc-500 font-medium">GRWM Member</p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex items-start gap-4 p-4 rounded-xl bg-zinc-50 border border-zinc-100">
              <div className="p-2 bg-white rounded-lg shadow-sm border border-zinc-200">
                <Ruler className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-500">Body Shape</p>
                <p className="text-lg font-semibold text-zinc-900 capitalize">{profileData.bodyShape}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-xl bg-zinc-50 border border-zinc-100">
              <div className="p-2 bg-white rounded-lg shadow-sm border border-zinc-200">
                <Palette className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-500">Skin Tone</p>
                <div className="flex items-center gap-2 mt-1">
                  {profileData.skinTone !== 'Not set' && (
                    <div 
                      className="w-5 h-5 rounded-full border border-zinc-200 shadow-inner shrink-0" 
                      style={{ backgroundColor: profileData.skinTone }}
                    />
                  )}
                  <p className="text-lg font-semibold text-zinc-900 uppercase">
                    {profileData.skinTone !== 'Not set' ? profileData.skinTone : 'Not set'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-zinc-100">
            <Button 
              variant="outline" 
              className="w-full sm:w-auto rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              onClick={logout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
