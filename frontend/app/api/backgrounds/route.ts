import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const backgroundsDir = path.join(process.cwd(), 'public', 'backgrounds');
    
    // Check if directory exists
    if (!fs.existsSync(backgroundsDir)) {
      return NextResponse.json({ backgrounds: [] });
    }

    // Read all files in the directory
    const files = fs.readdirSync(backgroundsDir);

    // Filter out only valid image formats and map them to their public URL paths
    const backgrounds = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.png', '.jpg', '.jpeg', '.webp'].includes(ext);
      })
      .map(file => `/backgrounds/${file}`);

    return NextResponse.json({ backgrounds });
  } catch (error) {
    console.error('Failed to load virtual backgrounds:', error);
    return NextResponse.json({ backgrounds: [], error: 'Failed to load backgrounds' }, { status: 500 });
  }
}
