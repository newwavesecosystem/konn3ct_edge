import { useState, useEffect } from 'react';

export function useVirtualBackgrounds() {
  const [backgrounds, setBackgrounds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBackgrounds = async () => {
      try {
        const response = await fetch('/api/backgrounds');
        if (response.ok) {
          const data = await response.json();
          setBackgrounds(data.backgrounds || []);
        }
      } catch (error) {
        console.error('Failed to fetch virtual backgrounds:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBackgrounds();
  }, []);

  return { backgrounds, isLoading };
}
