const https = require('https');
const fs = require('fs');
const path = require('path');

async function deploy() {
  // Read files to deploy
  const files = [];
  
  function walkDir(dir, prefix = '') {
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      if (['node_modules', '.next', '.git', '.gitignore'].includes(item)) return;
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      const relativePath = prefix ? `${prefix}/${item}` : item;
      
      if (stat.isDirectory()) {
        walkDir(fullPath, relativePath);
      } else {
        const content = fs.readFileSync(fullPath, 'utf8');
        files.push({
          file: relativePath,
          data: content
        });
      }
    });
  }
  
  walkDir('.');
  
  const payload = {
    name: 'lead-generation-platform',
    files: files,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://zlsilugoxazmeivafaqx.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpsc2lsdWdveGF6bWVpdmFmYXF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1ODE5NzMsImV4cCI6MjA5ODE1Nzk3M30.Z7yf_JpdVujwVRry4-zj4wgO-fsLDtf4ImFTau693Qk',
      SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpsc2lsdWdveGF6bWVpdmFmYXF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjU4MTk3MywiZXhwIjoyMDk4MTU3OTczfQ.x-3L1jAp3PxPk-TiIkQKqQKQsQ-7y8ZqY0rZfZ6n0PI',
      ADMIN_PASSWORD: 'admin123'
    }
  };
  
  console.log(`Deploying ${files.length} files to Vercel...`);
  console.log('Note: Use "vercel" CLI after login, or connect GitHub repo at https://vercel.com/new');
}

deploy().catch(console.error);
