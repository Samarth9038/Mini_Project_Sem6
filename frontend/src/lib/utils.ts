import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getImageUrl(item: any): string {
  if (!item) return 'https://placehold.co/400x400?text=No+Image';
  
  const path = item.local_path || item.image_link || item.image_url || item.path || (typeof item === 'string' ? item : '');
  
  if (!path) return 'https://placehold.co/400x400?text=No+Image';
  if (path.startsWith('http')) return path;
  if (path.startsWith('data:')) return path;
  
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `https://zkb6w7wk-8000.inc1.devtunnels.ms${cleanPath}`;
}
