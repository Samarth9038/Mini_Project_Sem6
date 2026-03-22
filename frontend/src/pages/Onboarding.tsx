import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Sparkles, Camera, Upload, ArrowRight, Loader2, Check, UserCircle } from 'lucide-react';

const extractSkinTone = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve('#e0ac69');
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const startX = Math.floor(img.width * 0.4);
      const startY = Math.floor(img.height * 0.4);
      const width = Math.floor(img.width * 0.2);
      const height = Math.floor(img.height * 0.2);
      
      const imageData = ctx.getImageData(startX, startY, width, height);
      const data = imageData.data;
      
      let r = 0, g = 0, b = 0;
      let count = 0;
      
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 20 && data[i] < 250) {
          r += data[i];
          g += data[i+1];
          b += data[i+2];
          count++;
        }
      }
      
      if (count === 0) return resolve('#e0ac69');
      
      r = Math.floor(r / count);
      g = Math.floor(g / count);
      b = Math.floor(b / count);
      
      const hex = '#' + [r, g, b].map(x => {
        const h = x.toString(16);
        return h.length === 1 ? '0' + h : h;
      }).join('');
      
      resolve(hex);
    };
    img.src = URL.createObjectURL(file);
  });
};

export function Onboarding() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [bodyShape, setBodyShape] = useState('rectangular');
  const [skinTone, setSkinTone] = useState('#e0ac69');
  
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const faceInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraMode, setCameraMode] = useState<'face' | 'item'>('item');

  const [faceFile, setFaceFile] = useState<File | null>(null);

  const handleNext = async () => {
    if (step === 1) {
      localStorage.setItem('style_engine_body_shape', bodyShape);
      setStep(2);
    } else if (step === 2) {
      localStorage.setItem('style_engine_skin_tone', skinTone);
      setStep(3);
    } else {
      try {
        setUploading(true);
        await api.updateProfile(bodyShape, skinTone, faceFile || undefined);
        localStorage.setItem('style_engine_onboarded', 'true');
        navigate('/');
      } catch (err) {
        console.error("Failed to update profile", err);
        alert("Failed to save profile. Please try again.");
      } finally {
        setUploading(false);
      }
    }
  };

  const startCamera = async (mode: 'face' | 'item') => {
    try {
      setCameraMode(mode);
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: mode === 'face' ? 'user' : 'environment' } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setShowCamera(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access camera. Please upload a file instead.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(videoRef.current, 0, 0);
    
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
      
      if (cameraMode === 'face') {
        await handleFaceUpload(file);
      } else {
        await handleItemUpload(file);
      }
      stopCamera();
    }, 'image/jpeg');
  };

  const handleFaceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFaceUpload(file);
    }
  };

  const handleItemFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleItemUpload(file);
    }
  };

  const handleFaceUpload = async (file: File) => {
    setUploading(true);
    try {
      setFaceFile(file);
      
      // Save profile picture to localStorage
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          localStorage.setItem('style_engine_profile_picture', reader.result);
        }
      };
      reader.readAsDataURL(file);

      // Simulate a small delay for "AI processing"
      await new Promise(r => setTimeout(r, 1500));
      const detectedTone = await extractSkinTone(file);
      setSkinTone(detectedTone);
      localStorage.setItem('style_engine_skin_tone', detectedTone);
      setStep(3);
    } catch (err) {
      console.error("Face processing failed", err);
      alert("Failed to process face. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleItemUpload = async (file: File) => {
    if (!token) return;
    try {
      setUploading(true);
      await api.uploadImage(file);
      setUploaded(true);
    } catch (err) {
      console.error("Upload failed", err);
      alert("Failed to upload image. You can try again later.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-zinc-200/60 overflow-hidden">
        <div className="flex h-2 bg-zinc-100">
          <div 
            className="h-full bg-indigo-600 transition-all duration-500" 
            style={{ width: `${(step / 3) * 100}%` }} 
          />
        </div>
        
        {step === 1 && (
          <>
            <CardHeader className="space-y-2 text-center pt-8">
              <div className="flex justify-center mb-2">
                <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">Body Shape</CardTitle>
              <CardDescription>Tell us about yourself for better outfit suggestions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {['rectangular', 'triangle', 'inverted triangle', 'hourglass', 'apple'].map((shape) => (
                    <div 
                      key={shape}
                      onClick={() => setBodyShape(shape)}
                      className={`p-3 rounded-xl border-2 cursor-pointer text-center capitalize text-sm font-medium transition-colors ${
                        bodyShape === shape 
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                          : 'border-zinc-200 hover:border-indigo-200 text-zinc-600'
                      }`}
                    >
                      {shape}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleNext} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-11">
                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardFooter>
          </>
        )}

        {step === 2 && (
          <>
            <CardHeader className="space-y-2 text-center pt-8">
              <div className="flex justify-center mb-2">
                <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center">
                  <UserCircle className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">Skin Tone Detection</CardTitle>
              <CardDescription>Take a photo of your face in good lighting to auto-detect your skin tone.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {showCamera ? (
                <div className="space-y-4">
                  <div className="relative aspect-square bg-black rounded-2xl overflow-hidden">
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                    <div className="absolute inset-0 border-4 border-indigo-500/30 rounded-2xl pointer-events-none m-8 border-dashed" />
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={stopCamera} className="flex-1">Cancel</Button>
                    <Button onClick={capturePhoto} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">
                      Capture
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  <Button 
                    variant="outline" 
                    className="h-24 flex flex-col items-center justify-center gap-2 border-dashed border-2 hover:bg-zinc-50 hover:border-indigo-300"
                    onClick={() => startCamera('face')}
                    disabled={uploading}
                  >
                    <Camera className="w-6 h-6 text-zinc-500" />
                    <span className="text-sm font-medium text-zinc-700">Take a selfie</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="h-24 flex flex-col items-center justify-center gap-2 border-dashed border-2 hover:bg-zinc-50 hover:border-indigo-300"
                    onClick={() => faceInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                        <span className="text-sm font-medium text-zinc-700">Analyzing skin tone...</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-zinc-500" />
                        <span className="text-sm font-medium text-zinc-700">Upload photo</span>
                      </>
                    )}
                  </Button>
                  <input 
                    type="file" 
                    ref={faceInputRef} 
                    onChange={handleFaceFileChange} 
                    accept="image/*" 
                    className="hidden" 
                  />
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={handleNext} variant="ghost" className="w-full h-11 text-zinc-500" disabled={uploading}>
                Skip this step
              </Button>
            </CardFooter>
          </>
        )}

        {step === 3 && (
          <>
            <CardHeader className="space-y-2 text-center pt-8">
              <div className="flex justify-center mb-2">
                <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center">
                  <Camera className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">Add your first item</CardTitle>
              <CardDescription>Take a picture or upload a photo of a clothing item</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {uploaded ? (
                <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                    <Check className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Item added successfully!</h3>
                    <p className="text-sm text-zinc-500">Your wardrobe is starting to grow.</p>
                  </div>
                </div>
              ) : showCamera ? (
                <div className="space-y-4">
                  <div className="relative aspect-[3/4] bg-black rounded-2xl overflow-hidden">
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={stopCamera} className="flex-1">Cancel</Button>
                    <Button onClick={capturePhoto} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">
                      Capture
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  <Button 
                    variant="outline" 
                    className="h-24 flex flex-col items-center justify-center gap-2 border-dashed border-2 hover:bg-zinc-50 hover:border-indigo-300"
                    onClick={() => startCamera('item')}
                    disabled={uploading}
                  >
                    <Camera className="w-6 h-6 text-zinc-500" />
                    <span className="text-sm font-medium text-zinc-700">Take a picture</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="h-24 flex flex-col items-center justify-center gap-2 border-dashed border-2 hover:bg-zinc-50 hover:border-indigo-300"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-zinc-500" />
                        <span className="text-sm font-medium text-zinc-700">Upload from gallery</span>
                      </>
                    )}
                  </Button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleItemFileChange} 
                    accept="image/*" 
                    className="hidden" 
                  />
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={handleNext} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-11" disabled={uploading}>
                {uploaded ? "Go to Dashboard" : "Skip for now"} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
}
