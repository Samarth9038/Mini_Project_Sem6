const BASE_URL = 'https://zkb6w7wk-8001.inc1.devtunnels.ms';

async function handleResponse(res: Response) {
  if (!res.ok) {
    let errorMessage = 'An error occurred';
    try {
      const errorData = await res.json();
      errorMessage = errorData.detail || errorData.message || JSON.stringify(errorData);
    } catch {
      errorMessage = await res.text();
    }
    throw new Error(errorMessage);
  }
  return res.json();
}

export const api = {
  async register(username: string, password: string) {
    const res = await fetch(`${BASE_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return handleResponse(res);
  },

  async login(username: string, password: string) {
    const res = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return handleResponse(res);
  },

  async uploadImage(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    
    const res = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData,
    });
    return handleResponse(res);
  },

  async getWardrobe() {
    const res = await fetch(`${BASE_URL}/api/wardrobe`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
    });
    return handleResponse(res);
  },

  async deleteItem(itemId: string | number) {
    const res = await fetch(`${BASE_URL}/api/wardrobe/${itemId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
    });
    return handleResponse(res);
  },

  async suggest(prompt: string, skin_tone?: string, body_shape?: string) {
    const res = await fetch(`${BASE_URL}/api/suggest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ prompt, skin_tone, body_shape }),
    });
    return handleResponse(res);
  },

  async getProfile() {
    const res = await fetch(`${BASE_URL}/api/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
    });
    return handleResponse(res);
  },

  async updateProfile(body_shape?: string, skin_tone?: string, profile_picture?: File) {
    const formData = new FormData();
    if (body_shape) formData.append('body_shape', body_shape);
    if (skin_tone) formData.append('skin_tone', skin_tone);
    if (profile_picture) formData.append('profile_picture', profile_picture);

    const res = await fetch(`${BASE_URL}/api/profile`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData,
    });
    return handleResponse(res);
  }
};
