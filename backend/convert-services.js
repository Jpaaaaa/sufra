// Script to convert NestJS services to pure TypeScript classes
const fs = require('fs');
const path = require('path');

const servicesDir = path.join(__dirname, 'src', 'core', 'services');
const files = fs.readdirSync(servicesDir).filter(f => f.endsWith('.service.ts'));

console.log(`Converting ${files.length} service files...`);

files.forEach(file => {
  const filePath = path.join(servicesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove NestJS imports
  content = content.replace(/import\s+\{[^}]*\}\s+from\s+['"]@nestjs\/[^'"]+['"];\s*/g, '');
  
  // Replace database imports
  content = content.replace(/from\s+['"]\.\.\/\.\.\/database\/prisma\.service['"]/g, "from '../database/database.service'");
  
  // Replace exception imports
  content = content.replace(/NotFoundException/g, '___NOTFOUND___');
  content = content.replace(/ConflictException/g, '___CONFLICT___');
  content = content.replace(/BadRequestException/g, '___BADREQUEST___');
  content = content.replace(/UnauthorizedException/g, '___UNAUTHORIZED___');
  content = content.replace(/ForbiddenException/g, '___FORBIDDEN___');
  
  // Add exception imports at the top if any exceptions are used
  if (content.includes('___')) {
    const exceptions = [];
    if (content.includes('___NOTFOUND___')) exceptions.push('NotFoundException');
    if (content.includes('___CONFLICT___')) exceptions.push('ConflictException');
    if (content.includes('___BADREQUEST___')) exceptions.push('BadRequestException');
    if (content.includes('___UNAUTHORIZED___')) exceptions.push('UnauthorizedException');
    if (content.includes('___FORBIDDEN___')) exceptions.push('ForbiddenException');
    
    // Replace placeholders back
    content = content.replace(/___NOTFOUND___/g, 'NotFoundException');
    content = content.replace(/___CONFLICT___/g, 'ConflictException');
    content = content.replace(/___BADREQUEST___/g, 'BadRequestException');
    content = content.replace(/___UNAUTHORIZED___/g, 'UnauthorizedException');
    content = content.replace(/___FORBIDDEN___/g, 'ForbiddenException');
    
    // Add import at top if not already there
    if (!content.includes("from '../utils/exceptions'")) {
      const importLine = `import { ${exceptions.join(', ')} } from '../utils/exceptions';\n`;
      content = importLine + content;
    }
  }
  
  // Replace service imports from relative paths
  content = content.replace(/from\s+['"]\.\.\/([^\/]+)\/\1\.service['"]/g, "from './$1.service'");
  
  // Remove @Injectable() decorator
  content = content.replace(/@Injectable\(\)\s*/g, '');
  
  // Remove DatabaseService export (if it's the main database.service.ts)
  if (file === 'database.service.ts') {
    console.log(`  ✓ Skipping database.service.ts (already converted)`);
    return;
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`  ✓ Converted ${file}`);
});

console.log('✅ All services converted!');

