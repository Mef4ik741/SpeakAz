// JWT utility functions
export function parseJWT(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error parsing JWT:', error);
    return null;
  }
}

export function getUserIdFromToken(): string | null {
  const token = localStorage.getItem('token');
  if (!token) return null;
  
  const payload = parseJWT(token);
  if (!payload) return null;
  
  // Try different claim names for user ID
  const userId = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] 
    || payload.sub 
    || payload.userId 
    || payload.id;
    
  console.log('JWT Utils: Extracted userId from token:', userId);
  console.log('JWT Utils: Full payload:', payload);
  
  return userId;
}

export function getUsernameFromToken(): string | null {
  const token = localStorage.getItem('token');
  if (!token) return null;
  
  const payload = parseJWT(token);
  if (!payload) return null;
  
  const username = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] 
    || payload.name 
    || payload.username;
    
  return username;
}
